import "dotenv/config";

import {
  claimNextJob,
  completeJob,
  deleteJob,
  enqueueJob,
  getJob,
} from "../src/lib/queue/core";
import { acquireLock, releaseLock } from "../src/lib/lock/redis-lock";
import type { DistributedLockHandle } from "../src/lib/lock/types";
import { createQueueRedis } from "../src/lib/queue/core";

const STEP_TIMEOUT_MS = 10_000;

async function withTimeout<T>(name: string, promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`PIPELINE_SMOKE_TIMEOUT:${name} exceeded ${STEP_TIMEOUT_MS}ms.`));
      }, STEP_TIMEOUT_MS);
    }),
  ]);
}

async function main() {
  const message = `worker-pipeline-smoke-${Date.now()}-${crypto.randomUUID()}`;
  let jobId: string | undefined;
  let lockHandle: DistributedLockHandle | undefined;

  const step = async <T>(name: string, fn: () => Promise<T>) => {
    const startedAt = Date.now();
    console.log(JSON.stringify({ step: `${name}:start` }));
    const result = await withTimeout(name, fn());
    console.log(
      JSON.stringify({
        step: `${name}:done`,
        durationMs: Date.now() - startedAt,
      }),
    );
    return result;
  };

  try {
    const job = await step("enqueue", () =>
      enqueueJob(
        "TEST",
        { message },
        {
          priority: "critical",
          maxAttempts: 1,
        },
      ),
    );

    jobId = job.id;

    // The queue may contain old test jobs. Move only this smoke-test job to the
    // front so claimNextJob() is guaranteed to exercise this exact job.
    const redis = createQueueRedis();
    await redis.zadd("smartdirect:queue:default:ready", {
      score: 0,
      member: job.id,
    });

    const claimed = await step("claim", () => claimNextJob("worker-pipeline-smoke"));

    if (!claimed || claimed.id !== job.id) {
      throw new Error(
        `PIPELINE_SMOKE_CLAIM_MISMATCH: expected ${job.id}, got ${claimed?.id ?? "null"}.`,
      );
    }

    const lock = await step("acquire-lock", () =>
      acquireLock({
        scope: "job",
        resourceId: claimed.id,
      }),
    );

    if (!lock.acquired) {
      throw new Error("PIPELINE_SMOKE_LOCK_FAILED");
    }

    lockHandle = lock.handle;

    await step("handler", async () => {
      await Promise.resolve();
    });

    const completed = await step("complete", () => completeJob(claimed.id));

    if (completed?.status !== "completed") {
      throw new Error(
        `PIPELINE_SMOKE_COMPLETE_FAILED: got ${completed?.status ?? "missing"}.`,
      );
    }

    await step("release-lock", async () => {
      if (!lockHandle) return;
      const released = await releaseLock(lockHandle);

      if (!released) {
        throw new Error("PIPELINE_SMOKE_RELEASE_FAILED");
      }

      lockHandle = undefined;
    });

    const finalJob = await step("final-read", () => getJob(job.id));

    console.log(
      JSON.stringify(
        {
          result: "ok",
          jobId: job.id,
          status: finalJob?.status ?? "missing",
        },
        null,
        2,
      ),
    );

    if (finalJob?.status !== "completed") {
      throw new Error(
        `PIPELINE_SMOKE_FINAL_STATE_FAILED: got ${finalJob?.status ?? "missing"}.`,
      );
    }

    console.log("Worker Pipeline Smoke Test: OK");
  } finally {
    if (lockHandle) {
      await releaseLock(lockHandle).catch(() => undefined);
    }

    if (jobId) {
      await deleteJob(jobId).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
