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
  startJobClaimHeartbeat,
} from "../src/lib/queue/core";
import { recoverStalledJobs } from "../src/lib/queue/recovery";
import { setRedisCommandTimeoutMs } from "../src/lib/redis/client";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const ns = `group21-${Date.now()}`;
  const redis = createQueueRedis();
  const results = {
    atLeastOnceDelivery: false,
    stalledDetection: false,
    jobTimeoutWatchdog: false,
    jobCancellation: false,
    backpressure: false,
    starvationPrevention: false,
    jobRecovery: false,
    redisFailureHandling: false,
    workerCrashRecovery: false,
    stalledJobRecovery: false,
  };
  const jobs: string[] = [];
  const originalTimeout = process.env.REDIS_COMMAND_TIMEOUT_MS;

  try {
    const first = await enqueueJob("TEST", { message: "at-least-once" }, {
      queueNamespace: ns,
      maxAttempts: 3,
    });
    jobs.push(first.id);
    const claimed = await claimNextJob("group21-worker-a", ns);
    assert(claimed?.id === first.id && claimed.status === "active", "Initial claim failed");
    const secondClaim = await claimNextJob("group21-worker-b", ns);
    assert(secondClaim === null, "Active job was claimed twice");
    results.atLeastOnceDelivery = true;

    await redis.del(`smartdirect:queue:claim:${first.id}`);
    await redis.zadd(`smartdirect:queue:${ns}:active`, {
      score: Date.now() - 60_000,
      member: first.id,
    });
    const recovered = await recoverStalledJobs(10, ns);
    assert(recovered.recovered === 1, "Stalled job was not recovered");
    const recoveredJob = await getJob(first.id);
    assert(recoveredJob?.status === "waiting", "Recovered job is not waiting");
    await deleteJob(first.id);
    jobs.splice(jobs.indexOf(first.id), 1);
    results.stalledDetection = true;
    results.workerCrashRecovery = true;
    results.jobRecovery = true;
    results.stalledJobRecovery = true;

    const cancelTarget = await enqueueJob("TEST", { message: "cancel" }, { queueNamespace: ns });
    jobs.push(cancelTarget.id);
    const cancelled = await cancelJob(cancelTarget.id);
    assert(cancelled?.status === "cancelled", "Waiting job cancellation failed");
    results.jobCancellation = true;

    const oldMax = process.env.QUEUE_MAX_DEPTH;
    process.env.QUEUE_MAX_DEPTH = "2";
    const admission = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        enqueueJob("TEST", { message: `backpressure-${i}` }, { queueNamespace: ns }),
      ),
    );
    const fulfilled = admission.filter((x) => x.status === "fulfilled");
    const rejected = admission.filter(
      (x): x is PromiseRejectedResult =>
        x.status === "rejected" && String(x.reason).includes("QUEUE_BACKPRESSURE"),
    );
    for (const item of fulfilled) jobs.push((item as PromiseFulfilledResult<any>).value.id);
    assert(fulfilled.length <= 2 && rejected.length >= 1, "Atomic backpressure admission failed");
    results.backpressure = true;
    process.env.QUEUE_MAX_DEPTH = oldMax;
    for (const item of fulfilled) {
      await deleteJob((item as PromiseFulfilledResult<any>).value.id);
    }

    const low = await enqueueJob("TEST", { message: "old-low" }, {
      queueNamespace: ns,
      priority: "low",
    });
    jobs.push(low.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const high = await enqueueJob("TEST", { message: "new-high" }, {
      queueNamespace: ns,
      priority: "high",
    });
    jobs.push(high.id);
    const firstPriorityClaim = await claimNextJob("group21-fairness", ns);
    assert(firstPriorityClaim?.id === low.id, "Older low-priority job starved behind newer high-priority job");
    results.starvationPrevention = true;
    await completeJob(low.id);
    await deleteJob(high.id);
    jobs.splice(jobs.indexOf(high.id), 1);

    process.env.QUEUE_CLAIM_TTL_SECONDS = "10";
    const timeoutTarget = await enqueueJob("TEST", { message: "timeout-watchdog" }, {
      queueNamespace: ns,
      maxAttempts: 2,
    });
    jobs.push(timeoutTarget.id);
    const timeoutClaim = await claimNextJob("group21-timeout", ns);
    assert(timeoutClaim?.id === timeoutTarget.id, "Timeout target claim failed");
    const stopHeartbeat = startJobClaimHeartbeat(timeoutTarget.id, "group21-timeout", 1_100);
    await new Promise((resolve) => setTimeout(resolve, 1_600));
    stopHeartbeat();
    const claimBeforeWait = await redis.ttl(`smartdirect:queue:claim:${timeoutTarget.id}`);
    assert(claimBeforeWait >= 1 && claimBeforeWait <= 10, `Unexpected claim TTL after watchdog stop: ${claimBeforeWait}`);
    await new Promise((resolve) => setTimeout(resolve, 10_500));
    const claimAfterTimeout = await redis.get(`smartdirect:queue:claim:${timeoutTarget.id}`);
    assert(claimAfterTimeout === null, "Job timeout watchdog did not allow the claim to expire");
    await redis.zadd(`smartdirect:queue:${ns}:active`, {
      score: Date.now() - 60_000,
      member: timeoutTarget.id,
    });
    const timeoutRecovery = await recoverStalledJobs(10, ns);
    assert(timeoutRecovery.recovered === 1, "Job timeout watchdog did not make the job recoverable");
    results.jobTimeoutWatchdog = true;

    setRedisCommandTimeoutMs(1);
    let failed = false;
    try {
      await redis.ping();
    } catch {
      failed = true;
    } finally {
      setRedisCommandTimeoutMs(Number(originalTimeout ?? 5000));
    }
    assert(failed, "Redis failure injection did not produce a timeout");
    assert((await redis.ping()) === "PONG", "Redis did not recover after failure injection");
    results.redisFailureHandling = true;

    console.log(JSON.stringify({
      success: Object.values(results).every(Boolean),
      tests: results,
      namespace: ns,
    }, null, 2));
  } finally {
    delete process.env.QUEUE_CLAIM_TTL_SECONDS;
    delete process.env.QUEUE_MAX_DEPTH;
    setRedisCommandTimeoutMs(Number(originalTimeout ?? 5000));
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
