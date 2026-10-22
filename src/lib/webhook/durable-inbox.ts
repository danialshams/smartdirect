import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enqueueInstagramWebhookEvent } from "@/lib/webhook/queue";
import { claimInstagramWebhookEvent, retryInstagramWebhookEvent, failInstagramWebhookEvent } from "@/lib/idempotency/webhook";
import { getJob } from "@/lib/queue/core";
import { observabilityLogger } from "@/lib/observability/logger";
import { recordLatency, recordFailure } from "@/lib/observability/metrics";

export type DurableWebhookEventType = "MESSAGING" | "COMMENT" | "LIVE_COMMENT";
export type DurableWebhookInput = {
  instagramAccountId: string;
  eventType: DurableWebhookEventType;
  eventId: string;
  event: unknown;
};

const MIN_RETRY_MS = 1500;
const QUEUED_RECHECK_MS = 5 * 60_000;
const DISPATCH_LEASE_MS = 90_000;

export function webhookInboxKey(input: Pick<DurableWebhookInput, "instagramAccountId" | "eventType" | "eventId">) {
  const material = JSON.stringify([input.instagramAccountId, input.eventType, input.eventId]);
  return createHash("sha256").update(material).digest("hex");
}

/** Persist to PostgreSQL *before* attempting Redis or Workflow. A failed insert must
 * make the webhook return a 5xx, so Meta is free to retry delivery. */
export async function persistWebhookInboxEvent(input: DurableWebhookInput) {
  const eventKey = webhookInboxKey(input);
  return prisma.webhookInboxEvent.upsert({
    where: { eventKey },
    create: {
      eventKey,
      instagramAccountId: input.instagramAccountId,
      eventType: input.eventType,
      eventId: input.eventId,
      payload: JSON.parse(JSON.stringify(input.event)),
    },
    // Never overwrite payload, completed state, or delivery attempt on redelivery.
    update: {},
    select: { id: true, eventKey: true, status: true },
  });
}

async function postpone(id: string, message: string, delayMs: number) {
  await prisma.webhookInboxEvent.updateMany({
    where: { id, status: { not: "DONE" } },
    data: {
      status: "PENDING",
      leaseUntil: null,
      lastError: message.slice(0, 1000),
      nextAttemptAt: new Date(Date.now() + delayMs),
    },
  });
}

/** Claim the database row with a compare-and-swap. Concurrent serverless
 * receivers and worker recovery scanners may safely attempt dispatch. */
