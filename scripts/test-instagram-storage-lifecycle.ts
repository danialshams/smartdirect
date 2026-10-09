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
  assert(unlinkedExpiry.getTime() === now.getTime() + 60 * 60 * 1000, "Unlinked upload TTL must be one hour");

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
    const publicUrl = "https://storage.test/" + suffix + "/" + name;
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
        publicUrl,
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
        publicUrl,
        expiresAt,
      },
    });

    return { job, media, storageKey, publicUrl };
  };

  const cancelled = await createCase("cancelled", "CANCELLED", 0, future);
  const published = await createCase("published", "PUBLISHED", 0, future);
  const finalFailed = await createCase("final-failed", "FAILED", PUBLISH_MEDIA_MAX_RETRIES, future);
  const retrying = await createCase("retrying", "FAILED", PUBLISH_MEDIA_MAX_RETRIES - 1, future);
  const expired = await createCase("expired", "DRAFT", 0, past);

  const orphanKey = "test:" + suffix + "/orphan";
  const orphanUrl = "https://storage.test/" + suffix + "/orphan";
  await prisma.instagramStorageObject.create({
    data: {
      userId: user.id,
      storageKey: orphanKey,
      publicUrl: orphanUrl,
      expiresAt: past,
    },
  });

  const legacyStorageKey = "test:" + suffix + "/legacy-without-url";
  await prisma.instagramStorageObject.create({
    data: {
      userId: user.id,
      storageKey: legacyStorageKey,
      expiresAt: past,
    },
  });

  const activeAutomation = await prisma.automation.create({
    data: {
      instagramAccountId: account.id,
      keyword: "active-storage-" + suffix,
      triggerType: "COMMENT_KEYWORD",
    },
  });
  const activeStorageKey = "test:" + suffix + "/active-automation";
  const activeStorageUrl = "https://storage.test/" + suffix + "/active-automation";
  await prisma.instagramStorageObject.create({
    data: {
      userId: user.id,
      storageKey: activeStorageKey,
      publicUrl: activeStorageUrl,
      expiresAt: past,
    },
  });
  await prisma.automationMessage.create({
    data: {
      automationId: activeAutomation.id,
      order: 0,
      messageType: "IMAGE",
      mediaUrl: activeStorageUrl,
    },
  });

  const cleanup = await cleanupInstagramPublishStorage(now, user.id);
  assert(cleanup.mediaDeleted >= 4, `Expected at least four publish media records to be cleaned, got ${cleanup.mediaDeleted}`);
  assert(cleanup.mediaFailed === 0, "Test storage media cleanup should not fail");
  assert(cleanup.orphanedDeleted >= 1, `Expected at least one expired orphaned object to be cleaned, got ${cleanup.orphanedDeleted}`);
  assert(cleanup.orphanedFailed === 0, "Test orphan cleanup should not fail");
  assert(cleanup.legacySkipped >= 1, "Legacy objects without URL mappings must be preserved");

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

  const legacyObject = await prisma.instagramStorageObject.findUnique({
    where: { storageKey: legacyStorageKey },
    select: { deletedAt: true },
  });
  assert(legacyObject?.deletedAt === null, "Legacy storage without a URL mapping was deleted unsafely");

  const activeObject = await prisma.instagramStorageObject.findUnique({
    where: { storageKey: activeStorageKey },
    select: { deletedAt: true },
  });
  assert(activeObject?.deletedAt === null, "Storage referenced by an active automation was deleted");

  const secondCleanup = await cleanupInstagramPublishStorage(now, user.id);
  assert(secondCleanup.mediaDeleted === 0 && secondCleanup.orphanedDeleted === 0, "Cleanup is not idempotent");

  await prisma.instagramStorageObject.deleteMany({ where: { userId: user.id } });
  await prisma.instagramPublishJob.deleteMany({ where: { userId: user.id } });
  await prisma.instagramAccount.delete({ where: { id: account.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(JSON.stringify({
    success: true,
    tests: {
      ttlRules: true,
      activeAutomationMediaRetention: true,
      legacyObjectSafety: true,
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
