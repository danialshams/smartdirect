import { getRedisClient } from "@/lib/redis/client";

export type InstagramRateLimitOperation =
  | "MESSAGE_TEXT" | "MESSAGE_MEDIA" | "MESSAGE_REACTION" | "CONVERSATION_READ"
  | "COMMENT_REPLY" | "COMMENT_LIKE" | "COMMENT_PRIVATE_REPLY"
  | "PUBLISH_MEDIA" | "PUBLISH_REEL" | "PUBLISH_CAROUSEL" | "PUBLISH_STORY"
  | "PUBLISH_QUOTA_READ"
  | "AUTOMATION_MEDIA_PREVIEW" | "PROFILE_READ" | "MEDIA_READ" | "INSIGHTS_READ" | "MESSENGER_PROFILE";

export type InstagramRateLimitScope = "GLOBAL" | "TENANT" | "INSTAGRAM_ACCOUNT" | "OPERATION";

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
  scope?: InstagramRateLimitScope;
};

export type InstagramRateLimitContext = {
  tenantId?: string;
  instagramAccountId: string;
  operation: InstagramRateLimitOperation;
};

const PREFIX = "smartdirect:rate-limit:v2";

const DEFAULTS: Record<InstagramRateLimitOperation, { limit: number; windowMs: number }> = {
  MESSAGE_TEXT: { limit: 100, windowMs: 1_000 },
  MESSAGE_MEDIA: { limit: 10, windowMs: 1_000 },
  MESSAGE_REACTION: { limit: 100, windowMs: 1_000 },
  CONVERSATION_READ: { limit: 2, windowMs: 1_000 },
  COMMENT_REPLY: { limit: 100, windowMs: 1_000 },
  COMMENT_LIKE: { limit: 100, windowMs: 1_000 },
  COMMENT_PRIVATE_REPLY: { limit: 750, windowMs: 60 * 60 * 1_000 },
  PUBLISH_MEDIA: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_REEL: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_CAROUSEL: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_STORY: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_QUOTA_READ: { limit: 2, windowMs: 1_000 },
  AUTOMATION_MEDIA_PREVIEW: { limit: 100, windowMs: 60 * 1_000 },
  PROFILE_READ: { limit: 20, windowMs: 1_000 },
  MEDIA_READ: { limit: 20, windowMs: 1_000 },
  INSIGHTS_READ: { limit: 10, windowMs: 1_000 },
  MESSENGER_PROFILE: { limit: 10, windowMs: 1_000 },
};

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOperationConfig(operation: InstagramRateLimitOperation) {
  const defaults = DEFAULTS[operation];
  return {
    limit: Math.max(1, Math.floor(envNumber(`INSTAGRAM_RATE_LIMIT_${operation}_LIMIT`, defaults.limit))),
    windowMs: Math.max(100, Math.floor(envNumber(`INSTAGRAM_RATE_LIMIT_${operation}_WINDOW_MS`, defaults.windowMs))),
  };
}

