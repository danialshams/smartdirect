import { prisma } from "@/lib/prisma";
import { enqueueInstagramPublishing } from "@/lib/instagram/publishing-queue";

/** Self-hosted scheduling adapter; Vercel keeps Workflow/sleep.
 * A PostgreSQL compare-and-swap prevents simultaneous schedulers from
 * dispatching the same scheduled row.
 */
export async function recoverDuePublishingJobs(
  limit = 50,
  enqueue: typeof enqueueInstagramPublishing = enqueueInstagramPublishing,
) {
  const due = await prisma.instagramPublishJob.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: Math.max(1, Math.min(200, limit)),
    select: { id: true, scheduledAt: true },
  });
  let queued = 0;
  let deferred = 0;
  for (const job of due) {
    if (!job.scheduledAt) continue;
    const claimed = await prisma.instagramPublishJob.updateMany({
      where: { id: job.id, status: "SCHEDULED", scheduledAt: job.scheduledAt },
      data: { status: "PROCESSING", lastAttemptAt: new Date() },
    });
    if (!claimed.count) continue;
    try {
      await enqueue(job.id, { maxAttempts: 4 });
      queued++;
    } catch (error) {
      // Return to durable scheduling when Redis is unavailable.
      // An abrupt crash after the CAS needs operator reconciliation;
      // do not blindly retry PROCESSING jobs that may have reached Meta.
      await prisma.instagramPublishJob.updateMany({
        where: { id: job.id, status: "PROCESSING", instagramContainerId: null },
        data: { status: "SCHEDULED", errorMessage: error instanceof Error ? error.message : String(error) },
      });
      deferred++;
    }
  }
  return { scanned: due.length, queued, deferred };
}
