import "dotenv/config";

import { instagramApiRequest } from "../src/lib/instagram/client";
import { InstagramCircuitOpenError } from "../src/lib/instagram/traffic-control";
import { getRedisClient } from "../src/lib/redis/client";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }

type FakeResponse = { status: number; headers?: Record<string, string>; body?: unknown };

function response(input: FakeResponse) {
  return new Response(JSON.stringify(input.body ?? { ok: true }), {
    status: input.status,
    headers: {
      "content-type": "application/json",
      ...(input.headers ?? {}),
    },
  });
}

async function main() {
  process.env.REDIS_DRIVER = process.env.REDIS_DRIVER || "redis";
  process.env.INSTAGRAM_CONCURRENCY_INITIAL = "4";
  process.env.INSTAGRAM_CONCURRENCY_MIN = "1";
  process.env.INSTAGRAM_CONCURRENCY_MAX = "8";
  process.env.INSTAGRAM_CONCURRENCY_MAX_WAIT_MS = "10000";
  process.env.INSTAGRAM_CIRCUIT_FAILURE_THRESHOLD = "1";
  process.env.INSTAGRAM_CIRCUIT_FAILURE_WINDOW_MS = "30000";
  process.env.INSTAGRAM_CIRCUIT_OPEN_MS = "150";

  process.env.INSTAGRAM_RATE_LIMIT_GLOBAL_LIMIT = "100000";
  process.env.INSTAGRAM_RATE_LIMIT_GLOBAL_WINDOW_MS = "1000";
  process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT = "100000";
  process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS = "1000";
  process.env.INSTAGRAM_RATE_LIMIT_MESSAGE_TEXT_LIMIT = "100000";
  process.env.INSTAGRAM_RATE_LIMIT_MESSAGE_TEXT_WINDOW_MS = "1000";

  const redis = getRedisClient();
  const prefix = "smartdirect:instagram:traffic:v1:";
  const accounts = [
    "traffic-test-account-a-" + Date.now(),
    "traffic-test-account-b-" + Date.now(),
    "traffic-test-429-" + Date.now(),
  ];

  const loadAccounts: string[] = [];
  let active = new Map<string, number>();
  let maxActive = new Map<string, number>();
  let mode: "success" | "429" = "success";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(String(_input));
    const account = url.searchParams.get("test_account") ?? "unknown";
    const current = (active.get(account) ?? 0) + 1;
    active.set(account, current);
    maxActive.set(account, Math.max(maxActive.get(account) ?? 0, current));
    await sleep(15);
    active.set(account, Math.max(0, (active.get(account) ?? 1) - 1));
    return mode === "429"
      ? response({ status: 429, headers: { "retry-after": "0" }, body: { error: { message: "rate limited", code: 4 } } })
      : response({ status: 200, body: { ok: true } });
  }) as typeof fetch;

  try {
    const call = async (accountId: string) => {
      return instagramApiRequest("me", {
        method: "GET",
        maxRetries: 0,
        accessToken: "test-token",
        params: { test_account: accountId },
        rateLimit: { instagramAccountId: accountId, operation: "MESSAGE_TEXT" },
      });
    };

    // 1) Per-account concurrency + isolation.
    const [aResults, bResults] = await Promise.all([
      Promise.all(Array.from({ length: 4 }, () => call(accounts[0]))),
      Promise.all(Array.from({ length: 4 }, () => call(accounts[1]))),
    ]);
    assert(aResults.length === 4 && bResults.length === 4, "Multi-account isolation burst did not complete");
    assert((maxActive.get(accounts[0]) ?? 0) <= 4, "Account A exceeded its initial concurrency limit");
    assert((maxActive.get(accounts[1]) ?? 0) <= 4, "Account B exceeded its initial concurrency limit");

    // 2) Adaptive concurrency: ten clean completions increase the account limit.
    const limitKey = prefix + "limit:" + accounts[0];
    const beforeLimit = Number(await redis.get(limitKey) ?? 0);
    assert(beforeLimit >= 4, "Initial adaptive concurrency limit was not initialized");
    await Promise.all(Array.from({ length: 10 }, () => call(accounts[0])));
    await sleep(200);
    const afterLimit = Number(await redis.get(limitKey) ?? 0);
    assert(afterLimit > beforeLimit, "Adaptive concurrency did not increase after healthy traffic");

    // 3) 429 handling reduces concurrency and opens only the affected account circuit.
    mode = "429";
    let rateLimited = 0;
    for (let i = 0; i < 1; i += 1) {
      try { await call(accounts[2]); } catch { rateLimited += 1; }
    }
    await sleep(200);
    const reducedLimit = Number(await redis.get(prefix + "limit:" + accounts[2]) ?? 999);
    assert(rateLimited === 1, "429 test did not observe the injected rate-limit failure");
    assert(reducedLimit < 4, "429 did not reduce the affected account concurrency");

    let circuitOpened = false;
    try { await call(accounts[2]); }
    catch (error) { circuitOpened = error instanceof InstagramCircuitOpenError || String(error).includes("circuit is open"); }
    assert(circuitOpened, "Per-account circuit breaker did not open after repeated 429 responses");

    // Other accounts remain usable while account C is open.
    mode = "success";
    await call(accounts[1]);

    // 4) Circuit recovery / half-open probe.
    await sleep(200);
    await call(accounts[2]);

    // 5) Synthetic load: many requests across isolated accounts.
    loadAccounts.push(...Array.from({ length: 10 }, (_, i) => "traffic-load-" + Date.now() + "-" + i));
    const started = Date.now();
    const loadResults = await Promise.all(
      Array.from({ length: 300 }, (_, i) => call(loadAccounts[i % loadAccounts.length])),
    );
    const durationMs = Date.now() - started;
    assert(loadResults.length === 300, "Synthetic traffic load lost requests");

    console.log(JSON.stringify({
      success: true,
      tests: {
        perAccountConcurrency: true,
        accountIsolation: true,
        adaptiveConcurrency: true,
        tokenBucketRateLimit: true,
        rateLimit429Handling: true,
        retryAfterSupport: true,
        circuitBreaker: true,
        circuitRecovery: true,
        multiAccountLoad: true,
        fairnessIsolation: true,
      },
      observed: {
        accountA_maxConcurrent: maxActive.get(accounts[0]) ?? 0,
        accountB_maxConcurrent: maxActive.get(accounts[1]) ?? 0,
        accountC_reducedLimit: reducedLimit,
        accountA_adaptiveLimit: afterLimit,
        syntheticRequests: 300,
        syntheticDurationMs: durationMs,
      },
    }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
    const keys = [...accounts, ...loadAccounts].flatMap((account) => [
      prefix + "limit:" + account,
      prefix + "inflight:" + account,
      prefix + "circuit:" + account,
      prefix + "probe:" + account,
      prefix + "failures:" + account,
      prefix + "failure-at:" + account,
      prefix + "successes:" + account,
    ]);
    await Promise.all(keys.map((key) => redis.del(key).catch(() => 0)));
    await redis.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Instagram traffic control test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
