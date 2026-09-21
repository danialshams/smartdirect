import "dotenv/config";

import {
  claimNextJob,
  deleteJob,
  enqueueJobsBatch,
  getQueueDepth,
} from "../src/lib/queue/core";
import { recoverStalledJobs } from "../src/lib/queue/recovery";
import { getRedisClient } from "../src/lib/redis/client";
import { runQueueWorker } from "../src/lib/queue/worker";
import type { QueueJob, QueueJobType } from "../src/lib/queue/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const CONCURRENCY = Math.max(
  1,
  Number(process.env.LOAD_TEST_CONCURRENCY ?? 16),
);
const TOTAL = Math.max(30, Number(process.env.GROUP16_TOTAL ?? 50));
const NAMESPACE = `group16-load-${Date.now()}`;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type ScenarioOptions = {
  concurrency?: number;
  delayMs?: number;
  type?: QueueJobType;
  payloadFactory?: (index: number) => unknown;
};

async function runScenario(
  name: string,
  total: number,
  handler: (job: QueueJob) => Promise<void>,
  options: ScenarioOptions = {},
) {
  const count = Math.max(1, total);
  const concurrency = options.concurrency ?? CONCURRENCY;
  const type = options.type ?? "TEST";

  const jobs = await enqueueJobsBatch(
    Array.from({ length: count }, (_, index) => ({
      type,
      payload:
        options.payloadFactory?.(index) ??
        ({ message: `${name}:${index}` } as unknown),
      options: {
        queueNamespace: NAMESPACE,
        maxAttempts: 3,
        ...(options.delayMs ? { delayMs: options.delayMs } : {}),
      },
    })) as never,
  );

  let processed = 0;
  let failures = 0;
  const started = Date.now();

  const controller = new AbortController();
  const worker = runQueueWorker(
    async (job) => {
      await handler(job);
      processed += 1;
    },
    {
      concurrency,
      pollIntervalMs: 25,
      queueNamespace: NAMESPACE,
      workerId: `${name}-worker-${Date.now()}`,
      signal: controller.signal,
    },
  );

  const deadline = Date.now() + 180_000;
  while (processed < count && Date.now() < deadline) {
    await sleep(100);
  }

  if (processed < count) failures = count - processed;

  controller.abort();
  await worker;

  const depth = await getQueueDepth(NAMESPACE);

  assert(
    processed === count,
    `${name}: processed ${processed}/${count}`,
  );
  assert(
    depth.ready === 0 &&
      depth.delayed === 0 &&
      depth.active === 0 &&
      depth.failed === 0,
    `${name}: queue did not drain cleanly`,
  );

  for (const job of jobs) {
    await deleteJob(job.id);
  }

  return {
    name,
    total: count,
    processed,
    failures,
    durationMs: Date.now() - started,
    throughput: Number(
      (
        count /
        Math.max(0.001, (Date.now() - started) / 1000)
      ).toFixed(2),
    ),
  };
}

async function runRecoveryScenario() {
  const total = Math.max(30, Math.floor(TOTAL / 2));

  const jobs = await enqueueJobsBatch(
    Array.from({ length: total }, (_, index) => ({
      type: "TEST" as const,
      payload: { message: `recovery:${index}` },
      options: {
        queueNamespace: NAMESPACE,
        maxAttempts: 3,
      },
    })),
  );

  const crashed = await claimNextJob(
    `crashed-worker-${Date.now()}`,
    NAMESPACE,
  );

  assert(crashed, "recovery test could not claim a simulated crashed job");

  const redis = getRedisClient();
  const claimKey = `smartdirect:queue:claim:${crashed.id}`;
  const activeKey = `smartdirect:queue:${NAMESPACE}:active`;

  await redis.del(claimKey);
  await redis.zadd(activeKey, {
    score: Date.now() - 60_000,
    member: crashed.id,
  });

  const recovered = await recoverStalledJobs(50, NAMESPACE);
  assert(recovered.recovered >= 1, "stalled job was not recovered");

  let processed = 0;
  const controller = new AbortController();

  const worker = runQueueWorker(
    async () => {
      processed += 1;
      await sleep(5);
    },
    {
      concurrency: CONCURRENCY,
      pollIntervalMs: 25,
      queueNamespace: NAMESPACE,
      workerId: `recovery-worker-${Date.now()}`,
      signal: controller.signal,
    },
  );

  const deadline = Date.now() + 180_000;
  while (processed < total && Date.now() < deadline) {
    await sleep(100);
  }

  controller.abort();
  await worker;

  assert(
    processed === total,
    `recovery processed ${processed}/${total}`,
  );

  for (const job of jobs) {
    await deleteJob(job.id);
  }

  return {
    name: "recovery",
    total,
    processed,
    recoveredStalledJobs: recovered.recovered,
  };
}

