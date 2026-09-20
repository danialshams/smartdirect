import "dotenv/config";

import { Redis } from "@upstash/redis";

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured",
    );
  }

  const redis = new Redis({
    url,
    token,
  });

  const startedAt = Date.now();

  const response = await redis.ping();

  const latencyMs = Date.now() - startedAt;

  console.log(
    JSON.stringify(
      {
        service: "redis-local",
        ok: response === "PONG",
        configured: true,
        latencyMs,
        status: response === "PONG" ? "ready" : "error",
        response,
      },
      null,
      2,
    ),
  );

  if (response !== "PONG") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        service: "redis-local",
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
