import { Redis } from "@upstash/redis";
import { createClient } from "redis";

type RedisLikeClient = any;

const globalForRedis = globalThis as unknown as {
  smartDirectRedis?: RedisLikeClient;
};

const DEFAULT_REDIS_COMMAND_TIMEOUT_MS = 5_000;
const DEFAULT_LOCAL_REDIS_URL = "redis://127.0.0.1:6379";

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
        reject(new Error("Redis command timed out after " + timeoutMs + "ms"));
      }, timeoutMs);
    }),
  ]);
}

function serializeRedisValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseRedisValue<T>(value: string | null): T | null {
  if (value === null) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

function getRedisDriver() {
  return process.env.REDIS_DRIVER?.trim() || "upstash";
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured",
    );
  }

  return { url, token };
}

function createTimedUpstashClient(): Redis {
  const { url, token } = getUpstashConfig();
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

function createLocalRedisClient(): RedisLikeClient {
  const url = process.env.REDIS_LOCAL_URL?.trim() || DEFAULT_LOCAL_REDIS_URL;

  const client = createClient({ url });

  client.on("error", (error: unknown) => {
    console.error("[Local Redis] Client error:", error);
  });

  let connectPromise: Promise<void> | null = null;

  async function ensureConnected() {
    if (client.isReady) return;

    if (!connectPromise) {
      connectPromise = client.connect().finally(() => {
        connectPromise = null;
      });
    }

    await connectPromise;
  }

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "eval") {
        return async (
          script: string,
          keys: string[],
          args: string[],
        ) => {
          await ensureConnected();

          return withRedisTimeout(
            target.eval(script, {
              keys,
              arguments: args,
            }),
          );
        };
      }

      if (property === "get") {
        return async <T = unknown>(key: string) => {
          await ensureConnected();
          const result = await withRedisTimeout(target.get(key));
          return parseRedisValue<T>(result);
        };
      }

      if (property === "set") {
        return async (
          key: string,
          value: unknown,
          options?: { nx?: boolean; ex?: number },
        ) => {
          await ensureConnected();

          const redisOptions: Record<string, unknown> = {};

          if (options?.nx) redisOptions.NX = true;
          if (options?.ex !== undefined) redisOptions.EX = options.ex;

          return withRedisTimeout(
            target.set(key, serializeRedisValue(value), redisOptions),
          );
        };
      }

      if (property === "zrange") {
        return async (
          key: string,
          start: number,
          end: number,
          options?: {
            byScore?: boolean;
            offset?: number;
            count?: number;
          },
        ) => {
          await ensureConnected();

          if (options?.byScore) {
            return withRedisTimeout(
              target.zRangeByScore(key, start, end, {
                LIMIT: {
                  offset: options.offset ?? 0,
                  count: options.count ?? -1,
                },
              }),
            );
          }

          return withRedisTimeout(target.zRange(key, start, end));
        };
      }

      if (property === "zadd") {
        return async (
          key: string,
          value: { score: number; member: string },
        ) => {
          await ensureConnected();

          return withRedisTimeout(
            target.zAdd(key, [
              {
                score: value.score,
                value: value.member,
              },
            ]),
          );
        };
      }

      if (property === "ping") {
        return async () => {
          await ensureConnected();
          return withRedisTimeout(target.ping());
        };
      }

      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        return withRedisTimeout(
          (async () => {
            await ensureConnected();
            return value.apply(target, args);
          })(),
        );
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

  const client =
    getRedisDriver() === "local"
      ? createLocalRedisClient()
      : createTimedUpstashClient();

  globalForRedis.smartDirectRedis = client;

  return client;
}

export async function connectRedis() {
  return getRedisClient();
}

export async function disconnectRedis() {
  const client = globalForRedis.smartDirectRedis;

  if (!client || getRedisDriver() !== "local") {
    return;
  }

  if (client.isOpen) {
    await client.quit();
  }

  globalForRedis.smartDirectRedis = undefined;
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
      configured: true,
      latencyMs: Date.now() - startedAt,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}
