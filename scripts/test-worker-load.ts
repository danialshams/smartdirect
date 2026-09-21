import "dotenv/config";

import {
  createQueueRedis,
  deleteJob,
  enqueueJob,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";
import { getLoadTestConfig } from "./load-test/config";
import { calculateLatency } from "./load-test/metrics";
import { printLoadTestReport } from "./load-test/report";
import type { LoadTestSample } from "./load-test/types";

const JOB_PREFIX = "smartdirect:queue:job:";

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
        job.payload.message.startsWith("worker-load-")
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

  const jobIds: string[] = [];
  const startedAtByJobId = new Map<string, number>();
  const samples: LoadTestSample[] = [];
  const errors: string[] = [];

  const cleanedPreviousJobs = await cleanupPreviousWorkerLoadJobs();
  if (cleanedPreviousJobs > 0) {
    console.log(`Cleaned up ${cleanedPreviousJobs} stale worker-load jobs before the test.`);
  }

  const before = await getQueueDepth();
  const controller = new AbortController();

  let workerError: unknown;
  let workerStartedAt = 0;
  let watchdogStopped = false;
  let watchdog: Promise<void> | undefined;

  try {
    for (let index = 0; index < config.total; index++) {
      const jobStartedAt = Date.now();
      const job = await enqueueJob(
        "TEST",
        { message: `worker-load-${index}` },
        {
          priority: index % 4 === 0
            ? "critical"
            : index % 4 === 1
              ? "high"
              : index % 4 === 2
                ? "normal"
                : "low",
          maxAttempts: 1,
        },
      );

      jobIds.push(job.id);
      startedAtByJobId.set(job.id, jobStartedAt);
    }

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
        const jobStartedAt = startedAtByJobId.get(job.id) ?? completedAt;

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

  const durationMs = Date.now() - workerStartedAt;

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
