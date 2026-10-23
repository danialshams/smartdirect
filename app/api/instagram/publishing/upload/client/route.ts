import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { head as headBlob } from "@vercel/blob";
import path from "node:path";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnlinkedUploadExpiry } from "@/lib/instagram/publishing-media-cleanup";
import { getStorageProvider } from "@/lib/storage/provider";
import { normalizeInstagramVideo, type InstagramVideoTarget } from "@/lib/instagram/video-normalizer";
import { normalizeInstagramAudio } from "@/lib/instagram/audio-normalizer";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const allowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
  "video/mpeg",
  "video/3gpp",
  "video/mp2t",
  "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/3gpp",
];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "media";
}

async function finalizeVideoUpload(input: {
  userId: string;
  pathname: string;
  url: string;
  fileName: string;
  fileSize: number;
  targetType: InstagramVideoTarget;
}) {
  const { userId, pathname, url, fileName, fileSize, targetType } = input;
  const normalizedKey = pathname + ".normalized.mp4";
  const existingNormalized = await prisma.instagramStorageObject.findUnique({ where: { storageKey: normalizedKey } });
  if (existingNormalized) {
    if (existingNormalized.userId !== userId || existingNormalized.deletedAt) {
      throw new Error("دسترسی به فایل ویدئوی تبدیل‌شده مجاز نیست.");
    }
    return {
      storageKey: existingNormalized.storageKey,
      publicUrl: existingNormalized.publicUrl,
      type: "VIDEO" as const,
      fileName: path.basename(fileName, path.extname(fileName)) + ".mp4",
      mimeType: "video/mp4",
      fileSize,
    };
  }

  const sourceObject = await prisma.instagramStorageObject.findUnique({ where: { storageKey: pathname } });
  if (sourceObject && (sourceObject.userId !== userId || sourceObject.deletedAt)) {
    throw new Error("دسترسی به فایل آپلودشده مجاز نیست.");
  }
  if (sourceObject?.publicUrl && sourceObject.publicUrl !== url) {
    throw new Error("آدرس فایل آپلودشده با فایل ثبت‌شده مطابقت ندارد.");
  }
  if (!sourceObject) {
    await prisma.instagramStorageObject.create({
      data: { userId, storageKey: pathname, publicUrl: url, expiresAt: getUnlinkedUploadExpiry() },
    });
  }

  const sourceUrl = new URL(url);
  if (sourceUrl.protocol !== "https:" || !sourceUrl.hostname.endsWith(".public.blob.vercel-storage.com") || sourceUrl.username || sourceUrl.password) {
    throw new Error("آدرس فایل ویدئو برای پردازش معتبر نیست.");
  }
  const response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error("دریافت فایل ویدئو برای تبدیل ناموفق بود.");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_VIDEO_SIZE) throw new Error("حجم فایل ویدئو بیش از حد مجاز است.");
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  if (!sourceBuffer.length || sourceBuffer.length > MAX_VIDEO_SIZE) throw new Error("حجم فایل ویدئو معتبر نیست.");

  const normalizedBuffer = await normalizeInstagramVideo(sourceBuffer, fileName, targetType);
  const provider = getStorageProvider();
  const uploaded = await provider.upload({ key: normalizedKey, body: normalizedBuffer, contentType: "video/mp4" });
  try {
    await prisma.instagramStorageObject.create({
      data: { userId, storageKey: uploaded.storageKey, publicUrl: uploaded.publicUrl, expiresAt: getUnlinkedUploadExpiry() },
    });
  } catch (error) {
    await provider.delete(uploaded.storageKey).catch(() => undefined);
    throw error;
  }

  try {
    await provider.delete(pathname);
    await prisma.instagramStorageObject.updateMany({
      where: { userId, storageKey: pathname, deletedAt: null },
      data: { deletedAt: new Date(), expiresAt: new Date() },
    });
  } catch (error) {
    // Keep the original object tracked so the storage cleanup job can retry deletion.
    console.warn("Original video cleanup deferred after normalization:", { storageKey: pathname, error });
  }

  return {
    storageKey: uploaded.storageKey,
    publicUrl: uploaded.publicUrl,
    type: "VIDEO" as const,
    fileName: path.basename(fileName, path.extname(fileName)) + ".mp4",
    mimeType: "video/mp4",
    fileSize: normalizedBuffer.length,
  };
}
async function finalizeAudioUpload(input: {
  userId: string;
  pathname: string;
  url: string;
  fileName: string;
  fileSize: number;
}) {
  const { userId, pathname, url, fileName, fileSize } = input;
  const normalizedKey = pathname + ".normalized.m4a";
  const existingNormalized = await prisma.instagramStorageObject.findUnique({ where: { storageKey: normalizedKey } });
  if (existingNormalized) {
    if (existingNormalized.userId !== userId || existingNormalized.deletedAt) {
      throw new Error("دسترسی به فایل ویدئوی تبدیل‌شده مجاز نیست.");
    }
    return {
      storageKey: existingNormalized.storageKey,
      publicUrl: existingNormalized.publicUrl,
      type: "AUDIO" as const,
      fileName: path.basename(fileName, path.extname(fileName)) + ".m4a",
      mimeType: "audio/mp4",
      fileSize,
    };
  }

  const sourceObject = await prisma.instagramStorageObject.findUnique({ where: { storageKey: pathname } });
  if (sourceObject && (sourceObject.userId !== userId || sourceObject.deletedAt)) {
    throw new Error("دسترسی به فایل آپلودشده مجاز نیست.");
  }
  if (sourceObject?.publicUrl && sourceObject.publicUrl !== url) {
    throw new Error("آدرس فایل آپلودشده با فایل ثبت‌شده مطابقت ندارد.");
  }
  if (!sourceObject) {
    await prisma.instagramStorageObject.create({
      data: { userId, storageKey: pathname, publicUrl: url, expiresAt: getUnlinkedUploadExpiry() },
    });
  }

  const sourceUrl = new URL(url);
  if (sourceUrl.protocol !== "https:" || !sourceUrl.hostname.endsWith(".public.blob.vercel-storage.com") || sourceUrl.username || sourceUrl.password) {
    throw new Error("آدرس فایل ویدئو برای پردازش معتبر نیست.");
  }
  const response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error("دریافت فایل ویدئو برای تبدیل ناموفق بود.");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_AUDIO_SIZE) throw new Error("حجم فایل ویدئو بیش از حد مجاز است.");
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  if (!sourceBuffer.length || sourceBuffer.length > MAX_AUDIO_SIZE) throw new Error("حجم فایل ویدئو معتبر نیست.");

  const normalizedBuffer = await normalizeInstagramAudio(sourceBuffer, fileName);
  const provider = getStorageProvider();
  const uploaded = await provider.upload({ key: normalizedKey, body: normalizedBuffer, contentType: "audio/mp4" });
  try {
    await prisma.instagramStorageObject.create({
      data: { userId, storageKey: uploaded.storageKey, publicUrl: uploaded.publicUrl, expiresAt: getUnlinkedUploadExpiry() },
    });
  } catch (error) {
    await provider.delete(uploaded.storageKey).catch(() => undefined);
    throw error;
  }

  try {
    await provider.delete(pathname);
    await prisma.instagramStorageObject.updateMany({
      where: { userId, storageKey: pathname, deletedAt: null },
      data: { deletedAt: new Date(), expiresAt: new Date() },
    });
  } catch (error) {
    // Keep the original object tracked so the storage cleanup job can retry deletion.
    console.warn("Original video cleanup deferred after normalization:", { storageKey: pathname, error });
  }

  return {
    storageKey: uploaded.storageKey,
    publicUrl: uploaded.publicUrl,
    type: "AUDIO" as const,
    fileName: path.basename(fileName, path.extname(fileName)) + ".m4a",
    mimeType: "audio/mp4",
    fileSize: normalizedBuffer.length,
  };
}
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "احراز هویت انجام نشده است." },
      { status: 401 },
    );
  }

  // Lease renewals work with every storage provider, not only Vercel Blob.
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (body?.action === "keepalive") {
      const publicUrls = Array.isArray(body.publicUrls)
        ? body.publicUrls.filter((value): value is string => typeof value === "string" && value.length <= 2048).slice(0, 100)
        : [];

      if (publicUrls.length === 0) {
        return NextResponse.json({ success: true, renewed: 0 });
      }

      const renewed = await prisma.instagramStorageObject.updateMany({
        where: {
          userId: session.user.id,
          publicUrl: { in: publicUrls },
          deletedAt: null,
        },
        data: { expiresAt: getUnlinkedUploadExpiry() },
      });

      return NextResponse.json({ success: true, renewed: renewed.count });
    }
  }

  if (process.env.STORAGE_PROVIDER !== "vercel-blob") {
    return NextResponse.json({
      success: true,
      mode: "server-upload",
    });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;

      if (body.type === "blob.generate-client-token") {
        const jsonResponse = await handleUpload({
          body: body as unknown as HandleUploadBody,
          request,
          onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
            const safePathPrefix = `pending/${session.user.id}/`;
            if (!pathname.startsWith(safePathPrefix)) {
              throw new Error("مسیر آپلود معتبر نیست.");
            }

            let payload: {
              purpose?: string;
              pathname?: string;
              fileName?: string;
              contentType?: string;
              fileSize?: number;
            } = {};

            if (clientPayload) {
              try {
                payload = JSON.parse(clientPayload);
              } catch {
                throw new Error("اطلاعات فایل معتبر نیست.");
              }
            }

            if (
              payload.pathname !== pathname ||
              !payload.contentType ||
              !allowedContentTypes.includes(payload.contentType)
            ) {
              throw new Error("اطلاعات فایل معتبر نیست.");
            }

            const automation = payload.purpose === "AUTOMATION";
            if (automation && payload.contentType === "image/webp") throw new Error("برای پاسخ خودکار فقط JPG یا PNG مجاز است.");
            if (!automation && payload.contentType.startsWith("audio/")) throw new Error("صوت فقط برای پاسخ خودکار مجاز است.");
            const maxSize = automation
              ? payload.contentType.startsWith("image/") ? 8_000_000 - 1 : 25_000_000 - 1
              : payload.contentType.startsWith("video/") ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

            return {
              pathname,
              multipart,
              allowedContentTypes,
              maximumSizeInBytes: maxSize,
              tokenPayload: JSON.stringify({ userId: session.user.id }),
            };
          },
        });

        return NextResponse.json(jsonResponse);
      }

      if (body.action === "finalize") {
        const pathname = typeof body.pathname === "string" ? body.pathname : "";
        const url = typeof body.url === "string" ? body.url : "";
        const contentType = typeof body.contentType === "string" ? body.contentType : "";
        const fileName = typeof body.fileName === "string" ? body.fileName : "media";
        const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
        const purpose = body.purpose === "AUTOMATION" ? "AUTOMATION" : "PUBLISHING";
        const targetTypeValue = body.targetType;
        const targetType: InstagramVideoTarget = targetTypeValue === "CAROUSEL" || targetTypeValue === "STORY"
          ? targetTypeValue
          : purpose === "AUTOMATION" ? "MESSAGE" : "REEL";
        const expectedPrefix = `pending/${session.user.id}/`;

        if (!pathname.startsWith(expectedPrefix) || !url || !allowedContentTypes.includes(contentType) || fileSize <= 0) {
          return NextResponse.json(
            { success: false, message: "اطلاعات فایل آپلودشده معتبر نیست." },
            { status: 400 },
          );
        }

        const maxSize = purpose === "AUTOMATION"
          ? contentType.startsWith("image/") ? 8_000_000 - 1 : 25_000_000 - 1
          : contentType.startsWith("video/") ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if ((purpose === "AUTOMATION" && contentType === "image/webp") || (purpose !== "AUTOMATION" && contentType.startsWith("audio/"))) {
          return NextResponse.json({ success: false, message: "فرمت فایل برای این بخش مجاز نیست." }, { status: 400 });
        }
        if (fileSize > maxSize) {
          return NextResponse.json(
            { success: false, message: "حجم فایل بیش از حد مجاز است." },
            { status: 400 },
          );
        }

        // Never trust browser-supplied blob metadata; verify ownership, URL, size and existence.
        const blobInfo = await headBlob(pathname);
        if (blobInfo.pathname !== pathname || blobInfo.url !== url || blobInfo.size !== fileSize) {
          return NextResponse.json({ success: false, message: "فایل آپلودشده با اطلاعات ثبت مطابقت ندارد." }, { status: 400 });
        }
        if (contentType.startsWith("video/")) {
          const data = await finalizeVideoUpload({
            userId: session.user.id, pathname, url, fileName, fileSize, targetType,
          });
          return NextResponse.json({ success: true, data });
        }

        if (contentType.startsWith("audio/")) {
          const data = await finalizeAudioUpload({ userId: session.user.id, pathname, url, fileName, fileSize });
          return NextResponse.json({ success: true, data });
        }

        const existing = await prisma.instagramStorageObject.findUnique({ where: { storageKey: pathname } });
        if (existing) {
          if (existing.userId !== session.user.id || existing.deletedAt) {
            return NextResponse.json(
              { success: false, message: "دسترسی به این فایل مجاز نیست." },
              { status: 403 },
            );
          }
          await prisma.instagramStorageObject.update({
            where: { id: existing.id },
            data: { publicUrl: existing.publicUrl || url, expiresAt: getUnlinkedUploadExpiry() },
          });
          return NextResponse.json({
            success: true,
            data: { storageKey: existing.storageKey, publicUrl: existing.publicUrl || url, type: "IMAGE", fileName, mimeType: contentType, fileSize },
          });
        }

        await prisma.instagramStorageObject.create({
          data: { userId: session.user.id, storageKey: pathname, publicUrl: url, expiresAt: getUnlinkedUploadExpiry() },
        });
        return NextResponse.json({
          success: true,
          data: { storageKey: pathname, publicUrl: url, type: "IMAGE", fileName, mimeType: contentType, fileSize },
        });
      }
      const payload = body as {
        fileName?: string;
        contentType?: string;
        fileSize?: number;
      };

      if (
        !payload.contentType ||
        !allowedContentTypes.includes(payload.contentType) ||
        typeof payload.fileSize !== "number"
      ) {
        return NextResponse.json(
          { success: false, message: "اطلاعات فایل معتبر نیست." },
          { status: 400 },
        );
      }

      const maxSize = payload.contentType.startsWith("video/")
        ? MAX_VIDEO_SIZE
        : MAX_IMAGE_SIZE;

      if (payload.fileSize <= 0 || payload.fileSize > maxSize) {
        return NextResponse.json(
          { success: false, message: "حجم فایل بیش از حد مجاز است." },
          { status: 400 },
        );
      }

      const pathname = [
        "pending",
        session.user.id,
        `${crypto.randomUUID()}-${sanitizeFileName(payload.fileName || "media")}`,
      ].join("/");

      // Keep small uploads on the normal authenticated server path.
      // This avoids an unnecessary browser -> Blob network hop and stays
      // portable: on a VPS the same server route can handle larger files
      // simply by increasing STORAGE_SERVER_UPLOAD_MAX_BYTES.
      const serverUploadMaxBytes = Number(
        process.env.STORAGE_SERVER_UPLOAD_MAX_BYTES || 4 * 1024 * 1024,
      );

      if (
        Number.isFinite(serverUploadMaxBytes) &&
        serverUploadMaxBytes > 0 &&
        payload.fileSize <= serverUploadMaxBytes
      ) {
        return NextResponse.json({
          success: true,
          mode: "server-upload",
        });
      }

      return NextResponse.json({
        success: true,
        mode: "vercel-blob",
        pathname,
      });
    }

    return NextResponse.json(
      { success: false, message: "درخواست آپلود معتبر نیست." },
      { status: 400 },
    );
  } catch (error) {
    console.error("POST /api/instagram/publishing/upload/client error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "آماده‌سازی آپلود ناموفق بود.",
      },
      { status: 500 },
    );
  }
}
