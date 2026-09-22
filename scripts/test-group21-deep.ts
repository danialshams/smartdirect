import "dotenv/config";

import {
  cancelJob,
  claimNextJob,
  completeJob,
  createQueueRedis,
  deleteJob,
  enqueueJob,
  getJob,
  getQueueDepth,
  promoteDueJobs,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";
import { recoverStalledJobs } from "../src/lib/queue/recovery";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 50,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function main() {
  const ns = `group21-deep-${Date.now()}`;
  const redis = createQueueRedis();
  const jobs: string[] = [];
  const results = {
    realWorkerCancellation: false,
    activeDepthBackpressure: false,
    delayedDepthBackpressure: false,
    atLeastOnceWorkerRecovery: false,
    retryAfterWorkerFailure: false,
    starvationUnderBurst: false,
  };

  try {
    // 1) Real worker cancellation:
    // The handler is genuinely active when the job is cancelled. The worker
    // must not turn the cancelled job into completed after the handler returns.
    const cancelTarget = await enqueueJob(
      "TEST",
      { message: "deep-active-cancellation" },
      { queueNamespace: ns, maxAttempts: 2 },
    );
    jobs.push(cancelTarget.id);

    const handlerStarted = { value: false };
    const handlerRelease = { value: false };
    const controller = new AbortController();

    const workerPromise = runQueueWorker(
      async (job) => {
        if (job.id !== cancelTarget.id) return;
        handlerStarted.value = true;
        while (!handlerRelease.value) await sleep(50);
      },
      {
        concurrency: 1,
        pollIntervalMs: 100,
        workerId: "group21-deep-cancel-worker",
        queueNamespace: ns,
        signal: controller.signal,
      },
    );

    assert(
      await waitFor(async () => handlerStarted.value, 3_000),
      "Real worker did not start the cancellation target",
    );
    const cancelled = await cancelJob(cancelTarget.id);
    assert(cancelled?.status === "cancelled", "Active worker cancellation failed");
    handlerRelease.value = true;
    assert(
      await waitFor(async () => (await getJob(cancelTarget.id))?.status === "cancelled", 3_000),
      "Cancelled active job was changed after handler returned",
    );
    controller.abort();
    await workerPromise;
    results.realWorkerCancellation = true;

    // 2) Backpressure must count delayed + active + ready, not only ready.
    const oldMaxDepth = process.env.QUEUE_MAX_DEPTH;
    process.env.QUEUE_MAX_DEPTH = "3";

    const activeTarget = await enqueueJob(
      "TEST",
      { message: "depth-active" },
      { queueNamespace: ns },
    );
    jobs.push(activeTarget.id);
    const activeClaim = await claimNextJob("group21-depth-worker", ns);
    assert(activeClaim?.id === activeTarget.id, "Depth active target was not claimed");

    const delayedTarget = await enqueueJob(
      "TEST",
      { message: "depth-delayed" },
      { queueNamespace: ns, delayMs: 60_000 },
    );
    jobs.push(delayedTarget.id);

    const readyTarget = await enqueueJob(
      "TEST",
      { message: "depth-ready" },
      { queueNamespace: ns },
    );
    jobs.push(readyTarget.id);

    const depthBeforeReject = await getQueueDepth(ns);
    assert(
      depthBeforeReject.active === 1 &&
        depthBeforeReject.delayed === 1 &&
        depthBeforeReject.ready === 1,
      "Queue depth accounting did not include active, delayed and ready jobs",
    );

    let rejected = false;
    try {
      await enqueueJob(
        "TEST",
        { message: "depth-overflow" },
        { queueNamespace: ns },
      );
    } catch (error) {
      rejected = String(error).includes("QUEUE_BACKPRESSURE");
    }
    assert(rejected, "Backpressure ignored active + delayed + ready depth");
    results.activeDepthBackpressure = true;
    results.delayedDepthBackpressure = true;

    process.env.QUEUE_MAX_DEPTH = oldMaxDepth;
    await completeJob(activeTarget.id);
    await deleteJob(delayedTarget.id);
    await deleteJob(readyTarget.id);
    jobs.splice(jobs.indexOf(activeTarget.id), 1);
    jobs.splice(jobs.indexOf(delayedTarget.id), 1);
    jobs.splice(jobs.indexOf(readyTarget.id), 1);

    // 3) Worker-level recovery:
    // A job is claimed, its claim is lost, recovery requeues it, and a real
    // worker executes the recovered job.
    const recoveryTarget = await enqueueJob(
      "TEST",
      { message: "deep-worker-recovery" },
      { queueNamespace: ns, maxAttempts: 3 },
    );
    jobs.push(recoveryTarget.id);
    const recoveryClaim = await claimNextJob("group21-crashed-worker", ns);
    assert(recoveryClaim?.id === recoveryTarget.id, "Recovery target claim failed");

    await redis.del(`smartdirect:queue:claim:${recoveryTarget.id}`);
    await redis.zadd(`smartdirect:queue:${ns}:active`, {
      score: Date.now() - 60_000,
      member: recoveryTarget.id,
    });

    const recovered = await recoverStalledJobs(10, ns);
    assert(recovered.recovered === 1, "Worker crash recovery did not requeue the job");

    let executions = 0;
    const recoveryController = new AbortController();
    const recoveryWorker = runQueueWorker(
      async (job) => {
        if (job.id === recoveryTarget.id) executions++;
      },
      {
        concurrency: 1,
        pollIntervalMs: 100,
        workerId: "group21-recovery-worker",
        queueNamespace: ns,
        signal: recoveryController.signal,
      },
    );

    assert(
      await waitFor(async () => (await getJob(recoveryTarget.id))?.status === "completed", 3_000),
      "Recovered job was not executed by a real worker",
    );
    assert(executions === 1, `Recovered job executed ${executions} times`);
    recoveryController.abort();
    await recoveryWorker;
    results.atLeastOnceWorkerRecovery = true;

    // 4) Retry after a real worker handler failure.
    // The first execution fails; failJob must schedule a retry and the second
    // execution must complete it.
    const retryTarget = await enqueueJob(
      "TEST",
      { message: "deep-worker-retry" },
      { queueNamespace: ns, maxAttempts: 2 },
    );
    jobs.push(retryTarget.id);

    let retryExecutions = 0;
    const retryController = new AbortController();
    const retryWorker = runQueueWorker(
      async (job) => {
        if (job.id !== retryTarget.id) return;
        retryExecutions++;
        if (retryExecutions === 1) {
          throw new Error("intentional-group21-worker-failure");
        }
      },
      {
        concurrency: 1,
        pollIntervalMs: 100,
        workerId: "group21-retry-worker",
        queueNamespace: ns,
        signal: retryController.signal,
      },
    );

    assert(
      await waitFor(async () => (await getJob(retryTarget.id))?.status === "completed", 5_000),
      "Worker failure did not produce a successful retry",
    );
    assert(retryExecutions === 2, `Expected 2 worker executions, got ${retryExecutions}`);
    retryController.abort();
    await retryWorker;
    results.retryAfterWorkerFailure = true;

    // 5) Starvation under a high-priority burst:
    // An older low-priority job must still be selected before newer arrivals.
    const oldLow = await enqueueJob(
      "TEST",
      { message: "deep-old-low" },
      { queueNamespace: ns, priority: "low" },
    );
    jobs.push(oldLow.id);

    const burst = [];
    for (let i = 0; i < 8; i++) {
      burst.push(
        await enqueueJob(
          "TEST",
          { message: `deep-high-${i}` },
          { queueNamespace: ns, priority: "high" },
        ),
      );
      jobs.push(burst[i].id);
    }

    const starvationClaim = await claimNextJob("group21-starvation-worker", ns);
    assert(
      starvationClaim?.id === oldLow.id,
      "Old low-priority job was starved by a newer high-priority burst",
    );
    await completeJob(oldLow.id);
    results.starvationUnderBurst = true;

    console.log(
      JSON.stringify(
        {
          success: Object.values(results).every(Boolean),
          tests: results,
          namespace: ns,
          note: "Targeted worker-level reliability test; intentionally small Redis footprint.",
        },
        null,
        2,
      ),
    );
  } finally {
    delete process.env.QUEUE_MAX_DEPTH;
    for (const id of jobs) await deleteJob(id).catch(() => undefined);
    await redis.del(`smartdirect:queue:${ns}:ready`);
    await redis.del(`smartdirect:queue:${ns}:delayed`);
    await redis.del(`smartdirect:queue:${ns}:active`);
    await redis.del(`smartdirect:queue:${ns}:failed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
