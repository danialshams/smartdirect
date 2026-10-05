import {
  acquireInstagramTrafficSlot,
  releaseInstagramTrafficSlot,
} from "@/lib/instagram/traffic-control";

type RedisClient = Awaited<ReturnType<typeof import("@/lib/redis/client").getRedisClient>>;

const ACCOUNT_ID = `traffic-container-status-${Date.now()}`;
const OPERATION = "PUBLISH_MEDIA" as const;
const PREFIX = "smartdirect:instagram:traffic:v1";
const INITIAL_LIMIT = 4;

function accountKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function keys(accountId: string) {
  const a = accountKeyPart(accountId);
  return {
    limit: `${PREFIX}:limit:${a}`,
    inflight: `${PREFIX}:inflight:${a}`,
    lease: `${PREFIX}:lease:${a}`,
  };
}

async function diagnostics(redis: RedisClient) {
  const k = keys(ACCOUNT_ID);
  const [limit, inflight, ttl] = await Promise.all([
    redis.get<number>(k.limit),
    redis.get<number>(k.inflight),
    redis.ttl(k.inflight),
  ]);

  let leaseCount = 0;
  let cursor: string | number = "0";

  do {
    const [nextCursor, members] = await redis.scan(cursor, {
      match: k.lease + ":*",
      count: 100,
    });
    leaseCount += members.length;
    cursor = nextCursor;
  } while (String(cursor) !== "0");

  return {
    limit: Number(limit ?? 0),
    inflight: Number(inflight ?? 0),
    inflightTtlSeconds: Number(ttl ?? -1),
    leaseCount,
  };
}

function context() {
  return {
    instagramAccountId: ACCOUNT_ID,
    operation: OPERATION,
  } as const;
}

async function cleanup(leases: Awaited<ReturnType<typeof acquireInstagramTrafficSlot>>[]) {
  for (const lease of leases) {
    try {
      await releaseInstagramTrafficSlot(lease);
    } catch {
      // Best-effort cleanup for the test account.
    }
  }
}

async function main() {
  const { getRedisClient } = await import("@/lib/redis/client");
  const redis = getRedisClient();

  const held: Awaited<ReturnType<typeof acquireInstagramTrafficSlot>>[] = [];
  let releasedForWaiter: Awaited<ReturnType<typeof acquireInstagramTrafficSlot>> | null = null;
  let timeoutObserved = false;

  try {
    const first = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 });
    held.push(first);

    const second = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 });
    held.push(second);

    const third = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 });
    held.push(third);

    const fourth = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 });
    held.push(fourth);

    const saturated = await diagnostics(redis);

    const waiter = acquireInstagramTrafficSlot(context(), { maxWaitMs: 2_000 });

    await new Promise((resolve) => setTimeout(resolve, 250));
    const released = held.shift();
    if (!released) throw new Error("Missing held lease to release.");

    await releaseInstagramTrafficSlot(released);

    releasedForWaiter = await waiter;
    const recovered = await diagnostics(redis);

    await releaseInstagramTrafficSlot(releasedForWaiter);
    releasedForWaiter = null;

    const afterRecovery = await diagnostics(redis);

    const remaining = [...held];
    await cleanup(remaining);
    held.length = 0;

    const afterCleanup = await diagnostics(redis);

    for (let i = 0; i < INITIAL_LIMIT; i += 1) {
      const lease = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 });
      held.push(lease);
    }

    try {
      await acquireInstagramTrafficSlot(context(), { maxWaitMs: 300 });
    } catch (error) {
      timeoutObserved = error instanceof Error && error.message === "INSTAGRAM_CONCURRENCY_WAIT_TIMEOUT";
    }

    const timeoutState = await diagnostics(redis);

    console.log(JSON.stringify({
      success:
        saturated.limit === INITIAL_LIMIT &&
        saturated.inflight === INITIAL_LIMIT &&
        saturated.leaseCount === INITIAL_LIMIT &&
        recovered.inflight === INITIAL_LIMIT &&
        recovered.leaseCount === INITIAL_LIMIT &&
        afterRecovery.inflight === INITIAL_LIMIT - 1 &&
        afterRecovery.leaseCount === INITIAL_LIMIT - 1 &&
        afterCleanup.inflight === 0 &&
        afterCleanup.leaseCount === 0 &&
        timeoutObserved &&
        timeoutState.inflight === INITIAL_LIMIT &&
        timeoutState.leaseCount === INITIAL_LIMIT,
      tests: {
        accountSaturatesAtFour: saturated.inflight === INITIAL_LIMIT && saturated.leaseCount === INITIAL_LIMIT,
        waiterRecoversAfterRelease: recovered.inflight === INITIAL_LIMIT && recovered.leaseCount === INITIAL_LIMIT,
        slotReleasedAfterWaiter: afterRecovery.inflight === INITIAL_LIMIT - 1 && afterRecovery.leaseCount === INITIAL_LIMIT - 1,
        fullCleanup: afterCleanup.inflight === 0 && afterCleanup.leaseCount === 0,
        timeoutWhenAllFourRemainHeld: timeoutObserved,
        diagnosticsRemainConsistent: timeoutState.inflight === INITIAL_LIMIT && timeoutState.leaseCount === INITIAL_LIMIT,
      },
      observed: {
        accountId: ACCOUNT_ID,
        saturated,
        recovered,
        afterRecovery,
        afterCleanup,
        timeoutState,
      },
    }, null, 2));
  } finally {
    if (releasedForWaiter) {
      try {
        await releaseInstagramTrafficSlot(releasedForWaiter);
      } catch {}
    }
    await cleanup(held);

    const k = keys(ACCOUNT_ID);
    try {
      await redis.del(k.limit, k.inflight);
    } catch {}
  }
}

main().catch((error) => {
  console.error("Instagram container-status pressure test failed:", error);
  process.exitCode = 1;
});
