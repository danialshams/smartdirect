import "server-only";

import Redis from "ioredis";

const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5_000);
const commandTimeout = Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 3_000);

const globalForRedis = globalThis as unknown as {
  smartDirectRedis?: Redis;
};

function getRedisUrl() {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  return url;
}

function createRedisClient(url: string) {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout,
    commandTimeout,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(attempt: number) {
      return Math.min(attempt * 250, 5_000);
    },
  });

  client.on("error", (error) => {
    console.error("[redis] connection error", error);
  });

  client.on("reconnecting", (delay: number) => {
    console.warn("[redis] reconnecting", { delay });
  });

  return client;
}

export function getRedisClient() {
  if (globalForRedis.smartDirectRedis) {
    return globalForRedis.smartDirectRedis;
  }

  const client = createRedisClient(getRedisUrl());

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.smartDirectRedis = client;
  }

  return client;
}

export async function connectRedis() {
  const redis = getRedisClient();

  if (redis.status === "ready") {
    return redis;
  }

  if (redis.status === "connecting" || redis.status === "connect") {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        redis.off("ready", onReady);
        redis.off("error", onError);
      };

      redis.once("ready", onReady);
      redis.once("error", onError);
    });

    return redis;
  }

  await redis.connect();
  return redis;
}

export async function disconnectRedis() {
  const redis = getRedisClient();

  if (redis.status === "end") {
    return;
  }

  await redis.quit();
}

export async function redisHealthCheck() {
  const startedAt = Date.now();

  try {
    const client = await connectRedis();
    const response = await client.ping();

    return {
      ok: response === "PONG",
      configured: true,
      latencyMs: Date.now() - startedAt,
      status: client.status,
    };
  } catch (error) {
    return {
      ok: false,
      configured: Boolean(process.env.REDIS_URL?.trim()),
      latencyMs: Date.now() - startedAt,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}
