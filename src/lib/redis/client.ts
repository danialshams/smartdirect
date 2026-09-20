import "server-only";

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "";

if (!REDIS_URL) {
  throw new Error("REDIS_URL is not configured");
}

const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5_000);
const commandTimeout = Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 3_000);

const globalForRedis = globalThis as unknown as {
  smartDirectRedis?: Redis;
};

function createRedisClient() {
  const url = REDIS_URL;

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

export const redis =
  globalForRedis.smartDirectRedis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.smartDirectRedis = redis;
}

export async function connectRedis() {
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
      latencyMs: Date.now() - startedAt,
      status: client.status,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      status: redis.status,
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}
