import { prisma } from "@/lib/prisma";
import { createQueueRedis, getQueueDepth } from "@/lib/queue/core";
import {
  getFailureCount,
  getLatencyPercentiles,
} from "@/lib/observability/metrics";
import { getWorkerHeartbeats } from "@/lib/monitoring/worker";

export type MonitoringStatus = "healthy" | "degraded" | "down";

async function checkDatabase() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "healthy" as const, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: "down" as const,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkRedis() {
  const startedAt = Date.now();
  try {
    const redis = createQueueRedis();
    await redis.ping();
    return { status: "healthy" as const, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: "down" as const,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function statusFromChecks(
  checks: Array<"healthy" | "degraded" | "down">,
): MonitoringStatus {
  if (checks.includes("down")) return "down";
  if (checks.includes("degraded")) return "degraded";
  return "healthy";
}

async function getWorkerMonitoring() {
  try {
    const heartbeats = await getWorkerHeartbeats();
    const now = Date.now();
    const staleAfterMs = Math.max(
      15_000,
      Number(process.env.WORKER_HEARTBEAT_STALE_MS ?? 30_000),
    );
    const workers = heartbeats.map((worker) => ({
      ...worker,
      ageMs: Math.max(0, now - worker.lastHeartbeatAt),
      status:
        now - worker.lastHeartbeatAt <= staleAfterMs
          ? ("healthy" as const)
          : ("degraded" as const),
    }));

    return {
      status: workers.some((worker) => worker.status === "healthy")
        ? ("healthy" as const)
        : ("degraded" as const),
      count: workers.length,
      workers,
    };
  } catch (error) {
    return {
      status: "down" as const,
      count: 0,
      workers: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getQueueMonitoring() {
  try {
    const depth = await getQueueDepth();
    const degradedDepth = Math.max(
      100,
      Number(process.env.QUEUE_MONITOR_DEGRADED_DEPTH ?? 100),
    );
    const downDepth = Math.max(
      degradedDepth + 1,
      Number(process.env.QUEUE_MONITOR_DOWN_DEPTH ?? 1000),
    );

    return {
      status:
        depth.total >= downDepth
          ? ("down" as const)
          : depth.total >= degradedDepth
            ? ("degraded" as const)
            : ("healthy" as const),
      ...depth,
    };
  } catch (error) {
    return {
      status: "down" as const,
      ready: 0,
      delayed: 0,
      active: 0,
      failed: 0,
      total: 0,
      queue: "default",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getMetricMonitoring(operation: string) {
  try {
    const [latency, failures] = await Promise.all([
      getLatencyPercentiles(operation),
      getFailureCount(operation, "all"),
    ]);

    const degradedFailureCount = Math.max(
      10,
      Number(process.env.MONITOR_DEGRADED_FAILURE_COUNT ?? 10),
    );
    const downFailureCount = Math.max(
      degradedFailureCount + 1,
      Number(process.env.MONITOR_DOWN_FAILURE_COUNT ?? 100),
    );

    return {
      status:
        failures >= downFailureCount
          ? ("down" as const)
          : failures >= degradedFailureCount
            ? ("degraded" as const)
            : ("healthy" as const),
      failures,
      latency,
    };
  } catch (error) {
    return {
      status: "degraded" as const,
      failures: 0,
      latency: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getMonitoringSnapshot() {
  const startedAt = Date.now();

  const [database, redis, queue, workers, instagramApi, webhook, automation, publishing] =
    await Promise.all([
      checkDatabase(),
      checkRedis(),
      getQueueMonitoring(),
      getWorkerMonitoring(),
      getMetricMonitoring("instagram_api:all"),
      getMetricMonitoring("webhook"),
      getMetricMonitoring("automation"),
      getMetricMonitoring("publishing"),
    ]);

  const overall = statusFromChecks([
    database.status,
    redis.status,
    queue.status,
    workers.status,
    instagramApi.status,
    webhook.status,
    automation.status,
    publishing.status,
  ]);

  return {
    status: overall,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    system: {
      status: statusFromChecks([database.status, redis.status]),
      database,
      redis,
    },
    queue,
    worker: workers,
    instagramApi,
    webhook,
    automation,
    publishing,
    errorRate: {
      instagramApiFailures: instagramApi.failures,
      webhookFailures: webhook.failures,
      automationFailures: automation.failures,
      publishingFailures: publishing.failures,
    },
  };
}
