import { consumeInstagramRateLimit, type InstagramRateLimitContext } from "@/lib/instagram/rate-limit";
import { observabilityLogger } from "@/lib/observability/logger";

const PREFIX = "smartdirect:instagram:traffic:v1";
const INITIAL = 4;
const MIN = 1;
const MAX = 16;
const LEASE_SECONDS = 90;
const MAX_WAIT_MS = 120_000;
const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 30_000;
const CIRCUIT_OPEN_MS = 10_000;

function num(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function initialLimit() { return Math.max(MIN, Math.floor(num("INSTAGRAM_CONCURRENCY_INITIAL", INITIAL))); }
function minLimit() { return Math.max(1, Math.floor(num("INSTAGRAM_CONCURRENCY_MIN", MIN))); }
function maxLimit() { return Math.max(minLimit(), Math.floor(num("INSTAGRAM_CONCURRENCY_MAX", MAX))); }
function leaseSeconds() { return Math.max(30, Math.floor(num("INSTAGRAM_CONCURRENCY_LEASE_SECONDS", LEASE_SECONDS))); }
function maxWaitMs() { return Math.max(0, Math.floor(num("INSTAGRAM_CONCURRENCY_MAX_WAIT_MS", MAX_WAIT_MS))); }
function failureThreshold() { return Math.max(1, Math.floor(num("INSTAGRAM_CIRCUIT_FAILURE_THRESHOLD", FAILURE_THRESHOLD))); }
function failureWindowMs() { return Math.max(1000, Math.floor(num("INSTAGRAM_CIRCUIT_FAILURE_WINDOW_MS", FAILURE_WINDOW_MS))); }
function circuitOpenMs() { return Math.max(100, Math.floor(num("INSTAGRAM_CIRCUIT_OPEN_MS", CIRCUIT_OPEN_MS))); }

function keyPart(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, "_"); }
function keys(accountId: string) {
  const a = keyPart(accountId);
  return {
    limit: PREFIX + ":limit:" + a,
    inflight: PREFIX + ":inflight:" + a,
    lease: PREFIX + ":lease:" + a,
    probe: PREFIX + ":probe:" + a,
    circuit: PREFIX + ":circuit:" + a,
    failures: PREFIX + ":failures:" + a,
    successes: PREFIX + ":successes:" + a,
    failureAt: PREFIX + ":failure-at:" + a,
    criticalPending: PREFIX + ":critical-pending:" + a,
  };
}

const ACQUIRE_SCRIPT = [
  'local now = tonumber(ARGV[1])',
  'local initial = tonumber(ARGV[2])',
  'local minLimit = tonumber(ARGV[3])',
  'local maxLimit = tonumber(ARGV[4])',
  'local leaseSeconds = tonumber(ARGV[5])',
  'local token = ARGV[6]',
  'local critical = tonumber(ARGV[7]) or 0',
  'local openUntil = tonumber(redis.call("GET", KEYS[4]) or "0")',
  'if openUntil > now then return {-1, openUntil - now, 0} end',
  'if openUntil > 0 then',
  '  redis.call("DEL", KEYS[4])',
  '  if redis.call("SET", KEYS[5], token, "NX", "EX", "5") ~= "OK" then return {-2, 100, 0} end',
  'else redis.call("DEL", KEYS[5]) end',
  'local limit = tonumber(redis.call("GET", KEYS[1]) or "")',
  'if not limit then limit = math.min(maxLimit, math.max(minLimit, initial)); redis.call("SET", KEYS[1], tostring(limit), "EX", "86400") end',
  'local inflight = tonumber(redis.call("GET", KEYS[2]) or "0")',
  'local pendingCritical = tonumber(redis.call("GET", KEYS[6]) or "0")',
  'local effectiveLimit = limit',
  'if critical == 0 and pendingCritical > 0 then effectiveLimit = math.max(1, limit - 1) end',
  'if inflight >= effectiveLimit then return {0, 25, limit} end',
  'redis.call("INCR", KEYS[2])',
  'redis.call("EXPIRE", KEYS[2], leaseSeconds)',
  'redis.call("SET", KEYS[3] .. ":" .. token, "1", "EX", leaseSeconds)',
  'if critical == 1 and pendingCritical > 0 then',
  '  local remaining = redis.call("DECR", KEYS[6])',
  '  if remaining <= 0 then redis.call("DEL", KEYS[6]) end',
  'end',
  'return {1, 0, limit}',
].join("\n");

const RELEASE_SCRIPT = [
  'local tokenKey = KEYS[1] .. ":" .. ARGV[1]',
  'if redis.call("GET", tokenKey) then',
  '  redis.call("DEL", tokenKey)',
  '  local current = tonumber(redis.call("GET", KEYS[2]) or "0")',
  '  if current > 0 then current = redis.call("DECR", KEYS[2]) end',
  '  if current <= 0 then redis.call("DEL", KEYS[2]) end',
  '  return current',
  'end',
  'return -1',
].join("\n");

