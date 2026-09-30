import { redisHealthCheck } from "../src/lib/redis/client";

async function main() {
  const health = await redisHealthCheck();

  console.log(
    JSON.stringify(
      {
        service: health.driver === "redis" ? "redis-local" : "redis-upstash",
        ok: health.ok,
        configured: health.configured,
        latencyMs: health.latencyMs,
        status: health.status,
        response: health.ok ? "PONG" : undefined,
        driver: health.driver,
        error: health.error,
      },
      null,
      2,
    ),
  );

  if (!health.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        service: "redis",
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );

  process.exitCode = 1;
});
