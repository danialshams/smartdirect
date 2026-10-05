import {
  acquireInstagramTrafficSlot,
  releaseInstagramTrafficSlot,
} from "@/lib/instagram/traffic-control";

const ACCOUNT_ID = `publish-priority-pressure-${Date.now()}`;
const NORMAL_OPERATION = "MESSAGE_TEXT" as const;
const CRITICAL_OPERATION = "PUBLISH_MEDIA" as const;

function context(operation: typeof NORMAL_OPERATION | typeof CRITICAL_OPERATION) {
  return {
    instagramAccountId: ACCOUNT_ID,
    operation,
  } as const;
}

async function cleanup(leases: Awaited<ReturnType<typeof acquireInstagramTrafficSlot>>[]) {
  for (const lease of leases) {
    try {
      await releaseInstagramTrafficSlot(lease);
    } catch {}
  }
}

async function main() {
  const held: Awaited<ReturnType<typeof acquireInstagramTrafficSlot>>[] = [];

  try {
    // Without a publish operation waiting, normal traffic can use all four slots.
    for (let i = 0; i < 4; i += 1) {
      held.push(await acquireInstagramTrafficSlot(context(NORMAL_OPERATION), { maxWaitMs: 1_000 }));
    }
    const normalCanFillAllFour = held.length === 4;

    // Leave three normal operations running. A publish operation now becomes pending.
    const releasedBeforePublish = held.pop();
    if (!releasedBeforePublish) throw new Error("Missing normal pressure lease.");
    await releaseInstagramTrafficSlot(releasedBeforePublish);

    const criticalStartedAt = Date.now();
    const criticalPromise = acquireInstagramTrafficSlot(context(CRITICAL_OPERATION), { maxWaitMs: 1_000 });

    // Give the critical request time to register as pending, then verify that
    // normal traffic cannot consume its protected fourth slot.
    await new Promise((resolve) => setTimeout(resolve, 50));

    let normalBlocked = false;
    try {
      const normalSlot = await acquireInstagramTrafficSlot(context(NORMAL_OPERATION), { maxWaitMs: 350 });
      await releaseInstagramTrafficSlot(normalSlot);
    } catch (error) {
      normalBlocked = error instanceof Error && error.message === "INSTAGRAM_CONCURRENCY_WAIT_TIMEOUT";
    }

    const criticalLease = await criticalPromise;
    const criticalWaitMs = Date.now() - criticalStartedAt;

    await releaseInstagramTrafficSlot(criticalLease);
    await cleanup(held);
    held.length = 0;

    // After the publish operation is gone, all four slots are available to normal traffic again.
    const normalAfterPublish: Awaited<ReturnType<typeof acquireInstagramTrafficSlot>>[] = [];
    for (let i = 0; i < 4; i += 1) {
      normalAfterPublish.push(await acquireInstagramTrafficSlot(context(NORMAL_OPERATION), { maxWaitMs: 1_000 }));
    }
    const normalGetsAllFourAfterPublish = normalAfterPublish.length === 4;
    await cleanup(normalAfterPublish);

    const success =
      normalCanFillAllFour
      && normalBlocked
      && criticalWaitMs < 1_000
      && normalGetsAllFourAfterPublish;

    console.log(JSON.stringify({
      success,
      protection: {
        normalCanFillAllFourWhenNoPublishPending: normalCanFillAllFour,
        normalTrafficBlockedFromReservedPublishSlot: normalBlocked,
        publishAcquiredProtectedSlot: criticalWaitMs < 1_000,
        publishAcquireWaitMs: criticalWaitMs,
        normalGetsAllFourAfterPublishCompletes: normalGetsAllFourAfterPublish,
      },
      conclusion: success
        ? "PASS: publish traffic dynamically protects one account slot only while a publish request is pending."
        : "FAIL",
    }, null, 2));
  } finally {
    await cleanup(held);

    const { getRedisClient } = await import("@/lib/redis/client");
    const redis = getRedisClient();
    const a = ACCOUNT_ID.replace(/[^a-zA-Z0-9_-]/g, "_");
    await redis.del(
      `smartdirect:instagram:traffic:v1:limit:${a}`,
      `smartdirect:instagram:traffic:v1:inflight:${a}`,
      `smartdirect:instagram:traffic:v1:critical-pending:${a}`,
    );
  }
}

main().catch((error) => {
  console.error("Instagram publish priority pressure test failed:", error);
  process.exitCode = 1;
});