const OUTCOME_SCRIPT = [
  'local now = tonumber(ARGV[1])',
  'local outcome = ARGV[2]',
  'local minLimit = tonumber(ARGV[3])',
  'local maxLimit = tonumber(ARGV[4])',
  'local threshold = tonumber(ARGV[5])',
  'local windowMs = tonumber(ARGV[6])',
  'local openMs = tonumber(ARGV[7])',
  'local limit = tonumber(redis.call("GET", KEYS[1]) or "1")',
  'local successes = tonumber(redis.call("GET", KEYS[2]) or "0")',
  'local failures = tonumber(redis.call("GET", KEYS[3]) or "0")',
  'local failureAt = tonumber(redis.call("GET", KEYS[4]) or "0")',
  'if failureAt == 0 or now - failureAt > windowMs then failures = 0 end',
  'if outcome == "success" then',
  '  successes = successes + 1; failures = 0; failureAt = 0',
  '  if successes >= 10 then limit = math.min(maxLimit, limit + 1); successes = 0 end',
  'elseif outcome == "429" then',
  '  limit = math.max(minLimit, math.floor(limit * 0.5)); successes = 0; failures = failures + 1; failureAt = now',
  'elseif outcome == "5xx" then',
  '  limit = math.max(minLimit, math.floor(limit * 0.75)); successes = 0; failures = failures + 1; failureAt = now',
  'else',
  '  limit = math.max(minLimit, math.floor(limit * 0.8)); successes = 0; failures = failures + 1; failureAt = now',
  'end',
  'limit = math.min(maxLimit, math.max(minLimit, limit))',
  'redis.call("SET", KEYS[1], tostring(limit), "EX", "86400")',
  'redis.call("SET", KEYS[2], tostring(successes), "EX", "86400")',
  'redis.call("SET", KEYS[3], tostring(failures), "EX", "86400")',
  'redis.call("SET", KEYS[4], tostring(failureAt), "EX", "86400")',
  'if failures >= threshold and failureAt > 0 and now - failureAt <= windowMs then redis.call("SET", KEYS[5], tostring(now + openMs), "PX", openMs) end',
  'return {limit, successes, failures, tonumber(redis.call("GET", KEYS[5]) or "0")}',
].join("\n");

export type InstagramTrafficLease = { accountId: string; token: string };

function isCriticalInstagramOperation(operation: string) {
  return operation === "PUBLISH_MEDIA"
    || operation === "PUBLISH_REEL"
    || operation === "PUBLISH_CAROUSEL"
    || operation === "PUBLISH_STORY"
    || operation === "PUBLISH_QUOTA_READ";
}

async function getTrafficSlotDiagnostics(redis: Awaited<ReturnType<typeof import("@/lib/redis/client").getRedisClient>>, accountId: string) {
  const k = keys(accountId);
  const [limit, inflight, inflightTtl] = await Promise.all([
    redis.get<number>(k.limit),
    redis.get<number>(k.inflight),
    redis.ttl(k.inflight),
  ]);

  let leaseCount = 0;
  let cursor: string | number = "0";
  do {
    const [nextCursor, members] = await redis.scan(cursor, { match: k.lease + ":*", count: 100 });
    leaseCount += members.length;
    cursor = nextCursor;
  } while (String(cursor) !== "0");

  return {
    limit: Number(limit ?? 0),
    inflight: Number(inflight ?? 0),
    inflightTtlSeconds: Number(inflightTtl ?? -1),
    leaseCount,
  };
}