function getGlobalConfig() {
  return {
    limit: Math.max(1, Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_GLOBAL_LIMIT", 1000))),
    windowMs: Math.max(100, Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_GLOBAL_WINDOW_MS", 1_000))),
  };
}

function getTenantConfig() {
  return {
    limit: Math.max(1, Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_TENANT_LIMIT", 200))),
    windowMs: Math.max(100, Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_TENANT_WINDOW_MS", 1_000))),
  };
}

export function getInstagramRateLimitBuckets(context: InstagramRateLimitContext): InstagramRateLimitBucket[] {
  const operation = getOperationConfig(context.operation);
  const buckets: InstagramRateLimitBucket[] = [
    { scope: "GLOBAL", key: "global", ...getGlobalConfig() },
  ];

  if (context.tenantId) {
    buckets.push({ scope: "TENANT", key: `tenant:${context.tenantId}`, ...getTenantConfig() });
  }

  buckets.push(
    {
      scope: "INSTAGRAM_ACCOUNT",
      key: `account:${context.instagramAccountId}`,
      limit: Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT", operation.limit)),
      windowMs: Math.floor(envNumber("INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS", operation.windowMs)),
    },
    {
      scope: "OPERATION",
      key: `account:${context.instagramAccountId}:operation:${context.operation}`,
      ...operation,
    },
  );

  return buckets;
}

/**
 * Token-bucket limiter. Unlike the previous fixed-window counter it does not
 * allow a double burst at a second/window boundary. The same Redis/Lua
 * contract works with Upstash today and a normal Redis/Valkey server later.
 */
const LUA_TOKEN_BUCKET = `
local now = tonumber(ARGV[1])
local count = #KEYS / 2
local denied = 0
local retry = 0
local minRemaining = 9223372036854775807

for i = 1, count do
  local tokenKey = KEYS[(i - 1) * 2 + 1]
  local timeKey = KEYS[(i - 1) * 2 + 2]
  local limit = tonumber(ARGV[(i - 1) * 3 + 2])
  local windowMs = tonumber(ARGV[(i - 1) * 3 + 3])
  local tokens = tonumber(redis.call("GET", tokenKey))
  local last = tonumber(redis.call("GET", timeKey))

  if not tokens then tokens = limit end
  if not last then last = now end

  local elapsed = math.max(0, now - last)
  local refill = (elapsed * limit) / windowMs
  tokens = math.min(limit, tokens + refill)

  if tokens < 1 and denied == 0 then
    denied = i
    retry = math.ceil((1 - tokens) * windowMs / limit)
  end

  minRemaining = math.min(minRemaining, math.floor(tokens))
  redis.call("SET", tokenKey, tostring(tokens), "PX", math.max(windowMs * 2, 1000))
  redis.call("SET", timeKey, tostring(now), "PX", math.max(windowMs * 2, 1000))
end

if denied ~= 0 then
  return {0, denied, minRemaining, retry}
end

for i = 1, count do
  local tokenKey = KEYS[(i - 1) * 2 + 1]
  local tokens = tonumber(redis.call("GET", tokenKey))
  tokens = math.max(0, tokens - 1)
  redis.call("SET", tokenKey, tostring(tokens), "PX", math.max(tonumber(ARGV[(i - 1) * 3 + 3]) * 2, 1000))
end

return {1, 0, minRemaining - 1, 0}
`;

type LocalBucket = { tokens: number; updatedAt: number };
const localBuckets = new Map<string, LocalBucket>();

function consumeLocalFallback(buckets: InstagramRateLimitBucket[], now: number): InstagramRateLimitResult {
  let minRemaining = Number.MAX_SAFE_INTEGER;
  let denied: InstagramRateLimitBucket | null = null;
  let retryAfterMs = 0;

  for (const bucket of buckets) {
    const key = `${bucket.key}:${bucket.windowMs}:${bucket.limit}`;
    const current = localBuckets.get(key) ?? { tokens: bucket.limit, updatedAt: now };
    const elapsed = Math.max(0, now - current.updatedAt);
    current.tokens = Math.min(bucket.limit, current.tokens + elapsed * bucket.limit / bucket.windowMs);
    current.updatedAt = now;

    if (current.tokens < 1 && !denied) {
      denied = bucket;
      retryAfterMs = Math.ceil((1 - current.tokens) * bucket.windowMs / bucket.limit);
    }
    minRemaining = Math.min(minRemaining, Math.floor(current.tokens));
    localBuckets.set(key, current);
  }

  if (denied) {
    return {
      allowed: false,
      limit: denied.limit,
      remaining: Math.max(0, minRemaining),
      retryAfterMs,
      resetAt: now + retryAfterMs,
      scope: denied.scope,
    };
  }

  for (const bucket of buckets) {
    const key = `${bucket.key}:${bucket.windowMs}:${bucket.limit}`;
    const current = localBuckets.get(key);
    if (current) current.tokens = Math.max(0, current.tokens - 1);
  }

  return {
    allowed: true,
    limit: Math.min(...buckets.map((bucket) => bucket.limit)),
    remaining: Math.max(0, minRemaining - 1),
    retryAfterMs: 0,
    resetAt: now + Math.min(...buckets.map((bucket) => bucket.windowMs)),
    scope: "OPERATION",
  };
}

export async function consumeInstagramRateLimit(context: InstagramRateLimitContext): Promise<InstagramRateLimitResult> {
  const buckets = getInstagramRateLimitBuckets(context);
  const now = Date.now();
  const redis = getRedisClient();

  const keys: string[] = [];
  const args: string[] = [String(now)];

  for (const bucket of buckets) {
    keys.push(`${PREFIX}:${bucket.key}:tokens`, `${PREFIX}:${bucket.key}:time`);
    args.push("0", String(bucket.limit), String(bucket.windowMs));
  }

  try {
    const result = (await redis.eval(LUA_TOKEN_BUCKET, keys, args)) as [number, number, number, number];
    const allowed = Number(result[0]) === 1;

    if (!allowed) {
      const index = Math.max(0, Math.min(buckets.length - 1, Number(result[1]) - 1));
      const bucket = buckets[index];
      const retryAfterMs = Math.max(1, Number(result[3]));
      return {
        allowed: false,
        limit: bucket.limit,
        remaining: Math.max(0, Number(result[2])),
        retryAfterMs,
        resetAt: now + retryAfterMs,
        scope: bucket.scope,
      };
    }

    return {
      allowed: true,
      limit: Math.min(...buckets.map((bucket) => bucket.limit)),
      remaining: Math.max(0, Number(result[2])),
      retryAfterMs: 0,
      resetAt: now + Math.min(...buckets.map((bucket) => bucket.windowMs)),
      scope: "OPERATION",
    };
  } catch (error) {
    console.error("[Instagram RateLimit] Redis unavailable; using local emergency limiter.", {
      operation: context.operation,
      instagramAccountId: context.instagramAccountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return consumeLocalFallback(buckets, now);
  }
}

export async function waitForInstagramRateLimit(
  context: InstagramRateLimitContext,
  options: { maxWaitMs?: number; signal?: AbortSignal } = {},
) {
  const maxWaitMs = options.maxWaitMs ?? 0;
  const result = await consumeInstagramRateLimit(context);
  if (result.allowed || result.retryAfterMs <= 0 || result.retryAfterMs > maxWaitMs) return result;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, result.retryAfterMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Instagram rate-limit wait aborted"));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
  });

  return consumeInstagramRateLimit(context);
}
