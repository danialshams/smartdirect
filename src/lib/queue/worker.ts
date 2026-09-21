import {
  claimNextJob,
  completeJob,
  failJob,
} from "./core";
import {
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
} from "../idempotency/store";
import { acquireLock, releaseLock } from "../lock/redis-lock";
import type { DistributedLockHandle } from "../lock/types";
import type { QueueJob } from "./types";
import { recoverStalledJobs } from "./recovery";
import { enterObservabilityContext } from "@/lib/observability/context";
import { observabilityLogger } from "@/lib/observability/logger";
import { recordFailure } from "@/lib/observability/metrics";
import { startWorkerHeartbeat } from "@/lib/monitoring/worker";

export interface QueueWorkerOptions {
  concurrency?: number;
  pollIntervalMs?: number;
  workerId?: string;
  signal?: AbortSignal;
}

export type QueueJobHandler = (job: QueueJob) => Promise<void>;

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

export async function runQueueWorker(
  handler: QueueJobHandler,
  options: QueueWorkerOptions = {},
) {
  const concurrency = Math.max(
    1,
    Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY),
  );
  const pollIntervalMs = Math.max(
    100,
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
  );
  const workerId =
    options.workerId ?? `worker_${process.pid}_${Date.now()}`;

  let stopped = false;
  let lastRecoveryAt = 0;
  const recoveryIntervalMs = Math.max(5_000, Number(process.env.QUEUE_RECOVERY_INTERVAL_MS ?? 10_000));

  const stop = () => {
    stopped = true;
  };

  if (options.signal) {
    if (options.signal.aborted) {
      return;
    }
    options.signal.addEventListener("abort", stop, { once: true });
  }

  const active = new Set<Promise<void>>();
  const stopHeartbeat = startWorkerHeartbeat(workerId, {
    pid: process.pid,
    hostname: process.env.HOSTNAME,
  });

  if (options.signal) {
    options.signal.addEventListener(
      "abort",
      () => {
        void stopHeartbeat();
      },
      { once: true },
    );
  }

  const runOne = async () => {
    let job: QueueJob | null = null;

    try {
      job = await claimNextJob(workerId);
    } catch (error) {
      observabilityLogger.error("queue_claim_failed", {
        workerId,
        error: error instanceof Error ? error.message : String(error),
      });
      void recordFailure("queue_claim", "claim_next_job");
      throw error;
    }

    if (!job) {
      return;
    }

    enterObservabilityContext({ jobId: job.id });

    let lockHandle: DistributedLockHandle | undefined;

    try {
      const lock = await acquireLock({
        scope: "job",
        resourceId: job.id,
      });

      if (!lock.acquired) {
        throw new Error(`Distributed lock is already held for job ${job.id}.`);
      }

      lockHandle = lock.handle;

      if (job.idempotency) {
        const claim = await claimIdempotency({
          key: job.idempotency.key,
          tenantId: job.idempotency.tenantId,
          operation: job.idempotency.operation,
          resourceId: job.idempotency.resourceId,
        });

        if (!claim.claimed) {
          await completeJob(job.id);
          return;
        }
      }

      await handler(job);

      if (job.idempotency) {
        await completeIdempotency(job.idempotency.key, { jobId: job.id });
      }

      await completeJob(job.id);
    } catch (error) {
      observabilityLogger.error("queue_job_failed", {
        type: job.type,
        attempt: job.attempts,
        error: error instanceof Error ? error.message : String(error),
      });
      void recordFailure("queue_job", job.type);

      if (job.idempotency) {
        try {
          await failIdempotency(
            job.idempotency.key,
            error instanceof Error ? error.message : String(error),
          );
        } catch (idempotencyError) {
          observabilityLogger.error("queue_idempotency_failure_marking_error", {
          error: idempotencyError instanceof Error ? idempotencyError.message : String(idempotencyError),
        });
        }
      }

      await failJob(job.id, error);
    } finally {
      if (lockHandle) {
        await releaseLock(lockHandle);
      }
    }
  };

  while (!stopped) {
    if (Date.now() - lastRecoveryAt >= recoveryIntervalMs) {
      lastRecoveryAt = Date.now();
      try {
        await recoverStalledJobs();
      } catch (error) {
        observabilityLogger.error("queue_recovery_error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    while (!stopped && active.size < concurrency) {
      const task = runOne().finally(() => active.delete(task));
      active.add(task);
      await Promise.resolve();
    }

    if (active.size > 0) {
      await Promise.race(active);
    } else {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  await Promise.all(active);
  await stopHeartbeat();
}
