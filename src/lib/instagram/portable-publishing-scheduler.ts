import { prisma } from "@/lib/prisma";
import { enqueueInstagramPublishing } from "@/lib/instagram/publishing-queue";

// This marker is set before Redis enqueue. Only the worker acknowledges it,
// before making any calls to Meta. Never replay arbitrary PROCESSING rows.
export const PORTABLE_PUBLISH_DISPATCH_PENDING = "PORTABLE_PUBLISH_DISPATCH_PENDING";
const STALE_DISPATCH_MS = 2 * 60_000;

/** Resume only a pre-worker dispatch abandoned by the scheduler. */
export async function acknowledgePortablePublishingDispatch(publishingJobId: string) {
  await prisma.instagramPublishJob.updateMany({
    where: {
      id: publishingJobId,
      status: "PROCESSING",
      errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
    },
    data: { errorMessage: null, lastAttemptAt: new Date() },
  });
}

/** Self-hosted scheduling adapter; Vercel keeps Workflow/sleep.
 * The PostgreSQL compare-and-swap fences schedulers. An explicit
 * pre-worker marker permits crash recovery without replaying records
 * which might already have reached Meta.
 */
export async function recoverDuePublishingJobs(
  limit = 50,
  enqueue: typeof enqueueInstagramPublishing = enqueueInstagramPublishing,
) {
  const now = new Date();
  const batchSize = Math.max(1, Math.min(200, limit));
  const staleBefore = new Date(now.getTime() - STALE_DISPATCH_MS);
  const due = await prisma.instagramPublishJob.findMany({
    where: {
      scheduledAt: { lte: now },
      OR: [
        { status: "SCHEDULED" },
        {
          status: "PROCESSING",
          errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
          lastAttemptAt: { lte: staleBefore },
          instagramContainerId: null,
          instagramMediaId: null,
        },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: batchSize,
    select: { id: true, status: true, scheduledAt: true, lastAttemptAt: true },
  });
  let queued = 0;
  let deferred = 0;
  let recovered = 0;
  for (const job of due) {
    if (!job.scheduledAt) continue;
    const wasAbandoned = job.status === "PROCESSING";
    const claimed = await prisma.instagramPublishJob.updateMany({
      where: wasAbandoned
        ? {
            id: job.id,
            status: "PROCESSING",
            errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
            lastAttemptAt: job.lastAttemptAt,
            instagramContainerId: null,
            instagramMediaId: null,
          }
        : { id: job.id, status: "SCHEDULED", scheduledAt: job.scheduledAt },
      data: {
        status: "PROCESSING",
        errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
        lastAttemptAt: new Date(),
      },
    });
    if (!claimed.count) continue;
    try {
      await enqueue(job.id, { maxAttempts: 4 });
      queued++;
      if (wasAbandoned) recovered++;
      // Queue acknowledgement may race with this update; preserve the
      // worker's new state and never reset a started publication.
      await prisma.instagramPublishJob.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
        },
        data: { errorMessage: null },
      });
    } catch (error) {
      // Only a still-pending dispatch is safe to return to SCHEDULED.
      // If a worker already acknowledged, it may have called Meta.
      await prisma.instagramPublishJob.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
          instagramContainerId: null,
          instagramMediaId: null,
        },
        data: {
          status: "SCHEDULED",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      deferred++;
    }
  }
  return { scanned: due.length, queued, deferred, recovered };
}
