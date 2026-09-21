import "dotenv/config";

import { runQueueWorker } from "../src/lib/queue/worker";
import type { QueueJobPayload } from "../src/lib/queue/types";
import { handleInstagramWebhookJob } from "../src/lib/webhook/worker-handler";
import { publishInstagramJob } from "../src/lib/instagram/publishing";
import { enterObservabilityContext } from "../src/lib/observability/context";
import { observabilityLogger } from "../src/lib/observability/logger";

const controller = new AbortController();

const shutdown = () => {
  controller.abort();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("SmartDirect queue worker started.");

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
