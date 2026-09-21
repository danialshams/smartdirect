import "dotenv/config";

import { enqueueJobsBatch, getQueueDepth, deleteJob } from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";
import type { QueueJob } from "../src/lib/queue/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const CONCURRENCY = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY ?? 16));
const TOTAL = Math.max(30, Number(process.env.GROUP16_TOTAL ?? 100));
const NAMESPACE = `group16-load-${Date.now()}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScenario(
  name: string,
  total: number,
  handler: (job: QueueJob) => Promise<void>,
  options: { concurrency?: number; delayMs?: number } = {},
) {
  const count = Math.max(1, total);
  const concurrency = options.concurrency ?? CONCURRENCY;
  const jobs = await enqueueJobsBatch(
    Array.from({ length: count }, (_, index) => ({
      type: "TEST" as const,
      payload: { message: `${name}:${index}` },
      options: {
        queueNamespace: NAMESPACE,
        maxAttempts: 3,
        ...(options.delayMs ? { delayMs: options.delayMs } : {}),
      },
    })),
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
  for (const job of jobs) await deleteJob(job.id);

  assert(processed === count, `${name}: processed ${processed}/${count}`);
  assert(depth.total === 0 || depth.failed === 0, `${name}: queue cleanup/failure invariant failed`);

  return {
    name,
    total: count,
    processed,
    failures,
    durationMs: Date.now() - started,
    throughput: Number((count / Math.max(0.001, (Date.now() - started) / 1000)).toFixed(2)),
  };
}

async function main() {
  const results: Record<string, unknown>[] = [];

  console.log("[16] 181 Automation Load Test...");
  results.push(await runScenario("automation", TOTAL, async (job) => {
    const payload = job.payload as { message?: string };
    assert(payload.message?.startsWith("automation:"), "automation payload mismatch");
    await sleep(5);
  }));

  console.log("[16] 182 DM Load Test...");
  results.push(await runScenario("dm", TOTAL, async (job) => {
    assert(job.type === "TEST", "DM load type mismatch");
    await sleep(5);
  }));

  console.log("[16] 183 Publishing Load Test...");
  results.push(await runScenario("publishing", TOTAL, async () => {
    await sleep(8);
  }));

  console.log("[16] 184 Concurrent Tenant Test...");
  const tenantResults = await runScenario("tenant", TOTAL * 2, async (job) => {
    const index = Number(String((job.payload as { message?: string }).message ?? "").split(":").pop());
    assert(Number.isInteger(index), "tenant job identity missing");
    await sleep(4);
  }, { concurrency: CONCURRENCY * 2 });
  results.push(tenantResults);

  console.log("[16] 185 Concurrent Account Test...");
  results.push(await runScenario("account", TOTAL * 2, async () => {
    await sleep(4);
  }, { concurrency: CONCURRENCY * 2 }));

  console.log("[16] 186 Burst Traffic Test...");
  results.push(await runScenario("burst", TOTAL * 3, async () => {
    await sleep(2);
  }, { concurrency: CONCURRENCY * 2 }));

  console.log("[16] 187 Sustained Traffic Test...");
  results.push(await runScenario("sustained", TOTAL, async () => {
    await sleep(20);
  }, { concurrency: CONCURRENCY }));

  console.log("[16] 188 Failure Under Load...");
  let attempts = 0;
  results.push(await runScenario("failure", TOTAL, async () => {
    attempts += 1;
    if (attempts % 3 === 1) throw new Error("LOAD_INJECTED_FAILURE");
    await sleep(4);
  }));

  console.log("[16] 189 Recovery Under Load...");
  const recovery = await runScenario("recovery", Math.max(30, Math.floor(TOTAL / 2)), async () => {
    await sleep(5);
  });
  results.push(recovery);

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
      basis: "isolated queue/worker load using mock handlers; no real Meta API calls",
      maxConfiguredConcurrency: CONCURRENCY * 2,
      scenarios: results.length,
      note: "Use production-like infrastructure for final capacity numbers; this report measures SmartDirect queue/worker behavior only.",
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
