import "dotenv/config";

import {
  createQueueRedis,
  deleteJob,
  enqueueJob,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";

const READY_KEY = "smartdirect:queue:default:ready";
const TIMEOUT_MS = 15_000;

async function main() {
  const message = `worker-lifecycle-smoke-${Date.now()}-${crypto.randomUUID()}`;
  const before = await getQueueDepth();
  const controller = new AbortController();
  let jobId: string | undefined;
  let processed = false;

  try {
    const job = await enqueueJob(
      "TEST",
      { message },
      {
        priority: "critical",
        maxAttempts: 1,
      },
    );

    jobId = job.id;

    // Isolate this exact smoke job from the existing queue backlog.
    const redis = createQueueRedis();
    await redis.zadd(READY_KEY, {
      score: 0,
      member: job.id,
    });

    console.log(JSON.stringify({
      step: "prepared",
      jobId,
      before,
    }, null, 2));

    const workerPromise = runQueueWorker(
      async (claimedJob) => {
        console.log(JSON.stringify({
          step: "handler:start",
          claimedJobId: claimedJob.id,
        }));

        if (claimedJob.id !== job.id) {
          throw new Error(
            `LIFECYCLE_SMOKE_CLAIM_MISMATCH: expected ${job.id}, got ${claimedJob.id}.`,
          );
        }

        processed = true;
        console.log(JSON.stringify({ step: "handler:done" }));
        controller.abort();
      },
      {
        concurrency: 1,
        pollIntervalMs: 100,
        workerId: `lifecycle-smoke-${process.pid}-${Date.now()}`,
        signal: controller.signal,
      },
    );

    await Promise.race([
      workerPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              `LIFECYCLE_SMOKE_TIMEOUT: runQueueWorker did not stop within ${TIMEOUT_MS}ms.`,
            ),
          );
        }, TIMEOUT_MS);
      }),
    ]);

    const finalJob = await getJob(job.id);
    const after = await getQueueDepth();

    console.log(JSON.stringify({
      step: "finished",
      processed,
      finalStatus: finalJob?.status ?? "missing",
      after,
    }, null, 2));

    if (!processed || finalJob?.status !== "completed") {
      throw new Error(
        `LIFECYCLE_SMOKE_FAILED: processed=${processed}, status=${finalJob?.status ?? "missing"}.`,
      );
    }

    console.log("Worker Lifecycle Smoke Test: OK");
  } finally {
    controller.abort();

    if (jobId) {
      await deleteJob(jobId).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
