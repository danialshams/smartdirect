import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage/provider";

const DEFAULT_UPLOAD_TTL_MS = 72 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;

export const PUBLISH_MEDIA_MAX_RETRIES = 4;

export function getStorageObjectExpiry(scheduledAt: Date | null, now = Date.now()) {
  if (scheduledAt) return new Date(scheduledAt.getTime() + 6 * 60 * 60 * 1000);
  return new Date(now + 24 * 60 * 60 * 1000);
}

export function getUnlinkedUploadExpiry(now = Date.now()) {
  return new Date(now + DEFAULT_UPLOAD_TTL_MS);
}

export async function deletePublishMediaStorage(
  items: Array<{ id: string; storageKey: string; deletedAt: Date | null }>,
) {
  const storage = getStorageProvider();
  let deleted = 0;
  let failed = 0;

  for (const item of items) {
    if (item.deletedAt) continue;
    try {
      if (!item.storageKey.startsWith("test:")) {
        await storage.delete(item.storageKey);
      }

      await prisma.$transaction([
        prisma.instagramPublishMedia.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        }),
        prisma.instagramStorageObject.updateMany({
          where: { storageKey: item.storageKey, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
      ]);
      deleted++;
    } catch (error) {
      failed++;
      console.error("Instagram publish media cleanup failed:", {
        mediaId: item.id,
        storageKey: item.storageKey,
        error,
      });
    }
  }

  return { deleted, failed };
}

export async function cleanupInstagramPublishStorage(now = new Date()) {
  const media = await prisma.instagramPublishMedia.findMany({
    where: {
      deletedAt: null,
      OR: [
        { expiresAt: { lte: now } },
        { publishJob: { status: "CANCELLED" } },
        { publishJob: { status: "PUBLISHED" } },
        {
          publishJob: {
            status: "FAILED",
            retryCount: { gte: PUBLISH_MEDIA_MAX_RETRIES },
          },
        },
      ],
    },
    select: { id: true, storageKey: true, deletedAt: true },
    orderBy: { expiresAt: "asc" },
    take: CLEANUP_BATCH_SIZE,
  });

  const mediaResult = await deletePublishMediaStorage(media);

  const orphaned = await prisma.instagramStorageObject.findMany({
    where: {
      deletedAt: null,
      expiresAt: { lte: now },
    },
    select: { id: true, storageKey: true },
    orderBy: { expiresAt: "asc" },
    take: CLEANUP_BATCH_SIZE,
  });

  const storage = getStorageProvider();
  let orphanDeleted = 0;
  let orphanFailed = 0;

  for (const item of orphaned) {
    const linkedMedia = await prisma.instagramPublishMedia.findFirst({
      where: { storageKey: item.storageKey },
      select: { id: true, deletedAt: true },
    });

    if (linkedMedia && !linkedMedia.deletedAt) continue;

    try {
      if (!item.storageKey.startsWith("test:")) {
        await storage.delete(item.storageKey);
      }
      await prisma.instagramStorageObject.update({
        where: { id: item.id },
        data: { deletedAt: new Date() },
      });
      orphanDeleted++;
    } catch (error) {
      orphanFailed++;
      console.error("Orphaned Instagram storage cleanup failed:", {
        storageObjectId: item.id,
        storageKey: item.storageKey,
        error,
      });
    }
  }

  return {
    mediaDeleted: mediaResult.deleted,
    mediaFailed: mediaResult.failed,
    orphanedDeleted: orphanDeleted,
    orphanedFailed: orphanFailed,
  };
}
