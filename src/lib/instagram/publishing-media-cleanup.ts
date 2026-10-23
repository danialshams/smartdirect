import { prisma } from "@/lib/prisma";
import { getStorageProviderForObject } from "@/lib/storage/provider";
import { isStorageObjectReferenced } from "@/lib/instagram/storage-references";

const DEFAULT_UPLOAD_TTL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;
const MAX_CLEANUP_BATCHES = 12;
const FAILED_MEDIA_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const PUBLISH_MEDIA_MAX_RETRIES = 4;

export function getStorageObjectExpiry(scheduledAt: Date | null, now = Date.now()) {
  if (scheduledAt) return new Date(scheduledAt.getTime() + 6 * 60 * 60 * 1000);
  return new Date(now + 24 * 60 * 60 * 1000);
}

/** Unlinked uploads expire one hour after their last successful upload/lease renewal. */
export function getUnlinkedUploadExpiry(now = Date.now()) {
  return new Date(now + DEFAULT_UPLOAD_TTL_MS);
}

export async function deletePublishMediaStorage(
  items: Array<{ id: string; storageKey: string; publicUrl: string | null; deletedAt: Date | null }>,
) {
  let deleted = 0;
  let failed = 0;
  let skippedReferenced = 0;
  let legacySkipped = 0;

  for (const item of items) {
    if (item.deletedAt) continue;

    const storageObject = await prisma.instagramStorageObject.findUnique({
      where: { storageKey: item.storageKey },
      select: { publicUrl: true },
    });
    // Published media's publicUrl may have been rewritten to Instagram's URL.
    // The storage object's original URL is authoritative for shared references.
    const publicUrl = storageObject?.publicUrl || item.publicUrl || null;

    // Without a URL we cannot prove that this object is not also used by an
    // automation/showcase. Keep it rather than risk breaking saved content.
    if (!publicUrl) {
      legacySkipped++;
      continue;
    }

    const isReferenced = await isStorageObjectReferenced({
      storageKey: item.storageKey,
      publicUrl,
      ignorePublishMediaId: item.id,
    });
    if (isReferenced) {
      skippedReferenced++;
      continue;
    }

    try {
      if (!item.storageKey.startsWith("test:")) {
        await getStorageProviderForObject(item.storageKey, publicUrl).delete(item.storageKey);
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

  return { deleted, failed, skippedReferenced, legacySkipped };
}

export async function cleanupInstagramPublishStorage(now = new Date(), userId?: string) {
  const oldFailed = new Date(now.getTime() - FAILED_MEDIA_GRACE_MS);
  const processedMediaIds: string[] = [];
  let mediaDeleted = 0, mediaFailed = 0, mediaSkippedReferenced = 0, mediaLegacySkipped = 0;
  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
    const media = await prisma.instagramPublishMedia.findMany({
      where: {
        deletedAt: null,
        ...(userId ? { publishJob: { userId } } : {}),
        ...(processedMediaIds.length ? { id: { notIn: processedMediaIds } } : {}),
        OR: [
          { publishJob: { status: "CANCELLED" } },
          { publishJob: { status: "PUBLISHED" } },
          // Do not expire files while SCHEDULED, PROCESSING or PUBLISHING:
          // a delayed Instagram attempt still needs the original public URL.
          { publishJob: { status: "FAILED", retryCount: { gte: PUBLISH_MEDIA_MAX_RETRIES }, updatedAt: { lte: oldFailed } } },
          { publishJob: { status: "DRAFT", updatedAt: { lte: oldFailed } } },
        ],
      },
      select: { id: true, storageKey: true, publicUrl: true, deletedAt: true },
      orderBy: { expiresAt: "asc" },
      take: CLEANUP_BATCH_SIZE,
    });
    if (!media.length) break;
    processedMediaIds.push(...media.map((item) => item.id));
    const result = await deletePublishMediaStorage(media);
    mediaDeleted += result.deleted;
    mediaFailed += result.failed;
    mediaSkippedReferenced += result.skippedReferenced;
    mediaLegacySkipped += result.legacySkipped;
    if (media.length < CLEANUP_BATCH_SIZE) break;
  }

  const processedObjectIds: string[] = [];
  let orphanDeleted = 0, orphanFailed = 0, legacySkipped = 0;
  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
    const orphaned = await prisma.instagramStorageObject.findMany({
      where: {
        deletedAt: null,
        ...(userId ? { userId } : {}),
        expiresAt: { lte: now },
        ...(processedObjectIds.length ? { id: { notIn: processedObjectIds } } : {}),
      },
      select: { id: true, userId: true, purpose: true, createdAt: true, storageKey: true, publicUrl: true },
      orderBy: { expiresAt: "asc" },
      take: CLEANUP_BATCH_SIZE,
    });
    if (!orphaned.length) break;
    processedObjectIds.push(...orphaned.map((item) => item.id));
    for (const item of orphaned) {
      const isUnfinalizedUpload = !item.publicUrl
        && item.storageKey.startsWith(`pending/${item.userId}/`)
        && item.purpose !== "UNKNOWN";
      if (!item.publicUrl && !isUnfinalizedUpload) {
        legacySkipped++;
        continue;
      }

      const isReferenced = await isStorageObjectReferenced({
        storageKey: item.storageKey,
        publicUrl: item.publicUrl,
      });
      if (isReferenced) {
        // This file is still owned by a saved response, showcase or in-flight job.
        // Avoid rescanning this active file in every daily cleanup batch.
        await prisma.instagramStorageObject.updateMany({
          where: { id: item.id, deletedAt: null },
          data: { expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        });
        continue;
      }

      try {
        if (!item.storageKey.startsWith("test:")) {
          await getStorageProviderForObject(item.storageKey, item.publicUrl).delete(item.storageKey);
        }
        await prisma.instagramStorageObject.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        });
        orphanDeleted++;
      } catch (error) {
        orphanFailed++;
        console.error("Orphaned Instagram storage cleanup failed:", {
          storageObjectId: item.id, storageKey: item.storageKey, error,
        });
      }
    }
    if (orphaned.length < CLEANUP_BATCH_SIZE) break;
  }
  return {
    mediaDeleted, mediaFailed, mediaSkippedReferenced, mediaLegacySkipped,
    orphanedDeleted: orphanDeleted, orphanedFailed: orphanFailed, legacySkipped,
  };
}
