import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  smartDirectRedis?: Redis;
};

const DEFAULT_REDIS_COMMAND_TIMEOUT_MS = 5_000;
let redisCommandTimeoutOverrideMs: number | undefined;

function getRedisCommandTimeoutMs() {
  if (redisCommandTimeoutOverrideMs) return redisCommandTimeoutOverrideMs;

  const raw = process.env.REDIS_COMMAND_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_REDIS_COMMAND_TIMEOUT_MS;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_REDIS_COMMAND_TIMEOUT_MS;
}

function withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeoutMs = getRedisCommandTimeoutMs();

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

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

function createTimedRedisClient(): Redis {
  const { url, token } = getRedisConfig();
  const client = new Redis({ url, token });

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const result = value.apply(target, args);

        if (result && typeof result.then === "function") {
          return withRedisTimeout(Promise.resolve(result));
        }

        return result;
      };
    },
  });
}

export function setRedisCommandTimeoutMs(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("INVALID_REDIS_COMMAND_TIMEOUT_MS");
  }

  redisCommandTimeoutOverrideMs = timeoutMs;
}

export function getRedisClient() {
  if (globalForRedis.smartDirectRedis) {
    return globalForRedis.smartDirectRedis;
  }

  const client = createTimedRedisClient();

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