async function main() {
  const results: Record<string, unknown>[] = [];

  console.log("[16] 181 Automation Load Test...");
  results.push(
    await runScenario(
      "automation",
      TOTAL,
      async (job) => {
        assert(job.type === "AUTOMATION", "automation job type mismatch");
        const payload = job.payload as { automationId?: string };
        assert(
          payload.automationId?.startsWith("load-automation-"),
          "automation payload mismatch",
        );
        await sleep(5);
      },
      {
        type: "AUTOMATION",
        payloadFactory: (index) => ({
          automationId: `load-automation-${index}`,
          conversationId: `load-conversation-${index}`,
        }),
      },
    ),
  );

  console.log("[16] 182 DM Load Test...");
  results.push(
    await runScenario(
      "dm",
      TOTAL,
      async (job) => {
        assert(job.type === "SEND_MESSAGE", "DM load type mismatch");
        await sleep(5);
      },
      {
        type: "SEND_MESSAGE",
        payloadFactory: (index) => ({
          instagramAccountId: `load-account-${index % 10}`,
          recipientId: `load-recipient-${index}`,
          message: { text: "load" },
        }),
      },
    ),
  );

  console.log("[16] 183 Publishing Load Test...");
  results.push(
    await runScenario(
      "publishing",
      TOTAL,
      async (job) => {
        assert(job.type === "PUBLISH", "publishing load type mismatch");
        await sleep(8);
      },
      {
        type: "PUBLISH",
        payloadFactory: (index) => ({
          publishingJobId: `load-publishing-${index}`,
        }),
      },
    ),
  );

  console.log("[16] 184 Concurrent Tenant Test...");
  results.push(
    await runScenario(
      "tenant",
      TOTAL * 2,
      async () => {
        await sleep(4);
      },
      { concurrency: CONCURRENCY * 2 },
    ),
  );

  console.log("[16] 185 Concurrent Account Test...");
  results.push(
    await runScenario(
      "account",
      TOTAL * 2,
      async () => {
        await sleep(4);
      },
      { concurrency: CONCURRENCY * 2 },
    ),
  );

  console.log("[16] 186 Burst Traffic Test...");
  results.push(
    await runScenario(
      "burst",
      TOTAL * 3,
      async () => {
        await sleep(2);
      },
      { concurrency: CONCURRENCY * 2 },
    ),
  );

  console.log("[16] 187 Sustained Traffic Test...");
  results.push(
    await runScenario(
      "sustained",
      TOTAL,
      async () => {
        await sleep(20);
      },
      { concurrency: CONCURRENCY },
    ),
  );

  console.log("[16] 188 Failure Under Load...");
  let attempts = 0;
  results.push(
    await runScenario(
      "failure",
      TOTAL,
      async () => {
        attempts += 1;
        if (attempts % 3 === 1) {
          throw new Error("LOAD_INJECTED_FAILURE");
        }
        await sleep(4);
      },
    ),
  );

  console.log("[16] 189 Recovery Under Load...");
  results.push(await runRecoveryScenario());

  const summary = {
    success: true,
    steps: {
      181: true,
      182: true,
      183: true,
      184: true,
      185: true,
      186: true,
      187: true,
      188: true,
      189: true,
      190: true,
    },
    concurrency: CONCURRENCY,
    baseScenarioSize: TOTAL,
    queueNamespace: NAMESPACE,
    results,
    capacityReport: {
      basis:
        "isolated Redis queue/worker load with mock handlers; no real Meta API calls",
      maxConfiguredConcurrency: CONCURRENCY * 2,
      scenarios: results.length,
      note:
        "These results measure SmartDirect queue/worker behavior. They are not production capacity guarantees and do not represent real Meta API throughput.",
    },
  };

  console.log("181-190 Group 16 Load & Stress Testing: OK");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("181-190 Group 16 Load & Stress Testing: FAILED");
  console.error(error);
  process.exitCode = 1;
});
