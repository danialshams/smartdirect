import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import path from "node:path";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnlinkedUploadExpiry } from "@/lib/instagram/publishing-media-cleanup";
import { getStorageProvider } from "@/lib/storage/provider";
import { normalizeInstagramVideo, type InstagramVideoTarget } from "@/lib/instagram/video-normalizer";

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

async function finalizeVideoUpload(input: {\n  userId: string;\n  pathname: string;\n  url: string;\n  fileName: string;\n  fileSize: number;\n  targetType: InstagramVideoTarget;\n}) {\n  const { userId, pathname, url, fileName, fileSize, targetType } = input;\n  const normalizedKey = pathname + ".normalized.mp4";\n  const existingNormalized = await prisma.instagramStorageObject.findUnique({ where: { storageKey: normalizedKey } });\n  if (existingNormalized) {\n    if (existingNormalized.userId !== userId || existingNormalized.deletedAt) {\n      throw new Error("دسترسی به فایل ویدئوی تبدیل‌شده مجاز نیست.");\n    }\n    return {\n      storageKey: existingNormalized.storageKey,\n      publicUrl: existingNormalized.publicUrl,\n      type: "VIDEO" as const,\n      fileName: path.basename(fileName, path.extname(fileName)) + ".mp4",\n      mimeType: "video/mp4",\n      fileSize,\n    };\n  }\n\n  const sourceObject = await prisma.instagramStorageObject.findUnique({ where: { storageKey: pathname } });\n  if (sourceObject && (sourceObject.userId !== userId || sourceObject.deletedAt)) {\n    throw new Error("دسترسی به فایل آپلودشده مجاز نیست.");\n  }\n  if (sourceObject?.publicUrl && sourceObject.publicUrl !== url) {\n    throw new Error("آدرس فایل آپلودشده با فایل ثبت‌شده مطابقت ندارد.");\n  }\n  if (!sourceObject) {\n    await prisma.instagramStorageObject.create({\n      data: { userId, storageKey: pathname, publicUrl: url, expiresAt: getUnlinkedUploadExpiry() },\n    });\n  }\n\n  const sourceUrl = new URL(url);\n  if (sourceUrl.protocol !== "https:" || !sourceUrl.hostname.endsWith(".public.blob.vercel-storage.com") || sourceUrl.username || sourceUrl.password) {\n    throw new Error("آدرس فایل ویدئو برای پردازش معتبر نیست.");\n  }\n  const response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(180_000) });\n  if (!response.ok) throw new Error("دریافت فایل ویدئو برای تبدیل ناموفق بود.");\n  const declaredLength = Number(response.headers.get("content-length") || 0);\n  if (declaredLength > MAX_VIDEO_SIZE) throw new Error("حجم فایل ویدئو بیش از حد مجاز است.");\n  const sourceBuffer = Buffer.from(await response.arrayBuffer());\n  if (!sourceBuffer.length || sourceBuffer.length > MAX_VIDEO_SIZE) throw new Error("حجم فایل ویدئو معتبر نیست.");\n\n  const normalizedBuffer = await normalizeInstagramVideo(sourceBuffer, fileName, targetType);\n  const provider = getStorageProvider();\n  const uploaded = await provider.upload({ key: normalizedKey, body: normalizedBuffer, contentType: "video/mp4" });\n  let normalizedObject;\n  try {\n    normalizedObject = await prisma.instagramStorageObject.create({\n      data: { userId, storageKey: uploaded.storageKey, publicUrl: uploaded.publicUrl, expiresAt: getUnlinkedUploadExpiry() },\n    });\n  } catch (error) {\n    await provider.delete(uploaded.storageKey).catch(() => undefined);\n    throw error;\n  }\n\n  try {\n    await provider.delete(pathname);\n    await prisma.instagramStorageObject.updateMany({\n      where: { userId, storageKey: pathname, deletedAt: null },\n      data: { deletedAt: new Date(), expiresAt: new Date() },\n    });\n  } catch (error) {\n    // Keep the original object tracked so the storage cleanup job can retry deletion.\n    console.warn("Original video cleanup deferred after normalization:", { storageKey: pathname, error });\n  }\n\n  return {\n    storageKey: normalizedObject.storageKey,\n    publicUrl: normalizedObject.publicUrl,\n    type: "VIDEO" as const,\n    fileName: path.basename(fileName, path.extname(fileName)) + ".mp4",\n    mimeType: "video/mp4",\n    fileSize: normalizedBuffer.length,\n  };\n}\nexport async function POST(request: NextRequest) {
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

      if (body.action === "finalize") {\n        const pathname = typeof body.pathname === "string" ? body.pathname : "";\n        const url = typeof body.url === "string" ? body.url : "";\n        const contentType = typeof body.contentType === "string" ? body.contentType : "";\n        const fileName = typeof body.fileName === "string" ? body.fileName : "media";\n        const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;\n        const targetTypeValue = body.targetType;\n        const targetType: InstagramVideoTarget = targetTypeValue === "CAROUSEL" || targetTypeValue === "STORY"\n          ? targetTypeValue\n          : "REEL";\n        const expectedPrefix = `pending/${session.user.id}/`;\n\n        if (!pathname.startsWith(expectedPrefix) || !url || !allowedContentTypes.includes(contentType) || fileSize <= 0) {\n          return NextResponse.json(\n            { success: false, message: "اطلاعات فایل آپلودشده معتبر نیست." },\n            { status: 400 },\n          );\n        }\n\n        const maxSize = contentType.startsWith("video/") ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;\n        if (fileSize > maxSize) {\n          return NextResponse.json(\n            { success: false, message: "حجم فایل بیش از حد مجاز است." },\n            { status: 400 },\n          );\n        }\n\n        if (contentType.startsWith("video/")) {\n          const data = await finalizeVideoUpload({\n            userId: session.user.id, pathname, url, fileName, fileSize, targetType,\n          });\n          return NextResponse.json({ success: true, data });\n        }\n\n        const existing = await prisma.instagramStorageObject.findUnique({ where: { storageKey: pathname } });\n        if (existing) {\n          if (existing.userId !== session.user.id || existing.deletedAt) {\n            return NextResponse.json(\n              { success: false, message: "دسترسی به این فایل مجاز نیست." },\n              { status: 403 },\n            );\n          }\n          await prisma.instagramStorageObject.update({\n            where: { id: existing.id },\n            data: { publicUrl: existing.publicUrl || url, expiresAt: getUnlinkedUploadExpiry() },\n          });\n          return NextResponse.json({\n            success: true,\n            data: { storageKey: existing.storageKey, publicUrl: existing.publicUrl || url, type: "IMAGE", fileName, mimeType: contentType, fileSize },\n          });\n        }\n\n        await prisma.instagramStorageObject.create({\n          data: { userId: session.user.id, storageKey: pathname, publicUrl: url, expiresAt: getUnlinkedUploadExpiry() },\n        });\n        return NextResponse.json({\n          success: true,\n          data: { storageKey: pathname, publicUrl: url, type: "IMAGE", fileName, mimeType: contentType, fileSize },\n        });\n      }\n      const payload = body as {
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
