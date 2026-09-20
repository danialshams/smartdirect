import "server-only";

import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  smartDirectRedis?: Redis;
};

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured",
    );
  }

  return { url, token };
}

export function getRedisClient() {
  if (globalForRedis.smartDirectRedis) {
    return globalForRedis.smartDirectRedis;
  }

  const { url, token } = getRedisConfig();
  const client = new Redis({ url, token });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.smartDirectRedis = client;
  }

  return client;
}

export async function connectRedis() {
  return getRedisClient();
}

export async function disconnectRedis() {
  return;
}

export async function redisHealthCheck() {
  const startedAt = Date.now();

  try {
    const client = getRedisClient();
    const response = await client.ping();

    return {
      ok: response === "PONG",
      configured: true,
      latencyMs: Date.now() - startedAt,
      status: "ready",
    };
  } catch (error) {
    return {
      ok: false,
      configured: Boolean(
        process.env.UPSTASH_REDIS_REST_URL?.trim() &&
          process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
      ),
      latencyMs: Date.now() - startedAt,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}
