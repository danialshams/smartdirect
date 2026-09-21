import { createQueueRedis } from "@/lib/queue/core";

const PREFIX = "smartdirect:observability:v1";
const LATENCY_SAMPLE_LIMIT = 1000;
const LATENCY_TTL_SECONDS = 60 * 60;
const FAILURE_TTL_SECONDS = 24 * 60 * 60;

export type ObservabilityMetricBackend = "redis" | "memory";

type MemoryMetricState = {
  latencies: Map<string, number[]>;
  failures: Map<string, number>;
};

const memoryState: MemoryMetricState = {
  latencies: new Map(),
  failures: new Map(),
};

function isRedisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function addMemoryLatency(operation: string, latencyMs: number) {
  const values = memoryState.latencies.get(operation) ?? [];
  values.push(Math.round(latencyMs));
  if (values.length > LATENCY_SAMPLE_LIMIT) {
    values.splice(0, values.length - LATENCY_SAMPLE_LIMIT);
  }
  memoryState.latencies.set(operation, values);
}

function addMemoryFailure(operation: string, errorType: string) {
  const key = `${operation}:${errorType}`;
  memoryState.failures.set(key, (memoryState.failures.get(key) ?? 0) + 1);
}


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

  addMemoryLatency(operation, latencyMs);

  const aggregateOperation =
    operation.startsWith("instagram_api:") && operation !== "instagram_api:all"
      ? "instagram_api:all"
      : null;

  if (aggregateOperation) {
    addMemoryLatency(aggregateOperation, latencyMs);
  }

  if (!isRedisConfigured()) {
    return;
  }

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

    if (aggregateOperation) {
      const aggregateKey = latencyKey(aggregateOperation);
      await redis.lpush(aggregateKey, sample);
      await redis.ltrim(aggregateKey, 0, LATENCY_SAMPLE_LIMIT - 1);
      await redis.expire(aggregateKey, LATENCY_TTL_SECONDS);
    }
  } catch (error) {
    addMemoryLatency(operation, latencyMs);
    console.error(
      JSON.stringify({
        event: "observability:latency-record-failed",
        operation,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function recordFailure(operation: string, errorType = "unknown") {
  addMemoryFailure(operation, errorType);

  const aggregateOperation =
    operation.startsWith("instagram_api:") && operation !== "instagram_api:all"
      ? "instagram_api:all"
      : null;

  if (aggregateOperation) {
    addMemoryFailure(aggregateOperation, errorType);
    addMemoryFailure(aggregateOperation, "all");
  }

  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = createQueueRedis();
    const key = failureKey(`${operation}:${errorType}`);

    await redis.incr(key);
    await redis.expire(key, FAILURE_TTL_SECONDS);

    if (aggregateOperation) {
      const aggregateKey = failureKey(`${aggregateOperation}:${errorType}`);
      const aggregateAllKey = failureKey(`${aggregateOperation}:all`);
      await redis.incr(aggregateKey);
      await redis.expire(aggregateKey, FAILURE_TTL_SECONDS);
      await redis.incr(aggregateAllKey);
      await redis.expire(aggregateAllKey, FAILURE_TTL_SECONDS);
    }
  } catch (error) {
    addMemoryFailure(operation, errorType);
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
  if (!isRedisConfigured()) {
    const values = memoryState.latencies.get(operation) ?? [];
    return {
      operation,
      sampleCount: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
      backend: "memory" as const,
    };
  }

  try {
    const redis = createQueueRedis();
    const rows = await redis.lrange(latencyKey(operation), 0, LATENCY_SAMPLE_LIMIT - 1);
    const redisValues = rows
      .map((row) => {
        try {
          const parsed = JSON.parse(row) as { latencyMs?: number };
          return typeof parsed.latencyMs === "number" ? parsed.latencyMs : null;
        } catch {
          return null;
        }
      })
      .filter((value): value is number => value !== null);

    const values =
      redisValues.length > 0
        ? redisValues
        : memoryState.latencies.get(operation) ?? [];

    return {
      operation,
      sampleCount: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
      backend: redisValues.length > 0 ? ("redis" as const) : ("memory" as const),
    };
  } catch (error) {
    const values = memoryState.latencies.get(operation) ?? [];

    return {
      operation,
      sampleCount: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
      error: error instanceof Error ? error.message : String(error),
      backend: "memory" as const,
    };
  }
}

export async function getFailureCount(operation: string, errorType = "unknown") {
  if (!isRedisConfigured()) {
    return memoryState.failures.get(`${operation}:${errorType}`) ?? 0;
  }

  try {
    const redis = createQueueRedis();
    const value = await redis.get<number>(
      failureKey(`${operation}:${errorType}`),
    );

    return Number(value ?? 0);
  } catch {
    return memoryState.failures.get(`${operation}:${errorType}`) ?? 0;
  }
}
