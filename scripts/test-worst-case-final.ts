import "dotenv/config";

import { randomUUID } from "node:crypto";

import {
  deleteJob,
  enqueueJobsBatch,
  getQueueDepth,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";
import {
  getRedisClient,
  redisHealthCheck,
  setRedisCommandTimeoutMs,
} from "../src/lib/redis/client";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

const TENANTS = Math.max(1_000, Number(process.env.WORST_CASE_TENANTS ?? 10_000));
const ACCOUNTS_PER_TENANT = Math.max(
  2,
  Number(process.env.WORST_CASE_ACCOUNTS_PER_TENANT ?? 3),
);
const JOBS_PER_ACCOUNT = Math.max(1, Number(process.env.WORST_CASE_JOBS_PER_ACCOUNT ?? 1));
const BATCH_SIZE = Math.max(50, Number(process.env.WORST_CASE_BATCH_SIZE ?? 250));
const WORKER_CONCURRENCY = Math.max(
  8,
  Number(process.env.WORST_CASE_CONCURRENCY ?? 64),
);
const LATENCY_P95_LIMIT_MS = Math.max(
  1_000,
  Number(process.env.WORST_CASE_P95_LIMIT_MS ?? 30_000),
);
const LATENCY_P99_LIMIT_MS = Math.max(
  2_000,
  Number(process.env.WORST_CASE_P99_LIMIT_MS ?? 60_000),
);
const namespace = `worst-case-${Date.now()}-${randomUUID().slice(0, 8)}`;

const ACTIONS = [
  "COMMENT_REPLY_TEXT",
  "COMMENT_REPLY_MEDIA",
  "DM_TEXT",
  "DM_IMAGE",
  "DM_VIDEO",
  "DM_VOICE",
  "DM_FORM",
  "DM_SHOWCASE",
  "DM_QUICK_REPLY",
  "STORY_REPLY_TEXT",
  "STORY_REPLY_MEDIA",
  "PUBLISH_POST_IMMEDIATE",
  "PUBLISH_REEL_IMMEDIATE",
  "PUBLISH_CAROUSEL_SCHEDULED",
  "PUBLISH_STORY_IMMEDIATE",
  "PUBLISH_STORY_SCHEDULED",
];

type TestPayload = {
  workload: string;
  tenantId: string;
  instagramAccountId: string;
  createdAt: number;
  actions: string[];
};

async function main() {
  setRedisCommandTimeoutMs(30_000);

  const health = await redisHealthCheck();
  assert(health.ok, `Redis health failed: ${health.error ?? "unknown"}`);

  const totalAccounts = TENANTS * ACCOUNTS_PER_TENANT;
  const totalJobs = totalAccounts * JOBS_PER_ACCOUNT;

  console.log(JSON.stringify({
    phase: "START",
    namespace,
    tenants: TENANTS,
    accountsPerTenant: ACCOUNTS_PER_TENANT,
    simulatedInstagramAccounts: totalAccounts,
    jobs: totalJobs,
    workerConcurrency: WORKER_CONCURRENCY,
    batchSize: BATCH_SIZE,
    actionsPerJob: ACTIONS.length,
  }, null, 2));

  const jobIds: string[] = [];
  const latencyMs: number[] = [];
  const tenantSet = new Set<string>();
  const accountSet = new Set<string>();
  const completedSet = new Set<string>();
  const actionCounts = new Map<string, number>();
  let producerBackpressureHits = 0;
  let processed = 0;
  let workerStarted = 0;

  const controller = new AbortController();

  const workerPromise = runQueueWorker(
    async (job) => {
      workerStarted += 1;

      const payload = job.payload as unknown as TestPayload;
      const start = Date.now();
      const simulatedWorkMs = Math.min(12, Math.max(2, Math.ceil(payload.actions.length / 2)));
      await sleep(simulatedWorkMs);

      for (const action of payload.actions) {
        actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
      }

      completedSet.add(job.id);
      processed += 1;
      latencyMs.push(Date.now() - payload.createdAt);

      if (start < payload.createdAt) {
        throw new Error("INVALID_TEST_CLOCK");
      }
    },
    {
      concurrency: WORKER_CONCURRENCY,
      pollIntervalMs: 50,
      queueNamespace: namespace,
      workerId: `worst-case-worker-${Date.now()}`,
      signal: controller.signal,
    },
  );

  try {
    let nextJobNumber = 0;

    while (nextJobNumber < totalJobs) {
      const batchCount = Math.min(BATCH_SIZE, totalJobs - nextJobNumber);
      const batch = [];

      for (let i = 0; i < batchCount; i++) {
        const globalIndex = nextJobNumber + i;
        const tenantIndex = globalIndex % TENANTS;
        const accountIndex = globalIndex % ACCOUNTS_PER_TENANT;
        const tenantId = `worst-tenant-${tenantIndex}`;
        const accountId = `worst-account-${tenantIndex}-${accountIndex}`;

        tenantSet.add(tenantId);
        accountSet.add(accountId);

        const payload: TestPayload = {
          workload: "WORST_CASE_FULL_INSTAGRAM",
          tenantId,
          instagramAccountId: accountId,
          createdAt: Date.now(),
          actions: [...ACTIONS],
        };

        batch.push({
          type: "TEST" as const,
          payload: { message: JSON.stringify(payload) },
          options: {
            queueNamespace: namespace,
            maxAttempts: 2,
          },
        });
      }

      let enqueued = false;

      while (!enqueued) {
        try {
          const jobs = await enqueueJobsBatch(batch);
          jobIds.push(...jobs.map((job) => job.id));
          enqueued = true;
          nextJobNumber += batchCount;
        } catch (error) {
          if (error instanceof Error && error.message.includes("QUEUE_BACKPRESSURE")) {
            producerBackpressureHits += 1;
            await sleep(100);
            continue;
          }
          throw error;
        }
      }
    }

    const drained = Date.now() + 600_000;
    while (Date.now() < drained) {
      const depth = await getQueueDepth(namespace);
      if (depth.ready === 0 && depth.delayed === 0 && depth.active === 0) break;
      await sleep(250);
    }

    const finalDepth = await getQueueDepth(namespace);

    assert(processed === totalJobs, `Lost jobs: processed=${processed}, expected=${totalJobs}`);
    assert(completedSet.size === totalJobs, "Duplicate/lost completion detected");
    assert(tenantSet.size === TENANTS, `Tenant coverage failed: ${tenantSet.size}/${TENANTS}`);
    assert(
      accountSet.size === totalAccounts,
      `Account coverage failed: ${accountSet.size}/${totalAccounts}`,
    );
    assert(finalDepth.ready === 0 && finalDepth.delayed === 0 && finalDepth.active === 0, `Queue did not drain: ${JSON.stringify(finalDepth)}`);
    assert(latencyMs.length === totalJobs, "Latency sample count does not match job count");

    const p50 = percentile(latencyMs, 50);
    const p95 = percentile(latencyMs, 95);
    const p99 = percentile(latencyMs, 99);
    const max = Math.max(...latencyMs);

    assert(p95 <= LATENCY_P95_LIMIT_MS, `P95 latency exceeded limit: ${p95}ms > ${LATENCY_P95_LIMIT_MS}ms`);
    assert(p99 <= LATENCY_P99_LIMIT_MS, `P99 latency exceeded limit: ${p99}ms > ${LATENCY_P99_LIMIT_MS}ms`);

    const requiredActions = ACTIONS.filter((action) => (actionCounts.get(action) ?? 0) === totalJobs);
    assert(requiredActions.length === ACTIONS.length, "Not every worst-case automation/publishing action was exercised for every job");

    console.log(JSON.stringify({
      success: true,
      test: "WORST_CASE_MULTI_TENANT_INSTAGRAM_STORM",
      tenants: TENANTS,
      accountsPerTenant: ACCOUNTS_PER_TENANT,
      simulatedInstagramAccounts: totalAccounts,
      jobs: totalJobs,
      workerConcurrency: WORKER_CONCURRENCY,
      producerBackpressureHits,
      workerStarted,
      processed,
      latencyMs: { p50, p95, p99, max },
      queueFinalDepth: finalDepth,
      actionCoverage: ACTIONS.map((action) => ({ action, executions: actionCounts.get(action) ?? 0 })),
      note: "Synthetic final stress test. It does not call Meta and does not prove Meta API quotas. Each queue job models a worst-case account workload containing comment reply, DM media/form/showcase, story reply, and immediate/scheduled post/reel/carousel/story actions.",
    }, null, 2));
  } finally {
    controller.abort();
    await workerPromise.catch(() => undefined);

    for (let i = 0; i < jobIds.length; i += 100) {
      await Promise.all(jobIds.slice(i, i + 100).map((id) => deleteJob(id).catch(() => undefined)));
    }

    const redis = getRedisClient();
    await Promise.all([
      redis.del(`smartdirect:queue:${namespace}:ready`).catch(() => undefined),
      redis.del(`smartdirect:queue:${namespace}:delayed`).catch(() => undefined),
      redis.del(`smartdirect:queue:${namespace}:active`).catch(() => undefined),
      redis.del(`smartdirect:queue:${namespace}:failed`).catch(() => undefined),
    ]);
  }
}

main().catch((error) => {
  console.error("Worst-case final stress test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
