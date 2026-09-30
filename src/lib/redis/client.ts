import { Redis } from "@upstash/redis";
import IORedis from "ioredis";
import { NativeRedisAdapter } from "./providers/native";
import type { RedisClientLike } from "./types";

const globalForRedis = globalThis as unknown as {
  smartDirectRedis?: RedisClientLike;
};

const DEFAULT_REDIS_COMMAND_TIMEOUT_MS = 5_000;
let redisCommandTimeoutOverrideMs: number | undefined;

function getRedisCommandTimeoutMs() {
  if (redisCommandTimeoutOverrideMs) return redisCommandTimeoutOverrideMs;
  const raw = process.env.REDIS_COMMAND_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_REDIS_COMMAND_TIMEOUT_MS;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REDIS_COMMAND_TIMEOUT_MS;
}

function getRedisDriver() {\n  return process.env.REDIS_DRIVER?.trim().toLowerCase() === "native" ? "native" : "upstash";\n}\n\nfunction getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured");
  }
  return { url, token };
}

function createRedisClient(): Redis {
  const { url, token } = getRedisConfig();
  return new Redis({
    url,
    token,
    signal: () => AbortSignal.timeout(getRedisCommandTimeoutMs()),
  });
}

export function setRedisCommandTimeoutMs(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("INVALID_REDIS_COMMAND_TIMEOUT_MS");
  }
  redisCommandTimeoutOverrideMs = timeoutMs;
  globalForRedis.smartDirectRedis = undefined;
}

export function getRedisClient(): RedisClientLike {
  if (!globalForRedis.smartDirectRedis) {
    globalForRedis.smartDirectRedis = createRedisClient();
  }
  return globalForRedis.smartDirectRedis;
}

export async function connectRedis() {
  return getRedisClient();
}

export async function disconnectRedis() {
  // @upstash/redis is HTTP based and has no persistent socket to close.
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
