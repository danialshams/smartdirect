import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";

import { authOptions } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const allowedVideoTypes = new Set(["video/mp4", "video/quicktime"]);

function sanitizeFileName(name: string) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "احراز هویت انجام نشده است.",
        },
        { status: 401 },
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "فایل ارسال نشده است.",
        },
        { status: 400 },
      );
    }

    const isImage = allowedImageTypes.has(file.type);

    const isVideo = allowedVideoTypes.has(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          success: false,
          message: "فرمت فایل پشتیبانی نمی‌شود.",
        },
        { status: 400 },
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          message: "حجم فایل بیش از حد مجاز است.",
        },
        { status: 400 },
      );
    }

    const extension = path.extname(file.name) || (isImage ? ".jpg" : ".mp4");

    const safeName = sanitizeFileName(path.basename(file.name, extension));

    const key = [
      "pending",
      session.user.id,
      `${crypto.randomUUID()}-${safeName}${extension}`,
    ].join("/");

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
        type: isVideo ? "VIDEO" : "IMAGE",
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error("POST /api/instagram/publishing/upload error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "آپلود فایل ناموفق بود.",
      },
      { status: 500 },
    );
  }
}
