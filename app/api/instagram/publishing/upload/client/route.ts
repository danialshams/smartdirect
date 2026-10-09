import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnlinkedUploadExpiry } from "@/lib/instagram/publishing-media-cleanup";

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

      if (body.action === "keepalive") {
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

      if (body.action === "finalize") {
        const pathname = typeof body.pathname === "string" ? body.pathname : "";
        const url = typeof body.url === "string" ? body.url : "";
        const contentType = typeof body.contentType === "string" ? body.contentType : "";
        const fileName = typeof body.fileName === "string" ? body.fileName : "media";
        const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
        const expectedPrefix = `pending/${session.user.id}/`;

        if (!pathname.startsWith(expectedPrefix) || !url || !allowedContentTypes.includes(contentType) || fileSize <= 0) {
          return NextResponse.json(
            { success: false, message: "اطلاعات فایل آپلودشده معتبر نیست." },
            { status: 400 },
          );
        }

        const maxSize = contentType.startsWith("video/") ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (fileSize > maxSize) {
          return NextResponse.json(
            { success: false, message: "حجم فایل بیش از حد مجاز است." },
            { status: 400 },
          );
        }

        const existing = await prisma.instagramStorageObject.findUnique({
          where: { storageKey: pathname },
        });

        if (existing) {
          if (existing.userId !== session.user.id || existing.deletedAt) {
            return NextResponse.json(
              { success: false, message: "دسترسی به این فایل مجاز نیست." },
              { status: 403 },
            );
          }

          await prisma.instagramStorageObject.update({
            where: { id: existing.id },
            data: {
              publicUrl: existing.publicUrl || url,
              expiresAt: getUnlinkedUploadExpiry(),
            },
          });

          return NextResponse.json({
            success: true,
            data: {
              storageKey: existing.storageKey,
              publicUrl: existing.publicUrl || url,
              type: contentType.startsWith("video/") ? "VIDEO" : "IMAGE",
              fileName,
              mimeType: contentType,
              fileSize,
            },
          });
        }

        await prisma.instagramStorageObject.create({
          data: {
            userId: session.user.id,
            storageKey: pathname,
            publicUrl: url,
            expiresAt: getUnlinkedUploadExpiry(),
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            storageKey: pathname,
            publicUrl: url,
            type: contentType.startsWith("video/") ? "VIDEO" : "IMAGE",
            fileName,
            mimeType: contentType,
            fileSize,
          },
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