export async function dispatchWebhookInboxEvent(id: string, launch?: (jobId: string) => Promise<unknown>) {
  const row = await prisma.webhookInboxEvent.findUnique({ where: { id } });
  if (!row || row.status === "DONE") return false;
  const now = new Date();

  // A Redis job may still be queued or active. Do not manufacture a duplicate.
  if (row.queueJobId && row.status === "DISPATCHED") {
    const existing = await getJob(row.queueJobId);
    if (existing && ["waiting", "delayed", "active"].includes(existing.status)) {
      await prisma.webhookInboxEvent.updateMany({
        where: { id, status: "DISPATCHED" },
        data: { nextAttemptAt: new Date(Date.now() + QUEUED_RECHECK_MS) },
      });
      return false;
    }
  }

  const claimed = await prisma.webhookInboxEvent.updateMany({
    where: {
      id,
      status: { in: ["PENDING", "DISPATCHED", "DISPATCHING"] },
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    data: {
      status: "DISPATCHING",
      attempts: { increment: 1 },
      leaseUntil: new Date(now.getTime() + DISPATCH_LEASE_MS),
      nextAttemptAt: new Date(now.getTime() + QUEUED_RECHECK_MS),
    },
  });
  if (!claimed.count) return false;

  let idempotencyKey: string | null = null;
  try {
    const claim = await claimInstagramWebhookEvent({
      instagramAccountId: row.instagramAccountId,
      eventType: row.eventType as DurableWebhookEventType,
      eventId: row.eventId,
      event: row.payload,
    });
    idempotencyKey = claim.key;
    if (!claim.claimed) {
      const previous = await prisma.idempotencyRecord.findUnique({
        where: { key: claim.key }, select: { status: true },
      });
      if (previous?.status === "COMPLETED") {
        await markWebhookInboxDone(row.eventKey);
        return true;
      }
      if (previous?.status !== "FAILED" || !await retryInstagramWebhookEvent(claim.key)) {
        await postpone(id, "IDEMPOTENCY_BUSY", 30_000);
        return false;
      }
    }
    const queued = await enqueueInstagramWebhookEvent({
      instagramAccountId: row.instagramAccountId,
      eventId: row.eventId,
      eventType: row.eventType as DurableWebhookEventType,
      event: row.payload,
      idempotencyKey: claim.key,
    });
    await prisma.webhookInboxEvent.updateMany({
      // Processing can finish before this write. Never overwrite DONE.
      where: { id, status: "DISPATCHING" },
      data: {
        status: "DISPATCHED",
        queueJobId: queued.id,
        leaseUntil: null,
        lastError: null,
        nextAttemptAt: new Date(Date.now() + QUEUED_RECHECK_MS),
      },
    });
    // Optional low-latency path on Vercel. The durable worker is the fallback.
    if (launch) {
      try {
        await launch(queued.id);
      } catch (error) {
        observabilityLogger.warn("webhook_workflow_launch_failed_queue_retained", {
          inboxId: id, jobId: queued.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A fast Worker may already have completed a successfully queued event.
    // Never turn a completed send back into FAILED on an outbox write race.
    const latest = await prisma.webhookInboxEvent.findUnique({
      where: { id }, select: { status: true },
    }).catch(() => null);
    if (latest?.status === "DONE") return true;
    if (idempotencyKey) {
      await failInstagramWebhookEvent(idempotencyKey, error).catch(() => undefined);
    }
    const backoff = Math.min(5 * 60_000, MIN_RETRY_MS * 2 ** Math.min(8, row.attempts));
    await postpone(id, message, backoff);
    await recordFailure("webhook_dispatch", "retryable");
    observabilityLogger.warn("webhook_dispatch_deferred", { inboxId: id, error: message, backoff });
    return false;
  }
}

export async function markWebhookInboxDone(eventKey: string) {
  const event = await prisma.webhookInboxEvent.findUnique({
    where: { eventKey }, select: { id: true, createdAt: true, status: true },
  });
  if (!event || event.status === "DONE") return;
  const completedAt = new Date();
  const updated = await prisma.webhookInboxEvent.updateMany({
    where: { id: event.id, status: { not: "DONE" } },
    data: { status: "DONE", completedAt, leaseUntil: null, lastError: null },
  });
  if (updated.count) {
    await recordLatency("webhook_end_to_end", completedAt.getTime() - event.createdAt.getTime());
  }
}

export async function recoverWebhookInbox(limit = 40) {
  const due = await prisma.webhookInboxEvent.findMany({
    where: {
      status: { in: ["PENDING", "DISPATCHED", "DISPATCHING"] },
      nextAttemptAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: Math.max(1, Math.min(200, limit)),
    select: { id: true },
  });
  let dispatched = 0;
  let deferred = 0;
  for (const row of due) {
    try {
      if (await dispatchWebhookInboxEvent(row.id)) dispatched++;
      else deferred++;
    } catch (error) {
      deferred++;
      observabilityLogger.error("webhook_recovery_item_failed", {
        inboxId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { scanned: due.length, dispatched, deferred };
}

export async function webhookInboxHealth() {
  const [pending, dispatched, completed, oldest] = await Promise.all([
    prisma.webhookInboxEvent.count({ where: { status: { in: ["PENDING", "DISPATCHING"] } } }),
    prisma.webhookInboxEvent.count({ where: { status: "DISPATCHED" } }),
    prisma.webhookInboxEvent.count({ where: { status: "DONE", completedAt: { gte: new Date(Date.now() - 3600_000) } } }),
    prisma.webhookInboxEvent.findFirst({
      where: { status: { in: ["PENDING", "DISPATCHING", "DISPATCHED"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    pending, dispatched, completedLastHour: completed,
    oldestPendingAgeMs: oldest ? Date.now() - oldest.createdAt.getTime() : 0,
  };
}

/** Prevent indefinitely retaining private Meta webhook payloads in PostgreSQL.
 * Keep pending and dispatched events until an operator resolves them. */
export async function purgeCompletedWebhookInbox(retentionDays = 7, batchSize = 500) {
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? Math.min(retentionDays, 365) : 7;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const old = await prisma.webhookInboxEvent.findMany({
    where: { status: "DONE", completedAt: { lt: cutoff } },
    orderBy: { completedAt: "asc" },
    take: Math.max(1, Math.min(1000, batchSize)),
    select: { id: true },
  });
  if (!old.length) return 0;
  const deleted = await prisma.webhookInboxEvent.deleteMany({
    where: { id: { in: old.map(row => row.id) }, status: "DONE", completedAt: { lt: cutoff } },
  });
  return deleted.count;
}
