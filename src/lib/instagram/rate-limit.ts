import "server-only";

import { getRedisClient } from "@/lib/redis/client";

export type InstagramRateLimitOperation =
  | "MESSAGE_TEXT"
  | "MESSAGE_MEDIA"
  | "CONVERSATION_READ"
  | "COMMENT_REPLY"
  | "COMMENT_PRIVATE_REPLY"
  | "PUBLISH_MEDIA"
  | "PUBLISH_REEL"
  | "PUBLISH_CAROUSEL"
  | "PUBLISH_STORY";

export type InstagramRateLimitScope =
  | "GLOBAL"
  | "TENANT"
  | "INSTAGRAM_ACCOUNT"
  | "OPERATION";

export type InstagramRateLimitBucket = {
  scope: InstagramRateLimitScope;
  key: string;
  limit: number;
  windowMs: number;
};

export type InstagramRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
};

export type InstagramRateLimitContext = {
  tenantId?: string;
  instagramAccountId: string;
  operation: InstagramRateLimitOperation;
};

const PREFIX = "smartdirect:rate-limit:v1";

const DEFAULTS: Record<InstagramRateLimitOperation, { limit: number; windowMs: number }> = {
  MESSAGE_TEXT: { limit: 100, windowMs: 1_000 },
  MESSAGE_MEDIA: { limit: 10, windowMs: 1_000 },
  CONVERSATION_READ: { limit: 2, windowMs: 1_000 },
  COMMENT_REPLY: { limit: 100, windowMs: 1_000 },
  COMMENT_PRIVATE_REPLY: { limit: 750, windowMs: 60 * 60 * 1_000 },
  PUBLISH_MEDIA: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_REEL: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_CAROUSEL: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_STORY: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
};

const LUA_INCREMENT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOperationConfig(operation: InstagramRateLimitOperation) {
  const defaults = DEFAULTS[operation];

  return {
    limit: Math.floor(
      envNumber(
        `INSTAGRAM_RATE_LIMIT_${operation}_LIMIT`,
        defaults.limit,
      ),
    ),
    windowMs: Math.floor(
      envNumber(
        `INSTAGRAM_RATE_LIMIT_${operation}_WINDOW_MS`,
        defaults.windowMs,
      ),
    ),
  };
}

function getGlobalConfig() {
  return {
    limit: Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_GLOBAL_LIMIT", 1000)),
    windowMs: Math.floor(
      envNumber("INSTAGRAM_RATE_LIMIT_GLOBAL_WINDOW_MS", 1_000),
    ),
  };
}

function getTenantConfig() {
  return {
    limit: Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_TENANT_LIMIT", 200)),
    windowMs: Math.floor(
      envNumber("INSTAGRAM_RATE_LIMIT_TENANT_WINDOW_MS", 1_000),
    ),
  };
}

function windowId(now: number, windowMs: number) {
  return Math.floor(now / windowMs);
}

async function consumeBucket(
  bucket: InstagramRateLimitBucket,
  now = Date.now(),
): Promise<InstagramRateLimitResult> {
  const redis = getRedisClient();
  const id = windowId(now, bucket.windowMs);
  const redisKey = `${PREFIX}:${bucket.key}:${id}`;

  const result = (await redis.eval(
    LUA_INCREMENT,
    [redisKey],
    [String(bucket.windowMs)],
  )) as [number, number];

  const current = Number(result[0]);
  const ttl = Math.max(0, Number(result[1]));
  const resetAt = now + ttl;

  return {
    allowed: current <= bucket.limit,
    limit: bucket.limit,
    remaining: Math.max(0, bucket.limit - current),
    retryAfterMs: current <= bucket.limit ? 0 : ttl,
    resetAt,
  };
}

export function getInstagramRateLimitBuckets(
  context: InstagramRateLimitContext,
): InstagramRateLimitBucket[] {
  const operation = getOperationConfig(context.operation);
  const buckets: InstagramRateLimitBucket[] = [
    {
      scope: "GLOBAL",
      key: "global",
      ...getGlobalConfig(),
    },
    {
      scope: "INSTAGRAM_ACCOUNT",
      key: `account:${context.instagramAccountId}`,
      limit: envNumber(
        "INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT",
        operation.limit,
      ),
      windowMs: envNumber(
        "INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS",
        operation.windowMs,
      ),
    },
    {
      scope: "OPERATION",
      key: `account:${context.instagramAccountId}:operation:${context.operation}`,
      ...operation,
    },
  ];

  if (context.tenantId) {
    buckets.splice(1, 0, {
      scope: "TENANT",
      key: `tenant:${context.tenantId}`,
      ...getTenantConfig(),
    });
  }

  return buckets;
}

export async function consumeInstagramRateLimit(
  context: InstagramRateLimitContext,
): Promise<InstagramRateLimitResult> {
  let last: InstagramRateLimitResult | null = null;

  for (const bucket of getInstagramRateLimitBuckets(context)) {
    const result = await consumeBucket(bucket);
    last = result;

    if (!result.allowed) {
      return result;
    }
  }

  return last ?? {
    allowed: true,
    limit: 0,
    remaining: 0,
    retryAfterMs: 0,
    resetAt: Date.now(),
  };
}
