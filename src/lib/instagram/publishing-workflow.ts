import { prisma } from "@/lib/prisma";
import { getJob, completeJob, failJob } from "@/lib/queue/core";
import { acquireLock, releaseLock } from "@/lib/lock/redis-lock";
import type { DistributedLockHandle } from "@/lib/lock/types";
import { publishInstagramJob } from "@/lib/instagram/publishing";
import type { QueueJob } from "@/lib/queue/types";
import { enterObservabilityContext } from "@/lib/observability/context";
import { observabilityLogger } from "@/lib/observability/logger";
import { cleanupInstagramPublishStorage, deletePublishMediaStorage } from "@/lib/instagram/publishing-media-cleanup";

export async function processPublishingQueueJobStep(jobId: string) {
  "use step";

  const job = await getJob(jobId);

  if (!job) {
    return { ok: false, skipped: true, message: "Queue job پیدا نشد." };
  }

  if (job.type !== "PUBLISH") {
    return {
      ok: false,
      skipped: true,
      message: `Queue job ${jobId} از نوع PUBLISH نیست.`,
    };
  }

  if (job.status !== "waiting" && job.status !== "active") {
    return {
      ok: false,
      skipped: true,
      message: `Queue job در وضعیت ${job.status} است.`,
    };
  }

  enterObservabilityContext({ jobId: job.id });

  let lockHandle: DistributedLockHandle | undefined;

  try {
    const lock = await acquireLock({
      scope: "job",
      resourceId: job.id,
    });

    if (!lock.acquired) {
      return {
        ok: false,
        skipped: true,
        message: "Queue job هم‌اکنون توسط Worker دیگری در حال پردازش است.",
      };
    }

    lockHandle = lock.handle;

    await publishInstagramJob(
      (job as QueueJob<"PUBLISH">).payload.publishingJobId,
    );

    await completeJob(job.id);

    return { ok: true, skipped: false, message: "Publishing job processed." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    observabilityLogger.error("workflow_publishing_job_failed", {
      error: message,
    });

    // publishInstagramJob already records the InstagramPublishJob as FAILED.
    // Keep the Redis queue state in sync as well. Throwing here would make the
    // workflow engine retry the whole publishing step even for permanent
    // Instagram API errors such as invalid parameters.
    const failedQueueJob = await failJob(job.id, error);

    if (
      failedQueueJob?.status === "failed" &&
      job.type === "PUBLISH"
    ) {
      try {
        const publishingJob = await prisma.instagramPublishJob.findUnique({
          where: { id: (job as QueueJob<"PUBLISH">).payload.publishingJobId },
          select: { media: { where: { deletedAt: null }, select: { id: true, storageKey: true, deletedAt: true } } },
        });

        if (publishingJob?.media.length) {
          await deletePublishMediaStorage(publishingJob.media);
        }
      } catch (cleanupError) {
        console.error("Final publishing media cleanup failed:", cleanupError);
      }
    }

    return {
      ok: false,
      skipped: false,
      message,
      failed: true,
    };
  } finally {
    if (lockHandle) {
      await releaseLock(lockHandle);
    }
  }
}

export async function processPublishingQueueJob(jobId: string) {
  "use workflow";

  return processPublishingQueueJobStep(jobId);
}
