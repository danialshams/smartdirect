import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const allowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "media";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "احراز هویت انجام نشده است." },
      { status: 401 },
    );
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

            const maxSize = payload.contentType.startsWith("video/")
              ? MAX_VIDEO_SIZE
              : MAX_IMAGE_SIZE;

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
