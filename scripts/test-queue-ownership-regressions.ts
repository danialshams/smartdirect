import assert from "node:assert/strict";
import { cancelJob, claimNextJob, completeJob, deleteJob, enqueueJob, getJob, getQueueKeys } from "../src/lib/queue/core";
import { recoverStalledJobs } from "../src/lib/queue/recovery";
import { getRedisClient } from "../src/lib/redis/client";

async function main() {
  const redis = getRedisClient();
  const ns = "ownership-" + Date.now();
  const keys = getQueueKeys(ns);
  const ids: string[] = [];
  try {
    const first = await enqueueJob("TEST", { message: "a" }, { queueNamespace: ns, instagramAccountId: "account-1", orderingKey: "account-1:alice" });
    const second = await enqueueJob("TEST", { message: "b" }, { queueNamespace: ns, instagramAccountId: "account-1", orderingKey: "account-1:bob" });
    const third = await enqueueJob("TEST", { message: "c" }, { queueNamespace: ns, instagramAccountId: "account-1", orderingKey: "account-1:alice" });
    ids.push(first.id, second.id, third.id);
    const claim1 = await claimNextJob("worker-a", ns);
    const claim2 = await claimNextJob("worker-b", ns);
    assert(claim1 && claim2, "Independent conversations should run concurrently");
    assert.notEqual(claim1.orderingKey, claim2.orderingKey);
    assert.equal(await claimNextJob("worker-c", ns), null, "Same conversation must remain serialized");
    await completeJob(claim1.id);
    const claim3 = await claimNextJob("worker-c", ns);
    assert.equal(claim3?.id, third.id, "Next same-conversation job should start once unlocked");
    await completeJob(claim2.id);
    await completeJob(claim3!.id);

    const crashed = await enqueueJob("TEST", { message: "recover" }, { queueNamespace: ns, maxAttempts: 3 });
    ids.push(crashed.id);
    const active = await claimNextJob("crash-worker", ns);
    assert.equal(active?.id, crashed.id);
    await redis.del("smartdirect:queue:claim:" + crashed.id);
    await redis.zadd(keys.active, { score: Date.now() - 120_000, member: crashed.id });
    const recovered = await recoverStalledJobs(10, ns);
    assert.equal(recovered.recovered, 1, "Stalled job should be rescued");
    const latest = await getJob(crashed.id);
    assert.equal(latest?.status, "waiting");
    const claimed = await claimNextJob("recovery-worker", ns);
    assert.equal(claimed?.id, crashed.id);
    const failed = await import("../src/lib/queue/core").then(mod => mod.failJob(crashed.id, new Error("transient")));
    assert.equal(failed?.status, "delayed", "A failed job should atomically enter retry delay");
    assert.equal(await redis.zcard(keys.active), 0);
    await cancelJob(crashed.id);
    console.log("Queue ownership, parallel conversations and stalled recovery: OK");
  } finally {
    await Promise.all(ids.map(id => deleteJob(id).catch(() => undefined)));
    await redis.disconnect();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
