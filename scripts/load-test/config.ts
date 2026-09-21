import type { LoadTestConfig } from "./types";

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getLoadTestConfig(
  name: string,
  defaults: Partial<LoadTestConfig> = {},
): LoadTestConfig {
  return {
    name,
    total: positiveInt(process.env.LOAD_TEST_TOTAL, defaults.total ?? 1_000),
    concurrency: positiveInt(
      process.env.LOAD_TEST_CONCURRENCY,
      defaults.concurrency ?? 16,
    ),
    durationMs: positiveInt(
      process.env.LOAD_TEST_DURATION_MS,
      defaults.durationMs ?? 30_000,
    ),
    warmupMs: positiveInt(
      process.env.LOAD_TEST_WARMUP_MS,
      defaults.warmupMs ?? 0,
    ),
    failFast: process.env.LOAD_TEST_FAIL_FAST === "true",
  };
}
