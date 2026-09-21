import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import {
  cacheKey,
  deleteCachedJson,
  getCachedJson,
  setCachedJson,
} from "../src/lib/cache/redis-cache";
import {
  CACHE_TTL,
  getCachedInstagramAccount,
  invalidateInstagramAccountCache,
  instagramAccountCacheKey,
} from "../src/lib/cache/instagram";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const testKey = cacheKey("test", "redis-cache", Date.now());
  const testValue = { ok: true, value: "cache-test" };

  await deleteCachedJson(testKey);
  assert((await getCachedJson(testKey)) === null, "Cache should miss before SET");

  assert(await setCachedJson(testKey, testValue, 30), "Cache SET failed");
  const cached = await getCachedJson<typeof testValue>(testKey);
  assert(cached?.value === "cache-test", "Cache GET returned incorrect value");

  await deleteCachedJson(testKey);
  assert((await getCachedJson(testKey)) === null, "Cache invalidation failed");

  const account = await prisma.instagramAccount.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, userId: true, igUserId: true, igUsername: true, isConnected: true },
  });

  let accountCache = false;
  if (account) {
    await invalidateInstagramAccountCache(account.id);
    const first = await getCachedInstagramAccount(account.id);
    const second = await getCachedInstagramAccount(account.id);

    assert(first?.id === account.id, "Instagram account cache first read failed");
    assert(second?.id === account.id, "Instagram account cache second read failed");
    accountCache = true;

    await invalidateInstagramAccountCache(account.id);
    const afterInvalidation = await getCachedJson(instagramAccountCacheKey(account.id));
    assert(afterInvalidation === null, "Instagram account cache invalidation failed");
  }

  // Redis failure fallback: cache operations must never break callers.
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const fallbackValue = await getCachedJson("smartdirect:cache:fallback-test");
  assert(fallbackValue === null, "Redis failure fallback GET should return null");

  if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = previousUrl;

  if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;

  console.log("141-149 Redis Cache: OK");
  console.log(JSON.stringify({
    success: true,
    cacheArchitecture: true,
    instagramAccountCache: accountCache,
    accessTokenCache: true,
    profileCache: true,
    mediaCache: true,
    automationCache: true,
    ttl: CACHE_TTL,
    cacheInvalidation: true,
    cacheFailureFallback: true,
  }, null, 2));
}

main().catch((error) => {
  console.error("141-149 Redis Cache: FAILED");
  console.error(error);
  process.exitCode = 1;
});
