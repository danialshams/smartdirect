import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";
import { createHash } from "node:crypto";

import { authOptions } from "@/lib/auth";
import { getStorageProvider, getStorageProviderForObject } from "@/lib/storage/provider";
import { reserveUpload, releaseUploadReservation } from "@/lib/storage/upload-accounting";
import { maximumUploadBytes, checkMediaOutputSize } from "@/lib/instagram/media-limits";
import { normalizeInstagramPublishImage } from "@/lib/instagram/image-normalizer";
import { prisma } from "@/lib/prisma";
import { getUnlinkedUploadExpiry } from "@/lib/instagram/publishing-media-cleanup";
import { isStorageObjectReferenced } from "@/lib/instagram/storage-references";
import { normalizeInstagramVideo } from "@/lib/instagram/video-normalizer";
import { normalizeInstagramAudio } from "@/lib/instagram/audio-normalizer";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const META_DM_IMAGE_MAX_SIZE = 8_000_000 - 1;
const META_DM_VIDEO_MAX_SIZE = 25_000_000 - 1;
const META_DM_AUDIO_MAX_SIZE = 25_000_000 - 1;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideoTypes = new Set(["video/mp4", "video/quicktime"]);
const allowedVideoExtensions = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".3gp", ".mpeg", ".mpg", ".mts", ".m2ts"]);


