import {
  acquireInstagramTrafficSlot,
  releaseInstagramTrafficSlot,
} from "@/lib/instagram/traffic-control";

const ACCOUNT_ID = `publish-container-pressure-${Date.now()}`;
const OPERATION = "PUBLISH_MEDIA" as const;

function context(operation = OPERATION) {
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
    // Simulate POST /media: the publish request successfully acquires and releases
    // its own account slot before Meta container polling begins.
    const mediaCreateSlot = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 });
    await releaseInstagramTrafficSlot(mediaCreateSlot);

    // Simulate unrelated traffic arriving immediately after container creation.
    for (let i = 0; i < 4; i += 1) {
      held.push(await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_000 }));
    }

    const statusStartedAt = Date.now();
    let statusTimeout = false;

    try {
      // This is the exact admission point used by containerStatus():
      // GET /{containerId} must first acquire the same account-level slot.
      const statusSlot = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 350 });
      await releaseInstagramTrafficSlot(statusSlot);
    } catch (error) {
      statusTimeout = error instanceof Error && error.message === "INSTAGRAM_CONCURRENCY_WAIT_TIMEOUT";
    }

    const statusWaitMs = Date.now() - statusStartedAt;

    // Prove that releasing one unrelated request immediately unblocks the
    // container-status admission.
    const released = held.shift();
    if (!released) throw new Error("Missing pressure lease.");

    await releaseInstagramTrafficSlot(released);

    const recoveryStartedAt = Date.now();
    const recoveredStatusSlot = await acquireInstagramTrafficSlot(context(), { maxWaitMs: 1_500 });
    const recoveryWaitMs = Date.now() - recoveryStartedAt;
    await releaseInstagramTrafficSlot(recoveredStatusSlot);

    const success = statusTimeout && recoveryWaitMs < 1_500;

    console.log(JSON.stringify({
      success,
      reproduction: {
        postMediaSlotSucceeded: true,
        unrelatedAccountTrafficFilledAllFourSlots: true,
        containerStatusBlocked: statusTimeout,
        statusWaitMs,
        containerStatusRecoveredAfterOneSlotRelease: true,
        recoveryWaitMs,
      },
      conclusion: success
        ? "REPRODUCED: container status can time out behind unrelated same-account traffic even though the traffic limiter itself is consistent."
        : "NOT_REPRODUCED",
    }, null, 2));
  } finally {
    await cleanup(held);

    const { getRedisClient } = await import("@/lib/redis/client");
    const redis = getRedisClient();
    const a = ACCOUNT_ID.replace(/[^a-zA-Z0-9_-]/g, "_");
    await redis.del(
      `smartdirect:instagram:traffic:v1:limit:${a}`,
      `smartdirect:instagram:traffic:v1:inflight:${a}`,
    );
  }
}

main().catch((error) => {
  console.error("Instagram publish container pressure reproduction failed:", error);
  process.exitCode = 1;
});
