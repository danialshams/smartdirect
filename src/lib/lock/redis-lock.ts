import { getRedisClient } from "@/lib/redis/client";
import {
  type AcquireLockResult,
  type DistributedLockHandle,
  type DistributedLockKeyInput,
  DISTRIBUTED_LOCK_KEY_PREFIX,
} from "./types";

const DEFAULT_LOCK_TTL_SECONDS = 30;
const MIN_LOCK_TTL_SECONDS = 1;
const MAX_LOCK_TTL_SECONDS = 300;

export const DISTRIBUTED_LOCK_TTL_DEFAULT_SECONDS = DEFAULT_LOCK_TTL_SECONDS;
export const DISTRIBUTED_LOCK_TTL_MIN_SECONDS = MIN_LOCK_TTL_SECONDS;
export const DISTRIBUTED_LOCK_TTL_MAX_SECONDS = MAX_LOCK_TTL_SECONDS;

export function getLockTtlSeconds() {
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

const LOCK_KEY_VERSION = "v1";

const VALID_LOCK_SCOPES = new Set<DistributedLockKeyInput["scope"]>([
  "job",
  "instagram-account",
  "conversation",
  "publishing-job",
]);

function normalizeResourceId(resourceId: string) {
  const normalized = resourceId.trim();

  if (!normalized) {
    throw new Error("Distributed lock resourceId cannot be empty.");
  }

  return normalized;
}

function encodeResourceId(resourceId: string) {
  return encodeURIComponent(resourceId);
}

/**
 * Builds the canonical, versioned Redis lock key.
 *
 * Format:
 *   smartdirect:lock:v1:<scope>:<encoded-resource-id>
 *
 * Resource IDs are URI-encoded so separators inside an ID cannot alter the
 * key structure. The version segment lets the key format evolve without
 * silently colliding with older formats.
 */
export function createLockKey(input: DistributedLockKeyInput) {
  if (!VALID_LOCK_SCOPES.has(input.scope)) {
    throw new Error(`Unsupported distributed lock scope: ${String(input.scope)}`);
  }

  const resourceId = normalizeResourceId(input.resourceId);

  return `${DISTRIBUTED_LOCK_KEY_PREFIX}${LOCK_KEY_VERSION}:${input.scope}:${encodeResourceId(resourceId)}`;
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
