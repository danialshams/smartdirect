import { createQueueRedis } from "@/lib/queue/core";

const PREFIX = "smartdirect:observability:v1";
const LATENCY_SAMPLE_LIMIT = 1000;
const LATENCY_TTL_SECONDS = 60 * 60;
const FAILURE_TTL_SECONDS = 24 * 60 * 60;

function safeMetricPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120);
}

function latencyKey(operation: string) {
  return `${PREFIX}:latency:${safeMetricPart(operation)}`;
}

function failureKey(operation: string) {
  return `${PREFIX}:failure:${safeMetricPart(operation)}`;
}

export async function recordLatency(operation: string, latencyMs: number) {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return;

  try {
    const redis = createQueueRedis();
    const key = latencyKey(operation);
    const sample = JSON.stringify({
      latencyMs: Math.round(latencyMs),
      timestamp: Date.now(),
    });

    await redis.lpush(key, sample);
    await redis.ltrim(key, 0, LATENCY_SAMPLE_LIMIT - 1);
    await redis.expire(key, LATENCY_TTL_SECONDS);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "observability:latency-record-failed",
        operation,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function recordFailure(operation: string, errorType?: string) {
  try {
    const redis = createQueueRedis();
    const key = failureKey(`${operation}:${errorType ?? "unknown"}`);

    await redis.incr(key);
    await redis.expire(key, FAILURE_TTL_SECONDS);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "observability:failure-record-failed",
        operation,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;

  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
}

export async function getLatencyPercentiles(operation: string) {
  try {
    const redis = createQueueRedis();
    const rows = await redis.lrange<string[]>(latencyKey(operation), 0, LATENCY_SAMPLE_LIMIT - 1);
    const values = rows
      .map((row) => {
        try {
          const parsed = JSON.parse(row) as { latencyMs?: number };
          return typeof parsed.latencyMs === "number" ? parsed.latencyMs : null;
        } catch {
          return null;
        }
      })
      .filter((value): value is number => value !== null);

    return {
      operation,
      sampleCount: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
    };
  } catch (error) {
    return {
      operation,
      sampleCount: 0,
      p50: null,
      p95: null,
      p99: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getFailureCount(operation: string, errorType = "unknown") {
  try {
    const redis = createQueueRedis();
    const value = await redis.get<number>(
      failureKey(`${operation}:${errorType}`),
    );

    return Number(value ?? 0);
  } catch {
    return 0;
  }
}
