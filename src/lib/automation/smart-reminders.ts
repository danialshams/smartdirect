import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue/core";
import { withConversationLock } from "@/lib/conversation/conversation-lock";
import { reminderBlockReason, reminderWindowValidAt } from "./smart-reminder-policy";
import { sendAutomationMessage } from "@/lib/automation/send-automation-message";

const STALE_CLAIM_MS = 10 * 60_000;
const MAX_DELIVERY_ATTEMPTS = 4;

/** Called after a successful automated normal DM has been persisted. */
export async function scheduleSmartReminder(input: {
  automationId: string; conversationId: string; anchorMessageId: string;
}) {
  const rule = await prisma.smartReminderRule.findUnique({
    where: { automationId: input.automationId },
    select: { id: true, delayMinutes: true, isActive: true, instagramAccountId: true },
  });
  if (!rule?.isActive) return;
  const [anchor, conversation, lastInbound] = await Promise.all([
    prisma.conversationMessage.findFirst({
      where: { id: input.anchorMessageId, conversationId: input.conversationId, direction: "OUTBOUND" },
      select: { id: true, createdAt: true },
    }),
    prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { id: true, instagramAccountId: true },
    }),
    prisma.conversationMessage.findFirst({
      where: { conversationId: input.conversationId, direction: "INBOUND" },
      orderBy: { createdAt: "desc" }, select: { createdAt: true },
    }),
  ]);
  if (!anchor || !conversation || conversation.instagramAccountId !== rule.instagramAccountId || !lastInbound) return;
  // A private comment reply alone does not open the Instagram messaging window.
  const dueAt = new Date(anchor.createdAt.getTime() + rule.delayMinutes * 60_000);
  if (!reminderWindowValidAt(lastInbound.createdAt, dueAt)) return;

  // Supersede earlier reminders, including those from different automations.
  await prisma.smartReminderDelivery.updateMany({
    where: { conversationId: conversation.id, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  const delivery = await prisma.smartReminderDelivery.upsert({
    where: { ruleId_anchorMessageId: { ruleId: rule.id, anchorMessageId: anchor.id } },
    create: { ruleId: rule.id, conversationId: conversation.id, anchorMessageId: anchor.id, dueAt },
    update: {},
  });
  if (delivery.status !== "PENDING" || delivery.queueJobId) return;
  try {
    const job = await enqueueJob("SMART_REMINDER", { deliveryId: delivery.id }, {
      instagramAccountId: rule.instagramAccountId,
      delayMs: Math.max(0, dueAt.getTime() - Date.now()),
      priority: "low", maxAttempts: 4,
    });
    await prisma.smartReminderDelivery.updateMany({
      where: { id: delivery.id, status: "PENDING", queueJobId: null },
      data: { queueJobId: job.id },
    });
  } catch (error) {
    // Remains in PostgreSQL and will be picked up by the worker's recovery scan.
    console.error("[SMART_REMINDER] enqueue failed, database recovery will retry", {
      deliveryId: delivery.id, error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Called for any newly received customer DM / story reply / postback. */
export async function cancelSmartRemindersForConversation(conversationId: string) {
  await prisma.smartReminderDelivery.updateMany({
    where: { conversationId, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

async function markSkipped(id: string, reason: string) {
  await prisma.smartReminderDelivery.update({
    where: { id }, data: { status: "SKIPPED", lastError: reason },
  });
}

/** Rechecks Meta's 24h policy and user silence immediately before sending. */
export async function processSmartReminder(deliveryId: string): Promise<void> {
  const candidate = await prisma.smartReminderDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, dueAt: true, conversation: {
      select: { instagramAccountId: true, participantId: true },
    } },
  });
  if (!candidate || candidate.status !== "PENDING" || candidate.dueAt > new Date()) return;

  await withConversationLock({
    instagramAccountId: candidate.conversation.instagramAccountId,
    participantId: candidate.conversation.participantId,
  }, async () => {
    const claimed = await prisma.smartReminderDelivery.updateMany({
      where: { id: deliveryId, status: "PENDING", dueAt: { lte: new Date() } },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    try {
      const delivery = await prisma.smartReminderDelivery.findUniqueOrThrow({
        where: { id: deliveryId },
        include: { rule: { include: { automation: { select: { isActive: true } },
          instagramAccount: { select: { isConnected: true, igUserId: true } } } },
          conversation: { include: { ConversationHandoff: { select: { active: true } } } } },
      });
      if (!delivery.rule.isActive || !delivery.rule.automation.isActive ||
          !delivery.rule.instagramAccount.isConnected || !delivery.conversation.isActive ||
          delivery.conversation.ConversationHandoff?.active) {
        await markSkipped(deliveryId, "RULE_ACCOUNT_OR_CONVERSATION_INACTIVE");
        return;
      }
      const [anchor, lastInbound, lastOutbound] = await Promise.all([
        prisma.conversationMessage.findUnique({ where: { id: delivery.anchorMessageId }, select: { createdAt: true } }),
        prisma.conversationMessage.findFirst({ where: { conversationId: delivery.conversationId, direction: "INBOUND" },
          orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.conversationMessage.findFirst({ where: { conversationId: delivery.conversationId, direction: "OUTBOUND" },
          orderBy: { createdAt: "desc" }, select: { id: true } }),
      ]);
      const blocked = reminderBlockReason({
        anchorAt: anchor?.createdAt ?? null,
        lastInboundAt: lastInbound?.createdAt ?? null,
        latestOutboundMatches: lastOutbound?.id === delivery.anchorMessageId,
        now: new Date(),
      });
      if (blocked) {
        await markSkipped(deliveryId, blocked);
        return;
      }

      const result = await sendAutomationMessage({
        instagramAccountId: delivery.conversation.instagramAccountId,
        instagramUserId: delivery.rule.instagramAccount.igUserId,
        recipientId: delivery.conversation.participantId,
        executionId: "smart-reminder:" + delivery.id,
        message: { id: "smart-reminder-message:" + delivery.id, messageType: "TEXT",
          text: delivery.rule.text, mediaUrl: null, mediaId: null },
      });
      if (!result.success) throw new Error(result.error || "Instagram message delivery failed");
      if (result.igMessageId) {
        await prisma.conversationMessage.upsert({
          where: { igMessageId: result.igMessageId },
          create: { conversationId: delivery.conversationId, direction: "OUTBOUND",
            messageType: "TEXT", text: delivery.rule.text, igMessageId: result.igMessageId },
          update: {},
        });
      }
      await prisma.conversation.update({
        where: { id: delivery.conversationId }, data: { lastMessageAt: new Date() },
      });
      await prisma.smartReminderDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", sentAt: new Date(), igMessageId: result.igMessageId || null, lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const previous = await prisma.smartReminderDelivery.findUnique({
        where: { id: deliveryId }, select: { attempts: true },
      });
      const attempts = previous?.attempts ?? MAX_DELIVERY_ATTEMPTS;
      const failed = attempts >= MAX_DELIVERY_ATTEMPTS;
      await prisma.smartReminderDelivery.updateMany({
        where: { id: deliveryId, status: "PROCESSING" },
        data: {
          status: failed ? "FAILED" : "PENDING",
          lastError: message,
          // Redis jobs may retry sooner; the database deadline is authoritative.
          ...(failed ? {} : { dueAt: new Date(Date.now() + 2 ** Math.min(attempts, 6) * 60_000) }),
        },
      });
      throw error;
    }
  });
}

/** Durable fallback if Redis is restarted, loses jobs, or enqueue initially fails. */
export async function recoverDueSmartReminders(limit = 25): Promise<void> {
  const now = new Date();
  await prisma.smartReminderDelivery.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    data: { status: "PENDING", lastError: "Recovered stale processing claim" },
  });
  const due = await prisma.smartReminderDelivery.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" }, take: limit, select: { id: true },
  });
  for (const row of due) {
    try { await processSmartReminder(row.id); }
    catch (error) {
      console.error("[SMART_REMINDER] recovery attempt failed", {
        id: row.id, error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
