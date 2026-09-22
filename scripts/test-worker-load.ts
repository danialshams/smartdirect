import { config as loadEnv } from "dotenv";

// Load local test overrides first (e.g. REDIS_DRIVER=local), then fill missing values from .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import {
  createQueueRedis,
  enqueueJobsBatch,
  getQueueDepth,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";
import { getLoadTestConfig } from "./load-test/config";
import { calculateLatency } from "./load-test/metrics";
import { printLoadTestReport } from "./load-test/report";
import type { LoadTestSample } from "./load-test/types";

const JOB_PREFIX = "smartdirect:queue:job:";
const LOAD_TEST_QUEUE_NAMESPACE = "load-test-worker";
const ENQUEUE_BATCH_SIZE = 25;
const VERIFY_BATCH_SIZE = 100;

async function getJobsBatch(jobIds: string[]) {
  const redis = createQueueRedis();
  const results: Array<{ id: string; job: { status?: string } | null }> = [];

  for (let start = 0; start < jobIds.length; start += VERIFY_BATCH_SIZE) {
    const batch = jobIds.slice(start, start + VERIFY_BATCH_SIZE);
    const pipeline = redis.pipeline();

    for (const jobId of batch) {
      pipeline.get<{ status?: string }>(JOB_PREFIX + jobId);
    }

    const values = await pipeline.exec<Array<{ status?: string } | null>>();

    batch.forEach((id, index) => {
      results.push({ id, job: values[index] ?? null });
    });
  }

  return results;
}

async function deleteJobsBatch(jobIds: string[], queueNamespace = LOAD_TEST_QUEUE_NAMESPACE) {
  if (!jobIds.length) return 0;

  const redis = createQueueRedis();
  let deleted = 0;

  for (let start = 0; start < jobIds.length; start += VERIFY_BATCH_SIZE) {
    const batch = jobIds.slice(start, start + VERIFY_BATCH_SIZE);
    const pipeline = redis.pipeline();

    for (const jobId of batch) {
      pipeline.del(JOB_PREFIX + jobId);
      pipeline.del("smartdirect:queue:claim:" + jobId);
      pipeline.zrem(`smartdirect:queue:${queueNamespace}:active`, jobId);
      pipeline.zrem(`smartdirect:queue:${queueNamespace}:failed`, jobId);
      pipeline.zrem(`smartdirect:queue:${queueNamespace}:ready`, jobId);
      pipeline.zrem(`smartdirect:queue:${queueNamespace}:delayed`, jobId);
    }

    await pipeline.exec();
    deleted += batch.length;
  }

  return deleted;
}

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

  await deleteJobsBatch(jobIds);
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

  const before = await getQueueDepth(LOAD_TEST_QUEUE_NAMESPACE);
  const productionBefore = await getQueueDepth("default");
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
              queueNamespace: LOAD_TEST_QUEUE_NAMESPACE,
            },
          };
        }),
      );

      for (const job of jobs) {
        jobIds.push(job.id);
        startedAtByJobId.set(job.id, job.createdAt);
      }
    }

    console.log(`Worker load-test prepared ${jobIds.length} isolated ready jobs in namespace ${LOAD_TEST_QUEUE_NAMESPACE}.`);

    workerStartedAt = Date.now();
    const durationLimitMs = config.durationMs ?? 30_000;
    const deadlineAt = workerStartedAt + durationLimitMs;

    watchdog = (async () => {
      while (!watchdogStopped && !controller.signal.aborted) {
        const remainingMs = deadlineAt - Date.now();

        if (remainingMs <= 0) {
          errors.push(
            `Worker load test exceeded the ${durationLimitMs}ms execution deadline.`,
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

        if (samples.length > 0 && samples.length % 10 === 0) {
          console.log(`Worker load-test progress: ${samples.length}/${config.total}`);
        }

        if (samples.length >= config.total) {
          controller.abort();
        }
      },
      {
        concurrency: config.concurrency,
        pollIntervalMs: 100,
        workerId: `load-test-${process.pid}-${Date.now()}`,
        queueNamespace: LOAD_TEST_QUEUE_NAMESPACE,
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

  try {
    const verifiedJobs = await getJobsBatch(jobIds);

    for (const { id, job } of verifiedJobs) {
      if (job?.status === "completed") {
        successful++;
      } else {
        failed++;
        errors.push(
          `Job ${id} ended with status ${job?.status ?? "missing"}.`,
        );
      }
    }
  } catch (error) {
    failed = config.total;
    errors.push(error instanceof Error ? error.message : String(error));
  }

  console.log(
    JSON.stringify(
      {
        event: "worker-load:verification",
        total: config.total,
        successful,
        failed,
      },
      null,
      2,
    ),
  );

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

  const after = await getQueueDepth(LOAD_TEST_QUEUE_NAMESPACE);
  const productionAfter = await getQueueDepth("default");
  const integrity =
    successful === config.total &&
    failed === 0 &&
    after.ready === before.ready &&
    after.delayed === before.delayed &&
    after.active === before.active &&
    after.failed === before.failed &&
    productionAfter.ready === productionBefore.ready &&
    productionAfter.delayed === productionBefore.delayed &&
    productionAfter.active === productionBefore.active &&
    productionAfter.failed === productionBefore.failed;

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

  let cleanupFailures = 0;

  try {
    await deleteJobsBatch(jobIds, LOAD_TEST_QUEUE_NAMESPACE);
  } catch (error) {
    cleanupFailures = config.total;
    errors.push(
      `Worker load-test cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
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
