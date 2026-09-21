import {
  claimNextJob,
  completeJob,
  failJob,
} from "./core";
import { claimIdempotency } from "../idempotency/store";
import type { QueueJob } from "./types";

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

  const runOne = async () => {
    const job = await claimNextJob(workerId);

    if (!job) {
      return;
    }

    try {
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
      await completeJob(job.id);
    } catch (error) {
      await failJob(job.id, error);
    }
  };

  while (!stopped) {
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
}
