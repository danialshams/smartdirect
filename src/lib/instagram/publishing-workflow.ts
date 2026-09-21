import { getJob, completeJob } from "@/lib/queue/core";
import { acquireLock, releaseLock } from "@/lib/lock/redis-lock";
import type { DistributedLockHandle } from "@/lib/lock/types";
import { publishInstagramJob } from "@/lib/instagram/publishing";
import type { QueueJob } from "@/lib/queue/types";
import { enterObservabilityContext } from "@/lib/observability/context";
import { observabilityLogger } from "@/lib/observability/logger";

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

    throw error;
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
