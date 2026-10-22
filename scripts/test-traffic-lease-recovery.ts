import assert from "node:assert/strict";
import { getRedisClient } from "../src/lib/redis/client";
import { acquireInstagramTrafficSlot, releaseInstagramTrafficSlot } from "../src/lib/instagram/traffic-control";

async function main() {
  const redis = getRedisClient();
  const accountId = "lease-recovery-" + Date.now();
  const prefix = "smartdirect:instagram:traffic:v1:";
  const leaseKey = prefix + "lease:" + accountId;
  const inflightKey = prefix + "inflight:" + accountId;
  try {
    await redis.zadd(leaseKey, { score: Date.now() - 60_000, member: "expired-worker" });
    await redis.set(inflightKey, 8, { ex: 120 });
    const lease = await acquireInstagramTrafficSlot(
      { instagramAccountId: accountId, operation: "MESSAGE_TEXT" },
      { maxWaitMs: 3_000 },
    );
    const active = Number(await redis.get(inflightKey) ?? 0);
    assert.equal(active, 1, "An expired lease must not consume a live traffic slot");
    assert.equal(await releaseInstagramTrafficSlot(lease), true);
    assert.equal(Number(await redis.get(inflightKey) ?? 0), 0);
    console.log("Instagram stale-lease recovery: OK");
  } finally {
    await Promise.all([
      redis.del(leaseKey), redis.del(inflightKey),
      redis.del(prefix + "limit:" + accountId),
      redis.del(prefix + "critical-pending:" + accountId),
    ]);
    await redis.disconnect();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
