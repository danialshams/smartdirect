import { claimJobById, completeJob, startJobClaimHeartbeat } from "@/lib/queue/core";
import { acquireLock, releaseLock } from "@/lib/lock/redis-lock";
import type { DistributedLockHandle } from "@/lib/lock/types";
import { handleInstagramWebhookJob } from "@/lib/webhook/worker-handler";
import type { QueueJob } from "@/lib/queue/types";
import { enterObservabilityContext } from "@/lib/observability/context";
import { observabilityLogger } from "@/lib/observability/logger";

export async function processInstagramWebhookQueueJobStep(jobId: string) {
  "use step";

  const workflowWorkerId = `workflow_${jobId}`;
  const job = await claimJobById(jobId, workflowWorkerId);

  if (!job) {
    return { ok: false, skipped: true, message: "Webhook queue job پیدا نشد." };
  }

  if (job.type !== "INSTAGRAM_WEBHOOK") {
    return { ok: false, skipped: true, message: "Queue job از نوع webhook نیست." };
  }

  enterObservabilityContext({ jobId: job.id });
  const stopClaimHeartbeat = startJobClaimHeartbeat(job.id, workflowWorkerId);

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
        message: "Webhook queue job توسط Worker دیگری در حال پردازش است.",
      };
    }

    lockHandle = lock.handle;

    const webhookJob = job as QueueJob<"INSTAGRAM_WEBHOOK">;

    await handleInstagramWebhookJob(webhookJob);

    await completeJob(job.id);

    return {
      ok: true,
      skipped: false,
      message: "Instagram webhook processed.",
    };
  } catch (error) {
    observabilityLogger.error("workflow_webhook_job_failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  } finally {
    stopClaimHeartbeat();
    if (lockHandle) {
      await releaseLock(lockHandle);
    }
  }
}

export async function processInstagramWebhookQueueJob(jobId: string) {
  "use workflow";

  return processInstagramWebhookQueueJobStep(jobId);
}
