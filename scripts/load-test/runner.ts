import type {
  LoadTestConfig,
  LoadTestResult,
  LoadTestSample,
} from "./types";
import { calculateLatency } from "./metrics";

export type LoadTestTask = (index: number) => Promise<void>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLoadTest(
  config: LoadTestConfig,
  task: LoadTestTask,
): Promise<LoadTestResult> {
  if (config.total <= 0 || config.concurrency <= 0) {
    throw new Error("LOAD_TEST_TOTAL and LOAD_TEST_CONCURRENCY must be positive.");
  }

  if (config.warmupMs) {
    await sleep(config.warmupMs);
  }

  const startedAt = Date.now();
  const deadline = startedAt + (config.durationMs ?? Number.MAX_SAFE_INTEGER);
  const samples: LoadTestSample[] = [];
  const errors: string[] = [];
  let nextIndex = 0;
  let stopScheduling = false;

  async function worker() {
    while (!stopScheduling) {
      const index = nextIndex++;

      if (index >= config.total || Date.now() > deadline) {
        return;
      }

      const sampleStartedAt = Date.now();

      try {
        await task(index);

        const completedAt = Date.now();
        samples.push({
          index,
          startedAt: sampleStartedAt,
          completedAt,
          durationMs: completedAt - sampleStartedAt,
          ok: true,
        });
      } catch (error) {
        const completedAt = Date.now();
        const message = error instanceof Error ? error.message : String(error);

        samples.push({
          index,
          startedAt: sampleStartedAt,
          completedAt,
          durationMs: completedAt - sampleStartedAt,
          ok: false,
          error: message,
        });

        errors.push(message);

        if (config.failFast) {
          stopScheduling = true;
          return;
        }
      }
    }
  }

  const workerCount = Math.min(config.concurrency, config.total);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const durationMs = Math.max(1, Date.now() - startedAt);
  const successful = samples.filter((sample) => sample.ok).length;
  const failed = samples.length - successful;
  const throughput = Number(
    (successful / (durationMs / 1_000)).toFixed(2),
  );

  return {
    name: config.name,
    status: failed === 0 ? "completed" : "failed",
    durationMs,
    total: samples.length,
    successful,
    failed,
    throughput,
    latency: calculateLatency(samples),
    errors: [...new Set(errors)].slice(0, 20),
  };
}
