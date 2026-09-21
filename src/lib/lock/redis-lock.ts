import "server-only";

import { getRedisClient } from "@/lib/redis/client";
import {
  type AcquireLockResult,
  type DistributedLockHandle,
  type DistributedLockKeyInput,
} from "./types";

const LOCK_PREFIX = "smartdirect:lock:";
const DEFAULT_LOCK_TTL_SECONDS = 30;
const MIN_LOCK_TTL_SECONDS = 1;
const MAX_LOCK_TTL_SECONDS = 300;

function getLockTtlSeconds() {
  const raw = process.env.DISTRIBUTED_LOCK_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_LOCK_TTL_SECONDS;

  const value = Number(raw);

  if (
    !Number.isInteger(value) ||
    value < MIN_LOCK_TTL_SECONDS ||
    value > MAX_LOCK_TTL_SECONDS
  ) {
    return DEFAULT_LOCK_TTL_SECONDS;
  }

  return value;
}

export function createLockKey(input: DistributedLockKeyInput) {
  const resourceId = input.resourceId.trim();

  if (!resourceId) {
    throw new Error("Distributed lock resourceId cannot be empty.");
  }

  return `${LOCK_PREFIX}${input.scope}:${resourceId}`;
}

function createLockToken() {
  return crypto.randomUUID();
}

export async function acquireLock(
  input: DistributedLockKeyInput,
): Promise<AcquireLockResult> {
  const redis = getRedisClient();
  const key = createLockKey(input);
  const token = createLockToken();
  const ttlSeconds = getLockTtlSeconds();

  const result = await redis.set(key, token, {
    nx: true,
    ex: ttlSeconds,
  });

  if (result !== "OK") {
    return {
      acquired: false,
      reason: "ALREADY_LOCKED",
    };
  }

  return {
    acquired: true,
    handle: {
      key,
      token,
      expiresAt: Date.now() + ttlSeconds * 1000,
    },
  };
}

/**
 * Releases a lock only when the supplied token still owns it.
 *
 * The ownership check and delete must be atomic. A plain GET followed by
 * DEL would have a race where the TTL could expire and another worker could
 * acquire the same key between the two commands.
 */
export async function releaseLock(
  handle: DistributedLockHandle,
): Promise<boolean> {
  const redis = getRedisClient();

  const result = await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end`,
    [handle.key],
    [handle.token],
  );

  return Number(result) === 1;
}

export async function isLockOwned(
  handle: DistributedLockHandle,
): Promise<boolean> {
  const redis = getRedisClient();
  const value = await redis.get<string>(handle.key);
  return value === handle.token;
}
