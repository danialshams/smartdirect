import "dotenv/config";

import { getMonitoringSnapshot } from "../src/lib/monitoring/health";
import {
  recordFailure,
  recordLatency,
} from "../src/lib/observability/metrics";
import {
  removeWorkerHeartbeat,
  writeWorkerHeartbeat,
} from "../src/lib/monitoring/worker";

async function main() {
  const workerId = `monitoring-test-${Date.now()}`;
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  await writeWorkerHeartbeat(workerId, {
    pid: process.pid,
    hostname: "monitoring-test",
    startedAt: Date.now(),
  });

  await recordLatency("instagram_api:all", 120);
  await recordLatency("instagram_api:all", 180);
  await recordLatency("webhook", 80);
  await recordLatency("automation", 90);
  await recordLatency("publishing", 150);
  await recordFailure("instagram_api:all", "all");
  await recordFailure("webhook", "all");
  await recordFailure("automation", "all");
  await recordFailure("publishing", "all");

  const snapshot = await getMonitoringSnapshot();

  const redisConfigured = Boolean(originalRedisUrl && originalRedisToken);
  const workerHealthy = snapshot.worker.workers.some(
    (worker) => worker.workerId === workerId && worker.status === "healthy",
  );

  const checks = {
    systemHealth: ["healthy", "degraded"].includes(snapshot.system.status),
    redisMonitoring: ["healthy", "degraded"].includes(snapshot.system.redis.status),
    queueMonitoring: ["healthy", "degraded", "down"].includes(snapshot.queue.status),
    workerMonitoring: workerHealthy,
    instagramApiMonitoring: snapshot.instagramApi.failures >= 1,
    webhookMonitoring: snapshot.webhook.failures >= 1,
    automationMonitoring: snapshot.automation.failures >= 1,
    publishingMonitoring: snapshot.publishing.failures >= 1,
    errorRateMonitoring:
      snapshot.errorRate.instagramApiFailures >= 1 &&
      snapshot.errorRate.webhookFailures >= 1,
    alertThresholds:
      process.env.MONITOR_DEGRADED_FAILURE_COUNT !== undefined
        ? Number(process.env.MONITOR_DEGRADED_FAILURE_COUNT) > 0
        : true,
    redisMode: redisConfigured,
  };

  await removeWorkerHeartbeat(workerId);

  if (!Object.values(checks).every(Boolean)) {
    console.error(
      JSON.stringify(
        {
          success: false,
          checks,
          snapshot,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log("164-174 Monitoring: OK");
  console.log(JSON.stringify({ success: true, checks, status: snapshot.status }, null, 2));
}

main().catch((error) => {
  console.error("Monitoring test failed:", error);
  process.exit(1);
});
