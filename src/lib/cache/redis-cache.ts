import "server-only";

import { createQueueRedis } from "@/lib/queue/core";

const DEFAULT_TTL_SECONDS = 300;

function normalizeTtl(ttlSeconds?: number) {
  const envTtl = Number(process.env.REDIS_CACHE_DEFAULT_TTL_SECONDS);
  const value = ttlSeconds ?? (Number.isFinite(envTtl) && envTtl > 0 ? envTtl : DEFAULT_TTL_SECONDS);
  return Math.max(1, Math.floor(value));
}

export function cacheKey(...parts: Array<string | number | null | undefined>) {
  return ["smartdirect", "cache", ...parts.filter((part): part is string | number => part !== null && part !== undefined)]
    .map(String)
    .join(":");
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const redis = createQueueRedis();
    return await redis.get<T>(key);
  } catch (error) {
    console.warn("[Redis Cache] GET failed; falling back:", { key, error });
    return null;
  }
}

export async function setCachedJson<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<boolean> {
  try {
    const redis = createQueueRedis();
    await redis.set(key, value, { ex: normalizeTtl(ttlSeconds) });
    return true;
  } catch (error) {
    console.warn("[Redis Cache] SET failed; continuing without cache:", { key, error });
    return false;
  }
}

export async function deleteCachedJson(key: string): Promise<boolean> {
  try {
    const redis = createQueueRedis();
    await redis.del(key);
    return true;
  } catch (error) {
    console.warn("[Redis Cache] DELETE failed; continuing without cache:", { key, error });
    return false;
  }
}

export async function invalidateCacheByPrefix(prefix: string): Promise<boolean> {
  try {
    const redis = createQueueRedis();
    const keys = await redis.keys(prefix.endsWith("*") ? prefix : `${prefix}*`);
    if (!keys.length) return true;
    await Promise.all(keys.map((key) => redis.del(key)));
    return true;
  } catch (error) {
    console.warn("[Redis Cache] PREFIX invalidation failed:", { prefix, error });
    return false;
  }
}

export async function getOrSetCachedJson<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds?: number,
): Promise<T> {
  const cached = await getCachedJson<T>(key);
  if (cached !== null) return cached;

  const value = await factory();
  await setCachedJson(key, value, ttlSeconds);
  return value;
}
