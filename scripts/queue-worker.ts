import "dotenv/config";

import { runQueueWorker } from "../src/lib/queue/worker";
import type { QueueJobPayload } from "../src/lib/queue/types";
import { handleInstagramWebhookJob } from "../src/lib/webhook/worker-handler";
import { publishInstagramJob } from "../src/lib/instagram/publishing";
import { processSmartReminder, recoverDueSmartReminders } from "../src/lib/automation/smart-reminders";
import { recoverWebhookInbox, purgeCompletedWebhookInbox } from "../src/lib/webhook/durable-inbox";
import { recoverDuePublishingJobs } from "../src/lib/instagram/portable-publishing-scheduler";
import { resolveExecutionBackend } from "../src/lib/runtime/execution-backend";
import { enterObservabilityContext } from "../src/lib/observability/context";
import { observabilityLogger } from "../src/lib/observability/logger";

const controller = new AbortController();

const shutdown = () => {
  controller.abort();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("SmartDirect queue worker started.");
const isPortablePublishingScheduler = resolveExecutionBackend() === "worker";

// PostgreSQL-backed scan recovers reminders after Redis loss or worker restarts.
// Redis delayed jobs handle the fast path; the scan is a durable fallback.
let recoveryBusy = false;
const recoveryTimer = setInterval(() => {
  if (recoveryBusy || controller.signal.aborted) return;
  recoveryBusy = true;
  void recoverDueSmartReminders().catch(error => {
    console.error("[SMART_REMINDER] recovery scan failed", error);
  }).finally(() => { recoveryBusy = false; });
}, 60_000);
recoveryTimer.unref();
controller.signal.addEventListener("abort", () => clearInterval(recoveryTimer), { once: true });
void recoverDueSmartReminders().catch(error => console.error("[SMART_REMINDER] initial recovery scan failed", error));

// Rescan PostgreSQL so a failed Redis enqueue or a process crash cannot
// permanently drop a Meta webhook. Run this worker independently of Next.js.
let inboxRecoveryBusy = false;
const inboxRecoveryTimer = setInterval(() => {
  if (inboxRecoveryBusy || controller.signal.aborted) return;
  inboxRecoveryBusy = true;
  void recoverWebhookInbox(100).catch(error => {
    observabilityLogger.error("webhook_inbox_recovery_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }).finally(() => { inboxRecoveryBusy = false; });
}, 30_000);
inboxRecoveryTimer.unref();
const inboxCleanupTimer = setInterval(() => {
  if (controller.signal.aborted) return;
  void purgeCompletedWebhookInbox(Number(process.env.WEBHOOK_INBOX_RETENTION_DAYS ?? 7)).catch(error =>
    observabilityLogger.warn("webhook_inbox_retention_cleanup_failed", {
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}, 6 * 60 * 60_000);
inboxCleanupTimer.unref();
controller.signal.addEventListener("abort", () => clearInterval(inboxCleanupTimer), { once: true });
controller.signal.addEventListener("abort", () => clearInterval(inboxRecoveryTimer), { once: true });
void recoverWebhookInbox(100).catch(error => {
  observabilityLogger.error("webhook_inbox_initial_recovery_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
});


if (isPortablePublishingScheduler) {
  let publishingRecoveryBusy = false;
  const publishTimer = setInterval(() => {
    if (controller.signal.aborted || publishingRecoveryBusy) return;
    publishingRecoveryBusy = true;
    void recoverDuePublishingJobs(50).catch(error => {
      observabilityLogger.error("portable_publish_scheduler_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }).finally(() => { publishingRecoveryBusy = false; });
  }, 15_000);
  publishTimer.unref();
  controller.signal.addEventListener("abort", () => clearInterval(publishTimer), { once: true });
  void recoverDuePublishingJobs(50).catch(error => {
    observabilityLogger.error("portable_publish_scheduler_initial_scan_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
runQueueWorker(
  async (job) => {
    enterObservabilityContext({ jobId: job.id });

    observabilityLogger.info("job_started", {
        workerId: job.workerId,
        type: job.type,
        attempt: job.attempts,
        priority: job.priority,
      });

    if (job.type === "TEST") {
      const payload = job.payload as QueueJobPayload<"TEST">;

      observabilityLogger.info("job_test", {
        message: payload.message,
      });
    } else if (job.type === "INSTAGRAM_WEBHOOK") {
      const webhookJob = job as import("../src/lib/queue/types").QueueJob<"INSTAGRAM_WEBHOOK">;
      await handleInstagramWebhookJob(webhookJob);
    } else if (job.type === "PUBLISH") {
      const publishJob = job as import("../src/lib/queue/types").QueueJob<"PUBLISH">;
      await publishInstagramJob(publishJob.payload.publishingJobId);
    } else if (job.type === "SMART_REMINDER") {
      const reminderJob = job as import("../src/lib/queue/types").QueueJob<"SMART_REMINDER">;
      await processSmartReminder(reminderJob.payload.deliveryId);
    } else {
      // Never acknowledge a job type that has no execution implementation.
      // Route it through retry / dead-letter rather than silently losing work.
      throw new Error(`UNSUPPORTED_QUEUE_JOB_TYPE:${job.type}`);
    }

    observabilityLogger.info("job_completed", {
      type: job.type,
      attempt: job.attempts,
    });
  },
  {
    concurrency: Number(process.env.QUEUE_WORKER_CONCURRENCY ?? 2),
    pollIntervalMs: Number(process.env.QUEUE_WORKER_POLL_INTERVAL_MS ?? 1000),
    signal: controller.signal,
  },
)
  .then(() => {
    console.log("SmartDirect queue worker stopped gracefully.");
  })
  .catch((error) => {
    observabilityLogger.error("queue_worker_fatal_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
