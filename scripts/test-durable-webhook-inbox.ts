import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { persistWebhookInboxEvent, dispatchWebhookInboxEvent, recoverWebhookInbox, webhookInboxKey, markWebhookInboxDone, webhookInboxHealth } from "../src/lib/webhook/durable-inbox";
import { getJob, deleteJob } from "../src/lib/queue/core";
import { disconnectRedis } from "../src/lib/redis/client";

async function main() {
  const suffix = Date.now() + "-" + Math.floor(Math.random() * 1e7);
  const user = await prisma.user.create({
    data: { email: "ci-inbox-" + suffix + "@example.invalid", name: "CI inbox", password: "ci-only" },
  });
  let accountId = "";
  const jobIds: string[] = [];
  try {
    const account = await prisma.instagramAccount.create({
      data: {
        userId: user.id, igUserId: "ig-ci-" + suffix, igUsername: "ci_" + suffix,
        accessToken: "ci-token-not-real", isConnected: true,
      },
    });
    accountId = account.id;
    const event = { sender: { id: "friend1" }, message: { mid: "m1", text: "hello" } };
    const input = { instagramAccountId: accountId, eventType: "MESSAGING" as const, eventId: "m1", event };
    const one = await persistWebhookInboxEvent(input);
    assert.equal(one.status, "PENDING");
    const twice = await persistWebhookInboxEvent({ ...input, event: { changed: true } });
    assert.equal(one.id, twice.id, "Redelivery must be idempotent");
    assert.equal(await prisma.webhookInboxEvent.count({ where: { eventKey: one.eventKey } }), 1);
    const persisted = await prisma.webhookInboxEvent.findUniqueOrThrow({ where: { id: one.id } });
    assert.deepEqual(persisted.payload, event, "Redelivery cannot replace original payload");

    assert.equal(await dispatchWebhookInboxEvent(one.id), true);
    const sent = await prisma.webhookInboxEvent.findUniqueOrThrow({ where: { id: one.id } });
    assert.equal(sent.status, "DISPATCHED");
    assert(sent.queueJobId);
    jobIds.push(sent.queueJobId);
    assert.equal((await getJob(sent.queueJobId))?.type, "INSTAGRAM_WEBHOOK");
    assert.equal(await dispatchWebhookInboxEvent(one.id), false, "Duplicate delivery must not enqueue twice");
    await markWebhookInboxDone(webhookInboxKey(input));
    assert.equal((await prisma.webhookInboxEvent.findUniqueOrThrow({ where: { id: one.id } })).status, "DONE");
    assert.equal((await persistWebhookInboxEvent(input)).status, "DONE");

    const second = await persistWebhookInboxEvent({ ...input, eventId: "m2", event: { sender: { id: "friend2" }, message: { mid: "m2" } } });
    const scan = await recoverWebhookInbox(10);
    assert(scan.dispatched >= 1, "Recovery must enqueue a pending durable item");
    const replayed = await prisma.webhookInboxEvent.findUniqueOrThrow({ where: { id: second.id } });
    assert.equal(replayed.status, "DISPATCHED");
    assert(replayed.queueJobId);
    jobIds.push(replayed.queueJobId);
    const health = await webhookInboxHealth();
    assert(health.dispatched >= 1);
    console.log("Durable webhook idempotency + PostgreSQL/Redis recovery: OK");
  } finally {
    await Promise.allSettled(jobIds.map(id => deleteJob(id)));
    if (accountId) {
      await prisma.idempotencyRecord.deleteMany({ where: { tenantId: accountId } });
    }
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
    await disconnectRedis().catch(() => undefined);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
