import "dotenv/config";

import { runQueueWorker } from "../src/lib/queue/worker";
import type { QueueJobPayload } from "../src/lib/queue/types";
import { handleInstagramWebhookJob } from "../src/lib/webhook/worker-handler";
import { publishInstagramJob } from "../src/lib/instagram/publishing";

const controller = new AbortController();

const shutdown = () => {
  controller.abort();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("SmartDirect queue worker started.");

runQueueWorker(
  async (job) => {
    console.log(
      JSON.stringify({
        event: "job:started",
        workerId: job.workerId,
        jobId: job.id,
        type: job.type,
        attempt: job.attempts,
      }),
    );

    if (job.type === "TEST") {
      const payload = job.payload as QueueJobPayload<"TEST">;

      console.log(
        JSON.stringify({
          event: "job:test",
          message: payload.message,
        }),
      );
    } else if (job.type === "INSTAGRAM_WEBHOOK") {
      const webhookJob = job as import("../src/lib/queue/types").QueueJob<"INSTAGRAM_WEBHOOK">;
      await handleInstagramWebhookJob(webhookJob);
    } else if (job.type === "PUBLISH") {
      const publishJob = job as import("../src/lib/queue/types").QueueJob<"PUBLISH">;
      await publishInstagramJob(publishJob.payload.publishingJobId);
    }

    console.log(
      JSON.stringify({
        event: "job:completed",
        jobId: job.id,
      }),
    );
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
    console.error(error);
    process.exitCode = 1;
  });
