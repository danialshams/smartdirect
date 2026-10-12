import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

import { authOptions } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage/provider";
import { prisma } from "@/lib/prisma";
import { getUnlinkedUploadExpiry } from "@/lib/instagram/publishing-media-cleanup";
import { isStorageObjectReferenced } from "@/lib/instagram/storage-references";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const SAFE_AUDIO_SIZE = 24 * 1024 * 1024;
const SAFE_VIDEO_SIZE = 100 * 1024 * 1024;
const execFileAsync = promisify(execFile);

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

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "فایل ارسال نشده است." }, { status: 400 });
    }

    const fileExtension = path.extname(file.name).toLowerCase();
    const normalizedInputMime = file.type.toLowerCase();
    const isImage = allowedImageTypes.has(normalizedInputMime);
    // Browsers sometimes send application/octet-stream for valid video files.
    // The extension fallback is allowlisted; FFmpeg still has to decode the media.
    const isVideo = allowedVideoTypes.has(normalizedInputMime) ||
      (normalizedInputMime.startsWith("video/") && allowedVideoExtensions.has(fileExtension)) ||
      ((!normalizedInputMime || normalizedInputMime === "application/octet-stream") && allowedVideoExtensions.has(fileExtension));
    const isAudio = normalizedInputMime.startsWith("audio/");

    if (!isImage && !isVideo && !isAudio) {
      return NextResponse.json({ success: false, message: "فرمت فایل پشتیبانی نمی‌شود." }, { status: 400 });
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : isAudio ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: "حجم فایل بیش از حد مجاز است." }, { status: 400 });
    }

    let uploadBuffer: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer());
    let uploadFileName = file.name;
    let uploadContentType = file.type;

    if (isVideo) {
      if (!ffmpegPath) throw new Error("FFmpeg در سرور در دسترس نیست؛ تبدیل ویدئو انجام نشد.");
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "smartdirect-video-"));
      const inputPath = path.join(tempDir, "input" + (fileExtension || ".video"));
      const outputPath = path.join(tempDir, "normalized.mp4");
      try {
        await writeFile(inputPath, uploadBuffer);
        // Normalize videos to an Instagram-compatible baseline:
        // MP4, H.264/yuv420p, AAC 48 kHz, 30 fps, max 1920 px, faststart.
        await execFileAsync(ffmpegPath, [
          "-hide_banner", "-loglevel", "error", "-y",
          "-i", inputPath,
          "-map", "0:v:0", "-map", "0:a:0?",
          "-map_metadata", "-1",
          "-vf", "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-flags", "+cgop", "-x264-params", "open-gop=0",
          "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
          "-sn", "-dn", "-movflags", "+faststart", "-f", "mp4", outputPath,
        ], { timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
        const normalized = await readFile(outputPath);
        if (!normalized.length) throw new Error("تبدیل ویدئو خروجی خالی تولید کرد.");
        if (normalized.length > SAFE_VIDEO_SIZE) {
          throw new Error("حجم ویدئو پس از تبدیل بیش از 200 مگابایت است؛ ویدئوی کوتاه‌تر یا کم‌حجم‌تری انتخاب کنید.");
        }
        uploadBuffer = normalized;
        uploadFileName = path.basename(file.name, path.extname(file.name)) + ".mp4";
        uploadContentType = "video/mp4";
      } catch (error) {
        console.error("Instagram video normalization failed:", {
          fileName: sanitizeFileName(file.name),
          inputSize: file.size,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(error instanceof Error && error.message.includes("200 مگابایت")
          ? error.message
          : "تبدیل ویدئو به فرمت سازگار با Instagram ناموفق بود. فایل ویدئو را بررسی کنید و دوباره تلاش کنید.");
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    if (isAudio) {
      if (!ffmpegPath) throw new Error("FFmpeg در سرور در دسترس نیست.");
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "smartdirect-audio-"));
      const inputPath = path.join(tempDir, "input" + (path.extname(file.name) || ".audio"));
      const outputPath = path.join(tempDir, "output.m4a");
      try {
        await writeFile(inputPath, uploadBuffer);
        let normalized: Buffer | null = null;
        for (const bitrate of ["96k", "64k", "48k"]) {
          await rm(outputPath, { force: true });
          await execFileAsync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-vn", "-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-ac", "2", "-movflags", "+faststart", outputPath], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
          normalized = await readFile(outputPath);
          if (normalized.length <= SAFE_AUDIO_SIZE) break;
        }
        if (!normalized || normalized.length > SAFE_AUDIO_SIZE) throw new Error("حجم فایل صوتی پس از تبدیل باید حداکثر 24 مگابایت باشد.");
        uploadBuffer = normalized;
        uploadFileName = path.basename(file.name, path.extname(file.name)) + ".m4a";
        uploadContentType = "audio/mp4";
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    const extension = path.extname(uploadFileName) || (isImage ? ".jpg" : isVideo ? ".mp4" : ".m4a");
    const safeName = sanitizeFileName(path.basename(uploadFileName, extension));
    const key = ["pending", session.user.id, `${crypto.randomUUID()}-${safeName}${extension}`].join("/");

    const provider = getStorageProvider();
    const result = await provider.upload({
      key,
      body: uploadBuffer,
      contentType: uploadContentType,
    });

    try {
      await prisma.instagramStorageObject.create({
        data: {
          userId: session.user.id,
          storageKey: result.storageKey,
          publicUrl: result.publicUrl,
          expiresAt: getUnlinkedUploadExpiry(),
        },
      });
    } catch (error) {
      await provider.delete(result.storageKey).catch(() => undefined);
      throw error;
    }

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

    const provider = getStorageProvider();
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
