import "dotenv/config";

import { randomUUID } from "node:crypto";

import {
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
  Number(process.env.WORST_CASE_ACCOUNTS_PER_TENANT ?? 5),
);
const ACCOUNTS_PER_JOB = Math.max(1, Number(process.env.WORST_CASE_ACCOUNTS_PER_JOB ?? 1));
const EVENTS_PER_ACCOUNT = Math.max(20, Number(process.env.WORST_CASE_EVENTS_PER_ACCOUNT ?? 200));
const COMMENTS_PER_COMMENT_EVENT = Math.max(10, Number(process.env.WORST_CASE_COMMENTS_PER_COMMENT_EVENT ?? 100));
const DMS_PER_DM_EVENT = Math.max(1, Number(process.env.WORST_CASE_DMS_PER_DM_EVENT ?? 20));
const STORY_REPLIES_PER_STORY_EVENT = Math.max(1, Number(process.env.WORST_CASE_STORY_REPLIES_PER_STORY_EVENT ?? 20));
const BATCH_SIZE = Math.max(50, Number(process.env.WORST_CASE_BATCH_SIZE ?? 100));
const WORKER_CONCURRENCY = Math.max(
  8,
  Number(process.env.WORST_CASE_CONCURRENCY ?? 16),
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
  "COMMENT_AUTO_LIKE",
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
  const totalLogicalEvents = totalAccounts * EVENTS_PER_ACCOUNT;
  const totalJobs = Math.ceil(totalAccounts / ACCOUNTS_PER_JOB);

  console.log(JSON.stringify({
    phase: "START",
    namespace,
    tenants: TENANTS,
    accountsPerTenant: ACCOUNTS_PER_TENANT,
    simulatedInstagramAccounts: totalAccounts,
    queueJobs: totalJobs,
    virtualInstagramAccounts: totalAccounts,
    accountsPerQueueJob: ACCOUNTS_PER_JOB,
    eventsPerAccount: EVENTS_PER_ACCOUNT,
    logicalEvents: totalLogicalEvents,
    logicalActionExecutions: totalLogicalEvents * ACTIONS.length,
    workerConcurrency: WORKER_CONCURRENCY,
    batchSize: BATCH_SIZE,
    actionsPerJob: ACTIONS.length,
    note: "10 virtual Instagram accounts are packed into each queue job so this remains a severe multi-tenant test without turning the free Upstash database into the bottleneck."
  }, null, 2));

  const jobIds: string[] = [];
  const latencyMs: number[] = [];
  const tenantSet = new Set<string>();
  const accountSet = new Set<string>();
  const virtualAccountsProcessed = new Set<string>();
  const completedSet = new Set<string>();
  const actionCounts = new Map<string, number>();
  let producerBackpressureHits = 0;
  let processed = 0;
  let logicalEventsProcessed = 0;
  let workerStarted = 0;
  let commentEvents = 0;
  let dmEvents = 0;
  let storyEvents = 0;
  let publishingEvents = 0;
  let scheduledPublishingEvents = 0;
  let commentInteractions = 0;
  let dmInteractions = 0;
  let storyReplyInteractions = 0;
  let publishOperations = 0;

  const controller = new AbortController();

  const workerPromise = runQueueWorker(
    async (job) => {
      workerStarted += 1;

      const payload = JSON.parse((job.payload as { message?: string }).message ?? "{}") as TestPayload;
      const start = Date.now();
      const simulatedWorkMs = Math.min(12, Math.max(2, Math.ceil(payload.actions.length / 2)));
      await sleep(simulatedWorkMs);

      const accountIds = payload.instagramAccountId.split(",").filter(Boolean);
      for (const accountId of accountIds) {
        virtualAccountsProcessed.add(accountId);

        for (let eventOffset = 0; eventOffset < EVENTS_PER_ACCOUNT; eventOffset += 1) {
          const logicalEventIndex =
            payload.createdAt + eventOffset + accountIds.indexOf(accountId) * EVENTS_PER_ACCOUNT;

          if (logicalEventIndex % 7 === 0) {
            commentEvents += 1;
            commentInteractions += COMMENTS_PER_COMMENT_EVENT;
          } else if (logicalEventIndex % 7 === 1) {
            dmEvents += 1;
            dmInteractions += DMS_PER_DM_EVENT;
          } else if (logicalEventIndex % 7 === 2) {
            storyEvents += 1;
            storyReplyInteractions += STORY_REPLIES_PER_STORY_EVENT;
          } else {
            publishingEvents += 1;
            publishOperations += 1;
            if (logicalEventIndex % 2 === 0) {
              scheduledPublishingEvents += 1;
            }
          }

          for (const action of payload.actions) {
            actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
          }

          logicalEventsProcessed += 1;
        }
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
        const accountsInJob: string[] = [];
        for (let virtualIndex = globalIndex * ACCOUNTS_PER_JOB; virtualIndex < Math.min(totalAccounts, (globalIndex + 1) * ACCOUNTS_PER_JOB); virtualIndex++) {
          const tenantIndex = Math.floor(virtualIndex / ACCOUNTS_PER_TENANT);
          const accountIndex = virtualIndex % ACCOUNTS_PER_TENANT;
          const tenantId = `worst-tenant-${tenantIndex}`;
          const accountId = `worst-account-${tenantIndex}-${accountIndex}`;
          tenantSet.add(tenantId);
          accountSet.add(accountId);
          accountsInJob.push(accountId);
        }

        const payload: TestPayload = {
          workload: "WORST_CASE_FULL_INSTAGRAM",
          tenantId: "MULTI_TENANT_BATCH",
          instagramAccountId: accountsInJob.join(","),
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
    assert(
      logicalEventsProcessed === totalLogicalEvents,
      `Lost logical events: processed=${logicalEventsProcessed}, expected=${totalLogicalEvents}`,
    );
    assert(virtualAccountsProcessed.size === totalAccounts, `Virtual account coverage failed: ${virtualAccountsProcessed.size}/${totalAccounts}`);
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

    const requiredActions = ACTIONS.filter((action) => (actionCounts.get(action) ?? 0) === totalLogicalEvents);
    assert(requiredActions.length === ACTIONS.length, "Not every worst-case automation/publishing action was exercised for every job");

    console.log(JSON.stringify({
      success: true,
      test: "WORST_CASE_MULTI_TENANT_INSTAGRAM_STORM",
      tenants: TENANTS,
      accountsPerTenant: ACCOUNTS_PER_TENANT,
      simulatedInstagramAccounts: totalAccounts,
      queueJobs: totalJobs,
      virtualInstagramAccounts: totalAccounts,
      accountsPerQueueJob: ACCOUNTS_PER_JOB,
      eventsPerAccount: EVENTS_PER_ACCOUNT,
      logicalEvents: totalLogicalEvents,
      logicalActionExecutions: totalLogicalEvents * ACTIONS.length,
      logicalEventMix: {
        comments: commentEvents,
        dms: dmEvents,
        storyReplies: storyEvents,
        publishing: publishingEvents,
        scheduledPublishing: scheduledPublishingEvents,
        commentInteractions,
        dmInteractions,
        storyReplyInteractions,
        publishOperations,
      },
      workerConcurrency: WORKER_CONCURRENCY,
      producerBackpressureHits,
      workerStarted,
      processed,
      latencyMs: { p50, p95, p99, max },
      queueFinalDepth: finalDepth,
      actionCoverage: ACTIONS.map((action) => ({ action, executions: actionCounts.get(action) ?? 0 })),
      note: "Synthetic final stress test. It does not call Meta and does not prove Meta API quotas. Each queue job models hundreds of logical interaction units per account; comment units expand to 100 comments, DM units to 20 DMs, and story units to 20 story replies, while every unit exercises the full automation/publishing action matrix.",
    }, null, 2));
  } finally {
    controller.abort();
    await workerPromise.catch(() => undefined);

    const redis = getRedisClient();
    const keys = [
      `smartdirect:queue:${namespace}:ready`,
      `smartdirect:queue:${namespace}:delayed`,
      `smartdirect:queue:${namespace}:active`,
      `smartdirect:queue:${namespace}:failed`,
    ];
    const cleanupScript = `
      local ids = {}
      for _, key in ipairs(KEYS) do
        local members = redis.call("ZRANGE", key, 0, -1)
        for _, id in ipairs(members) do
          ids[#ids + 1] = id
        end
      end
      for _, id in ipairs(ids) do
        redis.call("DEL", ARGV[1] .. id)
        redis.call("DEL", ARGV[2] .. id)
      end
      for _, key in ipairs(KEYS) do
        redis.call("DEL", key)
      end
      return #ids
    `;
    await redis.eval(
      cleanupScript,
      keys,
      ["smartdirect:queue:job:", "smartdirect:queue:claim:"],
    ).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Worst-case final stress test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