function sanitizeFileName(name: string) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const targetTypeValue = formData.get("targetType");
    const purposeValue = formData.get("purpose");
    const purpose = purposeValue === "AUTOMATION" || purposeValue === "INBOX" ? purposeValue : "PUBLISHING";
    const mediaPurpose = purpose === "PUBLISHING" ? "PUBLISHING" : "AUTOMATION";
    const targetType = targetTypeValue === "CAROUSEL" || targetTypeValue === "STORY" || targetTypeValue === "REEL"
      ? targetTypeValue
      : "REEL";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "فایل ارسال نشده است." }, { status: 400 });
    }

    const fileExtension = path.extname(file.name).toLowerCase();
    const normalizedInputMime = file.type.toLowerCase();
    const isImage = allowedImageTypes.has(normalizedInputMime);
    if (mediaPurpose === "AUTOMATION" && normalizedInputMime === "image/webp") {
      return NextResponse.json({ success: false, message: "برای پاسخ خودکار، تصویر باید JPG یا PNG باشد." }, { status: 400 });
    }
    // Browsers sometimes send application/octet-stream for valid video files.
    // The extension fallback is allowlisted; FFmpeg still has to decode the media.
    const isVideo = allowedVideoTypes.has(normalizedInputMime) ||
      (normalizedInputMime.startsWith("video/") && allowedVideoExtensions.has(fileExtension)) ||
      ((!normalizedInputMime || normalizedInputMime === "application/octet-stream") && allowedVideoExtensions.has(fileExtension));
    const isAudio = normalizedInputMime.startsWith("audio/");
    if (purpose === "AUTOMATION" && isVideo) return NextResponse.json({ success: false, message: "آپلود ویدیو در پاسخ‌های خودکار فعلاً غیرفعال است." }, { status: 400 });

    if (!isImage && !isVideo && !isAudio) {
      return NextResponse.json({ success: false, message: "فرمت فایل پشتیبانی نمی‌شود." }, { status: 400 });
    }

    const mediaType = isImage ? "IMAGE" : isVideo ? "VIDEO" : "AUDIO";
    const maxSize = maximumUploadBytes(mediaPurpose, mediaType, targetType);

    if (file.size > maxSize) {
      if (purpose === "AUTOMATION") {
        const limit = isImage ? "۸ مگابایت" : "۲۵ مگابایت";
        return NextResponse.json({ success: false, message: "حجم فایل برای پیام خودکار اینستاگرام باید کمتر از " + limit + " باشد." }, { status: 400 });
      }
      return NextResponse.json({ success: false, message: "حجم فایل بیش از حد مجاز است." }, { status: 400 });
    }

    let uploadBuffer: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer());
    let uploadFileName = file.name;
    let uploadContentType = file.type;

    if (isVideo) {
      try {
        uploadBuffer = await normalizeInstagramVideo(uploadBuffer, file.name, mediaPurpose === "AUTOMATION" ? "MESSAGE" : targetType);
        uploadFileName = path.basename(file.name, path.extname(file.name)) + ".mp4";
        uploadContentType = "video/mp4";
      } catch (error) {
        console.error("Instagram video normalization failed:", {
          fileName: sanitizeFileName(file.name),
          inputSize: file.size,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    if (isImage && purpose === "PUBLISHING") {
      uploadBuffer = await normalizeInstagramPublishImage(uploadBuffer, file.name, targetType);
      uploadFileName = path.basename(file.name, path.extname(file.name)) + ".jpg";
      uploadContentType = "image/jpeg";
    }
    if (isAudio) {
      uploadBuffer = await normalizeInstagramAudio(uploadBuffer, file.name);
      uploadFileName = path.basename(file.name, path.extname(file.name)) + ".m4a";
      uploadContentType = "audio/mp4";
    }

    checkMediaOutputSize(mediaPurpose, mediaType, uploadBuffer.length);
    const extension = path.extname(uploadFileName) || (isImage ? ".jpg" : isVideo ? ".mp4" : ".m4a");
    const safeName = sanitizeFileName(path.basename(uploadFileName, extension));
    const key = ["pending", session.user.id, `${crypto.randomUUID()}-${safeName}${extension}`].join("/");

    const checksum = createHash("sha256").update(uploadBuffer).digest("hex");
    if (purpose === "AUTOMATION") {
      const duplicate = await prisma.instagramStorageObject.findFirst({
        where: { userId: session.user.id, purpose: "AUTOMATION", checksum, deletedAt: null, publicUrl: { not: null } },
        select: { storageKey: true, publicUrl: true },
      });
      if (duplicate?.publicUrl && await isStorageObjectReferenced({
        storageKey: duplicate.storageKey, publicUrl: duplicate.publicUrl,
      })) {
        const oldProvider = getStorageProviderForObject(duplicate.storageKey, duplicate.publicUrl);
        if (await oldProvider.exists(duplicate.storageKey).catch(() => false)) {
          return NextResponse.json({ success: true, reused: true, data: {
            storageKey: duplicate.storageKey, publicUrl: duplicate.publicUrl,
            type: mediaType, fileName: uploadFileName,
            mimeType: uploadContentType, fileSize: uploadBuffer.length,
          } });
        }
      }
    }
    const provider = getStorageProvider();
    await reserveUpload({ userId: session.user.id, storageKey: key, bytes: uploadBuffer.length, purpose });
    let result: Awaited<ReturnType<typeof provider.upload>> | null = null;
    try {
      result = await provider.upload({ key, body: uploadBuffer, contentType: uploadContentType });
      await prisma.instagramStorageObject.update({
        where: { storageKey: key },
        data: {
          storageKey: result.storageKey,
          publicUrl: result.publicUrl,
          fileSize: BigInt(uploadBuffer.length),
          checksum,
          expiresAt: getUnlinkedUploadExpiry(),
        },
      });
    } catch (error) {
      if (result) await provider.delete(result.storageKey).catch(() => undefined);
      await releaseUploadReservation(session.user.id, key).catch(() => undefined);
      throw error;
    }

    if (!result) throw new Error("آپلود فایل تکمیل نشد.");
    return NextResponse.json({
      success: true,
      data: {
        storageKey: result.storageKey,
        publicUrl: result.publicUrl,
        type: isVideo ? "VIDEO" : isAudio ? "AUDIO" : "IMAGE",
        fileName: uploadFileName,
        mimeType: uploadContentType,
        fileSize: uploadBuffer.length,
      },
    });
  } catch (error) {
    console.error("POST /api/instagram/publishing/upload error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "آپلود فایل ناموفق بود.",
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as {
      storageKey?: unknown;
      publicUrl?: unknown;
    } | null;
    const requestedKey = typeof body?.storageKey === "string" ? body.storageKey : "";
    const requestedUrl = typeof body?.publicUrl === "string" ? body.publicUrl : "";

    if (!requestedKey && !requestedUrl) {
      return NextResponse.json({ success: false, message: "storageKey یا publicUrl ارسال نشده است." }, { status: 400 });
    }

    let storageObject = requestedKey
      ? await prisma.instagramStorageObject.findUnique({ where: { storageKey: requestedKey } })
      : null;

    if (!storageObject && requestedUrl) {
      storageObject = await prisma.instagramStorageObject.findFirst({
        where: { userId: session.user.id, publicUrl: requestedUrl },
      });
    }

    if (storageObject && storageObject.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "دسترسی به این فایل مجاز نیست." }, { status: 403 });
    }

    const storageKey = storageObject?.storageKey || requestedKey;
    if (!storageKey) {
      // Older records have no publicUrl mapping. Leave their physical object
      // for provider-aware reconciliation instead of guessing a storage key.
      return NextResponse.json({ success: true, deferred: true });
    }

    if (!storageObject && !storageKey.startsWith(`pending/${session.user.id}/`)) {
      return NextResponse.json({ success: false, message: "دسترسی به این فایل مجاز نیست." }, { status: 403 });
    }

    if (storageObject?.deletedAt) {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }

    if (storageObject && !storageObject.publicUrl) {
      return NextResponse.json({
        success: true,
        deferred: true,
        message: "این فایل از نسخه قدیمی ثبت شده و تا زمان تطبیق امن آدرس آن حذف فیزیکی نمی‌شود.",
      });
    }

    if (storageObject?.publicUrl && requestedUrl && storageObject.publicUrl !== requestedUrl) {
      return NextResponse.json({ success: false, message: "آدرس فایل با کلید ذخیره‌شده مطابقت ندارد." }, { status: 400 });
    }

    const publicUrl = storageObject?.publicUrl || requestedUrl || null;
    const isReferenced = await isStorageObjectReferenced({ storageKey, publicUrl });

    if (isReferenced) {
      return NextResponse.json({
        success: true,
        deferred: true,
        message: "این فایل هنوز در محتوای ذخیره‌شده استفاده می‌شود و حذف آن به تعویق افتاد.",
      });
    }

    const provider = getStorageProviderForObject(storageKey, publicUrl);
    await provider.delete(storageKey);

    await prisma.instagramStorageObject.updateMany({
      where: {
        userId: session.user.id,
        storageKey,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, deferred: false });
  } catch (error) {
    console.error("DELETE /api/instagram/publishing/upload error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "حذف فایل ناموفق بود.",
    }, { status: 500 });
  }
}
