import "dotenv/config";

import { instagramApiRequest } from "../src/lib/instagram/client";
import { getRedisClient } from "../src/lib/redis/client";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

async function main() {
  process.env.REDIS_DRIVER = process.env.REDIS_DRIVER || "redis";
  process.env.INSTAGRAM_CONCURRENCY_INITIAL = "4";
  process.env.INSTAGRAM_CONCURRENCY_MIN = "1";
  process.env.INSTAGRAM_CONCURRENCY_MAX = "16";
  process.env.INSTAGRAM_CONCURRENCY_MAX_WAIT_MS = "5000";
  process.env.INSTAGRAM_RATE_LIMIT_GLOBAL_LIMIT = "100000";
  process.env.INSTAGRAM_RATE_LIMIT_GLOBAL_WINDOW_MS = "1000";
  process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT = "100000";
  process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS = "1000";
  process.env.INSTAGRAM_RATE_LIMIT_MESSAGE_TEXT_LIMIT = "100000";
  process.env.INSTAGRAM_RATE_LIMIT_MESSAGE_TEXT_WINDOW_MS = "1000";

  const redis = getRedisClient();
  const accountId = "traffic-release-" + Date.now();
  const prefix = "smartdirect:instagram:traffic:v1:";
  const inflightKey = prefix + "inflight:" + accountId;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    await sleep(20);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    // First verify a real API request acquires and then releases its slot.
    await instagramApiRequest("me", {
      method: "GET",
      maxRetries: 0,
      accessToken: "test-token",
      rateLimit: { instagramAccountId: accountId, operation: "MESSAGE_TEXT" },
    });

    await sleep(50);
    const afterSingle = Number(await redis.get(inflightKey) ?? 0);
    assert(afterSingle === 0, "Slot was not released after a completed API request");

    // Repeat the exact lifecycle to catch intermittent release leaks.
    await Promise.all(
      Array.from({ length: 20 }, () =>
        instagramApiRequest("me", {
          method: "GET",
          maxRetries: 0,
          accessToken: "test-token",
          rateLimit: { instagramAccountId: accountId, operation: "MESSAGE_TEXT" },
        }),
      ),
    );

    await sleep(100);
    const afterBurst = Number(await redis.get(inflightKey) ?? 0);
    assert(afterBurst === 0, "Slot leak detected after concurrent API request burst");

    // Prove the account is immediately reusable after the burst.
    await instagramApiRequest("me", {
      method: "GET",
      maxRetries: 0,
      accessToken: "test-token",
      rateLimit: { instagramAccountId: accountId, operation: "MESSAGE_TEXT" },
    });

    await sleep(50);
    const afterReuse = Number(await redis.get(inflightKey) ?? 0);
    assert(afterReuse === 0, "Account could not return to zero inflight after reuse");

    console.log(JSON.stringify({
      success: true,
      tests: {
        singleRequestRelease: true,
        concurrentBurstRelease: true,
        accountReusableAfterRelease: true,
      },
      observed: {
        accountId,
        afterSingle,
        afterBurst,
        afterReuse,
      },
    }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
    await Promise.all([
      redis.del(inflightKey).catch(() => 0),
      redis.del(prefix + "limit:" + accountId).catch(() => 0),
      redis.del(prefix + "circuit:" + accountId).catch(() => 0),
      redis.del(prefix + "probe:" + accountId).catch(() => 0),
      redis.del(prefix + "failures:" + accountId).catch(() => 0),
      redis.del(prefix + "failure-at:" + accountId).catch(() => 0),
      redis.del(prefix + "successes:" + accountId).catch(() => 0),
    ]);
    await redis.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Instagram traffic release test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
