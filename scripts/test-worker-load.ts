import "dotenv/config";

import {
  createQueueRedis,
  deleteJob,
  enqueueJobsBatch,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";
import { getLoadTestConfig } from "./load-test/config";
import { calculateLatency } from "./load-test/metrics";
import { printLoadTestReport } from "./load-test/report";
import type { LoadTestSample } from "./load-test/types";

const JOB_PREFIX = "smartdirect:queue:job:";
const READY_KEY = "smartdirect:queue:default:ready";
const ENQUEUE_BATCH_SIZE = 25;
const READY_SCORE_BATCH_SIZE = 25;

async function cleanupPreviousWorkerLoadJobs() {
  const redis = createQueueRedis();
  const jobIds: string[] = [];
  let cursor = 0;

  do {
    const result = await redis.scan(cursor, {
      match: `${JOB_PREFIX}job_*`,
      count: 100,
    });

    cursor = Number(result[0]);

    for (const key of result[1]) {
      const job = await redis.get<{ type?: string; payload?: { message?: string } }>(key);

      if (
        job?.type === "TEST" &&
        typeof job.payload?.message === "string" &&
        (job.payload.message.startsWith("worker-load-") ||
          job.payload.message.startsWith("queue-load-") ||
          job.payload.message.startsWith("worker-smoke-"))
      ) {
        jobIds.push(key.slice(JOB_PREFIX.length));
      }
    }
  } while (cursor !== 0);

  if (!jobIds.length) {
    return 0;
  }

  await Promise.all(jobIds.map((jobId) => deleteJob(jobId)));
  return jobIds.length;
}

async function main() {
  const config = getLoadTestConfig("worker-load", {
    total: 1_000,
    concurrency: 16,
    durationMs: 30_000,
  });

  const runId = `${Date.now()}-${crypto.randomUUID()}`;
  const jobIds: string[] = [];
  const startedAtByJobId = new Map<string, number>();
  const samples: LoadTestSample[] = [];
  const errors: string[] = [];

  const cleanedPreviousJobs = await cleanupPreviousWorkerLoadJobs();
  if (cleanedPreviousJobs > 0) {
    console.log(`Cleaned up ${cleanedPreviousJobs} stale worker-load jobs before the test.`);
  }

  const before = await getQueueDepth();
  console.log(`Worker load-test run ${runId} created ${config.total} isolated jobs.`);
  const controller = new AbortController();

  let workerError: unknown;
  let workerStartedAt = 0;
  let watchdogStopped = false;
  let watchdog: Promise<void> | undefined;

  try {
    for (let batchStart = 0; batchStart < config.total; batchStart += ENQUEUE_BATCH_SIZE) {
      const batchEnd = Math.min(
        config.total,
        batchStart + ENQUEUE_BATCH_SIZE,
      );

      const jobs = await enqueueJobsBatch(
        Array.from({ length: batchEnd - batchStart }, (_, offset) => {
          const index = batchStart + offset;

          return {
            type: "TEST" as const,
            payload: { message: `worker-load-${runId}-${index}` },
            options: {
              priority: index % 4 === 0
                ? "critical" as const
                : index % 4 === 1
                  ? "high" as const
                  : index % 4 === 2
                    ? "normal" as const
                    : "low" as const,
              maxAttempts: 1,
            },
          };
        }),
      );

      for (const job of jobs) {
        jobIds.push(job.id);
        startedAtByJobId.set(job.id, job.createdAt);
      }
    }

    // Force the isolated test jobs ahead of the pre-existing queue backlog.
    // Do this in small batches; sending 1,000 concurrent REST commands to
    // Upstash can itself become the bottleneck and would invalidate the test.
    const redis = createQueueRedis();

    for (
      let batchStart = 0;
      batchStart < jobIds.length;
      batchStart += READY_SCORE_BATCH_SIZE
    ) {
      const batchEnd = Math.min(
        jobIds.length,
        batchStart + READY_SCORE_BATCH_SIZE,
      );

      await Promise.all(
        jobIds.slice(batchStart, batchEnd).map((jobId, offset) =>
          redis.zadd(READY_KEY, {
            score: batchStart + offset - config.total,
            member: jobId,
          }),
        ),
      );
    }

    console.log(
      `Worker load-test prepared ${jobIds.length} isolated ready jobs.`,
    );

    workerStartedAt = Date.now();
    const deadlineAt = workerStartedAt + config.durationMs;

    watchdog = (async () => {
      while (!watchdogStopped && !controller.signal.aborted) {
        const remainingMs = deadlineAt - Date.now();

        if (remainingMs <= 0) {
          errors.push(
            `Worker load test exceeded the ${config.durationMs}ms execution deadline.`,
          );
          controller.abort();
          return;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(250, remainingMs)),
        );
      }
    })();

    const workerPromise = runQueueWorker(
      async (job) => {
        const completedAt = Date.now();
        const jobStartedAt = startedAtByJobId.get(job.id);

        if (jobStartedAt === undefined) {
          return;
        }

        samples.push({
          index: samples.length,
          startedAt: jobStartedAt,
          completedAt,
          durationMs: completedAt - jobStartedAt,
          ok: true,
        });

        if (samples.length >= config.total) {
          controller.abort();
        }
      },
      {
        concurrency: config.concurrency,
        pollIntervalMs: 100,
        workerId: `load-test-${process.pid}-${Date.now()}`,
        signal: controller.signal,
      },
    );

    await workerPromise;
  } catch (error) {
    workerError = error;
    errors.push(error instanceof Error ? error.message : String(error));
    controller.abort();
  } finally {
    watchdogStopped = true;
    if (watchdog) {
      await watchdog;
    }
  }

  const durationMs = workerStartedAt > 0 ? Date.now() - workerStartedAt : 0;

  let successful = 0;
  let failed = 0;

  for (const jobId of jobIds) {
    try {
      const job = await getJob(jobId);

      if (job?.status === "completed") {
        successful++;
      } else {
        failed++;
        errors.push(
          `Job ${jobId} ended with status ${job?.status ?? "missing"}.`,
        );
      }
    } catch (error) {
      failed++;
      errors.push(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const result = {
    name: config.name,
    status:
      !workerError && successful === config.total && failed === 0
        ? "completed"
        : "failed",
    durationMs,
    total: config.total,
    successful,
    failed,
    throughput: durationMs > 0 ? Number((successful / (durationMs / 1000)).toFixed(2)) : 0,
    latency: calculateLatency(samples),
    errors,
  } as const;

  const after = await getQueueDepth();
  const integrity =
    successful === config.total &&
    failed === 0 &&
    after.ready === before.ready &&
    after.delayed === before.delayed &&
    after.active === before.active &&
    after.failed === before.failed;

  console.log(
    JSON.stringify(
      {
        integrity,
        before,
        after,
        processed: successful,
      },
      null,
      2,
    ),
  );

  const cleanupResults = await Promise.allSettled(
    jobIds.map((jobId) => deleteJob(jobId)),
  );

  const cleanupFailures = cleanupResults.filter(
    (result) => result.status === "rejected",
  ).length;

  if (cleanupFailures > 0) {
    errors.push(`Worker load-test cleanup failed for ${cleanupFailures} jobs.`);
  }

  printLoadTestReport(result);

  if (
    result.status !== "completed" ||
    !integrity ||
    successful !== config.total ||
    failed !== 0 ||
    cleanupFailures > 0
  ) {
    throw new Error(
      `178 Worker Load Test failed: ${successful} of ${config.total} jobs completed.`,
    );
  }

  console.log("178 Worker Load Test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