export class InstagramCircuitOpenError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Instagram account circuit is open; retry after " + retryAfterMs + "ms");
    this.name = "InstagramCircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new Error("Instagram traffic wait aborted"));
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => { clearTimeout(timer); reject(new Error("Instagram traffic wait aborted")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function acquireInstagramTrafficSlot(context: InstagramRateLimitContext, options: { signal?: AbortSignal; maxWaitMs?: number } = {}) {
  const { getRedisClient } = await import("@/lib/redis/client");
  const redis = getRedisClient();
  const k = keys(context.instagramAccountId);
  const configuredWait = options.maxWaitMs && options.maxWaitMs > 0 ? options.maxWaitMs : maxWaitMs();
  const deadline = Date.now() + configuredWait;
  const token = crypto.randomUUID();
  const critical = isCriticalInstagramOperation(context.operation);
  let criticalPendingRegistered = false;

  if (critical) {
    await redis.incr(k.criticalPending);
    await redis.expire(k.criticalPending, Math.max(30, Math.ceil((configuredWait + leaseSeconds() * 1000) / 1000)));
    criticalPendingRegistered = true;
  }

  try {
  while (true) {
    const now = Date.now();
    if (now > deadline) {
      try {
        const diagnostics = await getTrafficSlotDiagnostics(redis, context.instagramAccountId);
        observabilityLogger.error("instagram_account_slot_acquire_timeout", {
          instagramAccountId: context.instagramAccountId,
          operation: context.operation,
          maxWaitMs: configuredWait,
          ...diagnostics,
        });
      } catch (diagnosticError) {
        observabilityLogger.error("instagram_account_slot_acquire_timeout_diagnostics_failed", {
          instagramAccountId: context.instagramAccountId,
          operation: context.operation,
          error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
        });
      }
      throw new Error("INSTAGRAM_CONCURRENCY_WAIT_TIMEOUT");
    }

    const result = await redis.eval(
      ACQUIRE_SCRIPT,
      [k.limit, k.inflight, k.lease, k.circuit, k.probe, k.criticalPending],
      [String(now), String(initialLimit()), String(minLimit()), String(maxLimit()), String(leaseSeconds()), token, critical ? "1" : "0"],
    ) as [number, number, number];

    const status = Number(result[0]);
    if (status === 1) {
      let rate;
      try {
        rate = await consumeInstagramRateLimit(context);
      } catch (error) {
        try {
          await releaseInstagramTrafficSlot({
            accountId: context.instagramAccountId,
            token,
          });
        } catch (releaseError) {
          observabilityLogger.error("instagram_account_slot_release_after_rate_limit_error_failed", {
            instagramAccountId: context.instagramAccountId,
            operation: context.operation,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }
        throw error;
      }
      if (!rate.allowed) {
        await releaseInstagramTrafficSlot({
          accountId: context.instagramAccountId,
          token,
        });
        const wait = Math.min(
          Math.max(25, rate.retryAfterMs),
          Math.max(25, deadline - now),
        );
        await sleep(wait, options.signal);
        continue;
      }

      observabilityLogger.debug("instagram_account_slot_acquired", {
        instagramAccountId: context.instagramAccountId,
        operation: context.operation,
        concurrencyLimit: Number(result[2]),
      });
      if (critical) criticalPendingRegistered = false;
      return { accountId: context.instagramAccountId, token };
    }
    if (status === -1) throw new InstagramCircuitOpenError(Math.max(100, Number(result[1])));
    await sleep(Math.min(Math.max(25, Number(result[1] || 50)), Math.max(25, deadline - now)), options.signal);
  }
  } finally {
    if (critical && criticalPendingRegistered) {
      try {
        const remaining = Number(await redis.decr(k.criticalPending));
        if (remaining <= 0) await redis.del(k.criticalPending);
      } catch (error) {
        observabilityLogger.warn("instagram_critical_pending_cleanup_failed", {
          instagramAccountId: context.instagramAccountId,
          operation: context.operation,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export async function releaseInstagramTrafficSlot(lease: InstagramTrafficLease) {
  const { getRedisClient } = await import("@/lib/redis/client");
  const redis = getRedisClient();
  const k = keys(lease.accountId);
  const result = Number(await redis.eval(RELEASE_SCRIPT, [k.lease, k.inflight], [lease.token]));
  if (result < 0) {
    observabilityLogger.warn("instagram_account_slot_release_missed", {
      instagramAccountId: lease.accountId,
      token: lease.token,
      reason: "LEASE_NOT_FOUND",
    });
    return false;
  }
  observabilityLogger.debug("instagram_account_slot_released", {
    instagramAccountId: lease.accountId,
    token: lease.token,
    inflight: result,
  });
  return true;
}

export async function recordInstagramTrafficOutcome(context: InstagramRateLimitContext, outcome: "success" | "429" | "5xx" | "timeout" | "network") {
  const { getRedisClient } = await import("@/lib/redis/client");
  const redis = getRedisClient();
  const k = keys(context.instagramAccountId);
  const result = await redis.eval(
    OUTCOME_SCRIPT,
    [k.limit, k.successes, k.failures, k.failureAt, k.circuit],
    [String(Date.now()), outcome, String(minLimit()), String(maxLimit()), String(failureThreshold()), String(failureWindowMs()), String(circuitOpenMs())],
  ) as [number, number, number, number];

  observabilityLogger.info("instagram_account_traffic_outcome", {
    instagramAccountId: context.instagramAccountId,
    operation: context.operation,
    outcome,
    concurrencyLimit: Number(result[0]),
    consecutiveSuccesses: Number(result[1]),
    failures: Number(result[2]),
    circuitOpenUntil: Number(result[3]) || null,
  });
}
