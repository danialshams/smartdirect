import { getRedisClient } from "@/lib/redis/client";

export type InstagramRateLimitOperation =
  | "MESSAGE_TEXT"
  | "MESSAGE_MEDIA"
  | "MESSAGE_REACTION"
  | "CONVERSATION_READ"
  | "COMMENT_REPLY"
  | "COMMENT_LIKE"
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
  scope?: InstagramRateLimitScope;
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
  MESSAGE_REACTION: { limit: 100, windowMs: 1_000 },
  CONVERSATION_READ: { limit: 2, windowMs: 1_000 },
  COMMENT_REPLY: { limit: 100, windowMs: 1_000 },
  COMMENT_LIKE: { limit: 100, windowMs: 1_000 },
  COMMENT_PRIVATE_REPLY: { limit: 750, windowMs: 60 * 60 * 1_000 },
  PUBLISH_MEDIA: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_REEL: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_CAROUSEL: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
  PUBLISH_STORY: { limit: 100, windowMs: 24 * 60 * 60 * 1_000 },
};

const LUA_CONSUME = `
for i = 1, #KEYS do
  local current = tonumber(redis.call("GET", KEYS[i]) or "0")
  local limit = tonumber(ARGV[(i - 1) * 2 + 1])
  local ttl = redis.call("PTTL", KEYS[i])

  if current >= limit then
    return { 0, i, current, ttl }
  end
end

for i = 1, #KEYS do
  local current = redis.call("INCR", KEYS[i])
  local window = tonumber(ARGV[(i - 1) * 2 + 2])

  if current == 1 then
    redis.call("PEXPIRE", KEYS[i], window)
  end
end

return { 1, 0, 0, -1 }
`;

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOperationConfig(operation: InstagramRateLimitOperation) {
  const defaults = DEFAULTS[operation];

  return {
    limit: Math.floor(
      envNumber(`INSTAGRAM_RATE_LIMIT_${operation}_LIMIT`, defaults.limit),
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

function bucketKey(bucket: InstagramRateLimitBucket, now: number) {
  return `${PREFIX}:${bucket.key}:${windowId(now, bucket.windowMs)}`;
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
  ];

  if (context.tenantId) {
    buckets.push({
      scope: "TENANT",
      key: `tenant:${context.tenantId}`,
      ...getTenantConfig(),
    });
  }

  buckets.push(
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
  );

  return buckets;
}

export async function consumeInstagramRateLimit(
  context: InstagramRateLimitContext,
): Promise<InstagramRateLimitResult> {
  const buckets = getInstagramRateLimitBuckets(context);
  const now = Date.now();
  const redis = getRedisClient();

  const keys = buckets.map((bucket) => bucketKey(bucket, now));
  const args = buckets.flatMap((bucket) => [
    String(bucket.limit),
    String(bucket.windowMs),
  ]);

  const result = (await redis.eval(
    LUA_CONSUME,
    keys,
    args,
  )) as [number, number, number, number];

  const allowed = Number(result[0]) === 1;

  if (!allowed) {
    const deniedIndex = Math.max(
      0,
      Math.min(buckets.length - 1, Number(result[1]) - 1),
    );
    const bucket = buckets[deniedIndex];
    const current = Number(result[2]);
    const retryAfterMs = Math.max(0, Number(result[3]));

    return {
      allowed: false,
      limit: bucket.limit,
      remaining: Math.max(0, bucket.limit - current),
      retryAfterMs,
      resetAt: now + retryAfterMs,
      scope: bucket.scope,
    };
  }

  return {
    allowed: true,
    limit: Math.min(...buckets.map((bucket) => bucket.limit)),
    remaining: Math.min(...buckets.map((bucket) => Math.max(0, bucket.limit - 1))),
    retryAfterMs: 0,
    resetAt: Math.min(...buckets.map((bucket) => now + bucket.windowMs)),
    scope: "OPERATION",
  };
}

export async function waitForInstagramRateLimit(
  context: InstagramRateLimitContext,
  options: { maxWaitMs?: number; signal?: AbortSignal } = {},
) {
  const maxWaitMs = options.maxWaitMs ?? 0;
  const result = await consumeInstagramRateLimit(context);

  if (result.allowed || result.retryAfterMs <= 0) {
    return result;
  }

  if (maxWaitMs <= 0 || result.retryAfterMs > maxWaitMs) {
    return result;
  }

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
