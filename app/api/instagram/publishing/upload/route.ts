import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";

import { authOptions } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MAX_AUDIO_SIZE = 50 * 1024 * 1024;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideoTypes = new Set(["video/mp4", "video/quicktime"]);
const allowedAudioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/m4a"]);

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

    const isImage = allowedImageTypes.has(file.type);
    const isVideo = allowedVideoTypes.has(file.type);
    const isAudio = allowedAudioTypes.has(file.type) || file.type.startsWith("audio/");

    if (!isImage && !isVideo && !isAudio) {
      return NextResponse.json({ success: false, message: "فرمت فایل پشتیبانی نمی‌شود." }, { status: 400 });
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : isAudio ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: "حجم فایل بیش از حد مجاز است." }, { status: 400 });
    }

    const extension = path.extname(file.name) || (isImage ? ".jpg" : isVideo ? ".mp4" : ".mp3");
    const safeName = sanitizeFileName(path.basename(file.name, extension));
    const key = ["pending", session.user.id, `${crypto.randomUUID()}-${safeName}${extension}`].join("/");

    const provider = getStorageProvider();
    const result = await provider.upload({
      key,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });

    return NextResponse.json({
      success: true,
      data: {
        storageKey: result.storageKey,
        publicUrl: result.publicUrl,
        type: isVideo ? "VIDEO" : isAudio ? "AUDIO" : "IMAGE",
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
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

    const body = await request.json().catch(() => null) as { storageKey?: unknown } | null;
    const storageKey = typeof body?.storageKey === "string" ? body.storageKey : "";

    if (!storageKey) {
      return NextResponse.json({ success: false, message: "storageKey ارسال نشده است." }, { status: 400 });
    }

    const expectedPrefix = `pending/${session.user.id}/`;

    if (!storageKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ success: false, message: "دسترسی به این فایل مجاز نیست." }, { status: 403 });
    }

    const provider = getStorageProvider();
    await provider.delete(storageKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/instagram/publishing/upload error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "حذف فایل ناموفق بود.",
    }, { status: 500 });
  }
}
