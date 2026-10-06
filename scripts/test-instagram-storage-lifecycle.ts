import "dotenv/config";

import {
  cleanupInstagramPublishStorage,
  getStorageObjectExpiry,
  getUnlinkedUploadExpiry,
  PUBLISH_MEDIA_MAX_RETRIES,
} from "../src/lib/instagram/publishing-media-cleanup";
import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = "storage-lifecycle-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 60 * 60 * 1000);

  const unlinkedExpiry = getUnlinkedUploadExpiry(now.getTime());
  assert(unlinkedExpiry.getTime() === now.getTime() + 72 * 60 * 60 * 1000, "Unlinked upload TTL must be 72 hours");

  const scheduledAt = new Date(now.getTime() + 60 * 60 * 1000);
  const scheduledExpiry = getStorageObjectExpiry(scheduledAt);
  assert(scheduledExpiry.getTime() === scheduledAt.getTime() + 6 * 60 * 60 * 1000, "Scheduled publish expiry must be 6 hours after scheduledAt");

  const immediateExpiry = getStorageObjectExpiry(null, now.getTime());
  assert(immediateExpiry.getTime() === now.getTime() + 24 * 60 * 60 * 1000, "Immediate publish expiry must be 24 hours");

  const user = await prisma.user.create({
    data: {
      email: suffix + "@example.test",
      name: "Storage Lifecycle Test",
      password: "test-only",
    },
  });

  const account = await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      igUserId: "storage-test-ig-" + suffix,
      igUsername: "storage_test_" + suffix.slice(-10),
      accessToken: "test-only",
      isConnected: true,
    },
  });

  const createCase = async (
    name: string,
    status: "CANCELLED" | "PUBLISHED" | "FAILED" | "DRAFT",
    retryCount: number,
    expiresAt: Date,
  ) => {
    const storageKey = "test:" + suffix + "/" + name;
    const job = await prisma.instagramPublishJob.create({
      data: {
        userId: user.id,
        instagramAccountId: account.id,
        type: "POST",
        status,
        retryCount,
      },
    });

    const media = await prisma.instagramPublishMedia.create({
      data: {
        publishJobId: job.id,
        type: "IMAGE",
        storageKey,
        fileName: name + ".jpg",
        mimeType: "image/jpeg",
        fileSize: 10,
        expiresAt,
      },
    });

    await prisma.instagramStorageObject.create({
      data: {
        userId: user.id,
        storageKey,
        expiresAt,
      },
    });

    return { job, media, storageKey };
  };

  const cancelled = await createCase("cancelled", "CANCELLED", 0, future);
  const published = await createCase("published", "PUBLISHED", 0, future);
  const finalFailed = await createCase("final-failed", "FAILED", PUBLISH_MEDIA_MAX_RETRIES, future);
  const retrying = await createCase("retrying", "FAILED", PUBLISH_MEDIA_MAX_RETRIES - 1, future);
  const expired = await createCase("expired", "DRAFT", 0, past);

  const orphanKey = "test:" + suffix + "/orphan";
  const orphan = await prisma.instagramStorageObject.create({
    data: {
      userId: user.id,
      storageKey: orphanKey,
      expiresAt: past,
    },
  });

  const cleanup = await cleanupInstagramPublishStorage(now);
  assert(cleanup.mediaDeleted === 4, "Expected four publish media records to be cleaned");
  assert(cleanup.mediaFailed === 0, "Test storage media cleanup should not fail");
  assert(cleanup.orphanedDeleted === 1, "Expected one expired orphaned object to be cleaned");
  assert(cleanup.orphanedFailed === 0, "Test orphan cleanup should not fail");

  const deletedMedia = await prisma.instagramPublishMedia.findMany({
    where: { id: { in: [cancelled.media.id, published.media.id, finalFailed.media.id, expired.media.id] } },
    select: { id: true, deletedAt: true },
  });
  assert(deletedMedia.every((item) => item.deletedAt !== null), "Cancelled/published/final-failed/expired media were not deleted");

  const retainedMedia = await prisma.instagramPublishMedia.findUnique({
    where: { id: retrying.media.id },
    select: { deletedAt: true },
  });
  assert(retainedMedia?.deletedAt === null, "Retryable failed media was deleted too early");

  const deletedObjects = await prisma.instagramStorageObject.findMany({
    where: { storageKey: { in: [cancelled.storageKey, published.storageKey, finalFailed.storageKey, expired.storageKey, orphanKey] } },
    select: { storageKey: true, deletedAt: true },
  });
  assert(deletedObjects.length === 5 && deletedObjects.every((item) => item.deletedAt !== null), "Deleted media/orphan storage objects were not marked deleted");

  const retainedObject = await prisma.instagramStorageObject.findUnique({
    where: { storageKey: retrying.storageKey },
    select: { deletedAt: true },
  });
  assert(retainedObject?.deletedAt === null, "Retryable failed storage object was deleted too early");

  const secondCleanup = await cleanupInstagramPublishStorage(now);
  assert(secondCleanup.mediaDeleted === 0 && secondCleanup.orphanedDeleted === 0, "Cleanup is not idempotent");

  await prisma.instagramStorageObject.deleteMany({ where: { userId: user.id } });
  await prisma.instagramPublishJob.deleteMany({ where: { userId: user.id } });
  await prisma.instagramAccount.delete({ where: { id: account.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(JSON.stringify({
    success: true,
    tests: {
      ttlRules: true,
      cancelledImmediateCleanup: true,
      publishedImmediateCleanup: true,
      finalFailedCleanup: true,
      retryableFailureRetention: true,
      expiredMediaCleanup: true,
      orphanCleanup: true,
      idempotentCleanup: true,
      databaseCleanup: true,
    },
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
