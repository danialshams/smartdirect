import { prisma } from "@/lib/prisma";
import { getInstagramMessagingWindow } from "@/lib/instagram/messaging-window";

/**
 * Inbound user requests are stronger than automation rules. The existing
 * Conversation.isActive is the durable automation pause state.
 * Explicit full-contact preferences and offered Quick Replies are audited in
 * PostgreSQL, so no new schema or cache-only consent is required.
 */
// Reserved payload is intentionally not a configurable automation keyword.
export const AUTOMATION_STOP_QUICK_REPLY_PAYLOAD = "DAIRA_SYSTEM_AUTOMATION_STOP_V1";
export const AUTOMATION_STOP_QUICK_REPLY_TITLE = "توقف پاسخ خودکار";
const STOP_OFFER_ACTION = "DAIRA_AUTOMATION_STOP_OPTION_SHOWN";
const CONTACT_STOP_ACTION = "DAIRA_RECIPIENT_DO_NOT_CONTACT";
const CONTACT_START_ACTION = "DAIRA_RECIPIENT_CONTACT_RESUMED";

type InboundPreference = "STOP" | "START" | "AUTO_STOP" | "AUTO_START";
const normalize = (value: string) => value.normalize("NFKC")
  .replace(/[\u200c\u200e\u200f]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

export function getInboundAutomationPreference(
  text: string | null | undefined, quickReplyPayload?: string | null,
): InboundPreference | null {
  if (quickReplyPayload === AUTOMATION_STOP_QUICK_REPLY_PAYLOAD) return "AUTO_STOP";
  const value = normalize(text || "");
  // Stop ALL outbound messages (including manual); only explicit START lifts this.
  if (["stop", "/stop", "unsubscribe", "لغو پیام", "لغو پیام ها",
    "دیگر پیام نده", "دیگه پیام نده", "پیام نده"].includes(value)) return "STOP";
  if (["start", "/start", "subscribe", "شروع مجدد پیام"].includes(value)) return "START";
  // Only the robot is paused; a human can still respond within Meta's window.
  if (["توقف پاسخ خودکار", "توقف پیام های خودکار", "لغو پاسخ خودکار"].includes(value)) return "AUTO_STOP";
  if (["فعال سازی پاسخ خودکار", "شروع مجدد پاسخ خودکار"].includes(value)) return "AUTO_START";
  return null;
}

/** Stores the full no-contact preference separately from an automation pause. */
export async function isManualMessagingOptedOut(conversationId: string): Promise<boolean> {
  const latest = await prisma.auditLog.findFirst({
    where: {
      targetType: "CONVERSATION", targetId: conversationId,
      action: { in: [CONTACT_STOP_ACTION, CONTACT_START_ACTION] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { action: true },
  });
  if (latest) return latest.action === CONTACT_STOP_ACTION;
  // Pre-upgrade STOP commands were stored as inbound text, not in AuditLog.
  // Respect them without requiring any SQL schema migration.
  const legacy = await prisma.conversationMessage.findFirst({
    where: { conversationId, direction: "INBOUND", text: {
      in: ["STOP", "stop", "/stop", "unsubscribe", "لغو پیام", "لغو پیام‌ها",
        "لغو پیام ها", "دیگر پیام نده", "دیگه پیام نده", "پیام نده",
        "START", "start", "/start", "subscribe", "شروع مجدد پیام"],
    } },
    orderBy: { createdAt: "desc" }, select: { text: true },
  });
  return legacy ? getInboundAutomationPreference(legacy.text) === "STOP" : false;
}

/** Process a service command after storing the incoming DM (no unsolicited acknowledgement). */
export async function applyInboundAutomationPreference(
  conversationId: string,
  text: string | null | undefined,
  quickReplyPayload?: string | null,
): Promise<boolean> {
  const preference = getInboundAutomationPreference(text, quickReplyPayload);
  if (!preference) return false;
  if (preference === "AUTO_START" && await isManualMessagingOptedOut(conversationId)) {
    return true; // Only an explicit contact START can reverse full opt-out.
  }
  if (preference === "STOP" || preference === "START") {
    await prisma.auditLog.create({ data: {
      action: preference === "STOP" ? CONTACT_STOP_ACTION : CONTACT_START_ACTION,
      targetType: "CONVERSATION", targetId: conversationId,
    } });
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isActive: preference === "START" || preference === "AUTO_START" },
  });
  return true;
}

/**
 * Offers a Persian Quick Reply just once per conversation, on the first
 * compatible plain-text normal DM. AuditLog is durable and needs no migration;
 * a short Redis NX lease serializes concurrent workers. A failed send releases
 * the lease without recording an offer.
 */
export async function claimFirstAutomationStopOption(
  instagramAccountId: string, participantId: string,
): Promise<null | ((sent: boolean) => Promise<void>)> {
  const conversation = await prisma.conversation.findUnique({
    where: { instagramAccountId_participantId: { instagramAccountId, participantId } },
    select: { id: true },
  });
  if (!conversation) return null;
  const { getRedisClient } = await import("@/lib/redis/client");
  const redis = getRedisClient();
  const key = "daira:stop-option-lease:" + conversation.id;
  const locked = await redis.set(key, "1", { nx: true, ex: 90 });
  if (locked !== "OK") return null;
  try {
    const prior = await prisma.auditLog.findFirst({
      where: { targetType: "CONVERSATION", targetId: conversation.id, action: STOP_OFFER_ACTION },
      select: { id: true },
    });
    if (prior) {
      await redis.del(key);
      return null;
    }
    return async (sent: boolean) => {
      try {
        if (sent) {
          await prisma.auditLog.create({ data: {
            action: STOP_OFFER_ACTION, targetType: "CONVERSATION", targetId: conversation.id,
          } });
        }
      } catch (error) {
        // The Instagram send has already succeeded. Do not retry it for a log failure.
        console.error("[META_SAFETY] Could not record automation stop option", error);
      } finally {
        await redis.del(key).catch(() => undefined);
      }
    };
  } catch (error) {
    await redis.del(key).catch(() => undefined);
    throw error;
  }
}

export type AutomatedMessageGate = "OPTED_OUT" | "NO_INBOUND_MESSAGE" | "INSTAGRAM_24H_WINDOW_CLOSED" | null;

/** Pure policy check; used by the runtime guard and regression tests. */
export function automatedMessageBlockReason(input: {
  active: boolean | null;
  lastInboundAt: Date | null;
  isPrivateReply: boolean;
  now?: Date;
}): AutomatedMessageGate {
  if (input.active === false) return "OPTED_OUT";
  // A comment has one sanctioned Private Reply; it NEVER opens normal DM.
  if (input.isPrivateReply) return null;
  if (!input.lastInboundAt) return "NO_INBOUND_MESSAGE";
  const window = getInstagramMessagingWindow(input.lastInboundAt, input.now);
  // HUMAN_AGENT is reserved for human-operated inbox, not automated messages.
  return window.mode === "STANDARD" && window.remainingMs > 0
    ? null
    : "INSTAGRAM_24H_WINDOW_CLOSED";
}

export async function getAutomatedMessageBlockReason(input: {
  instagramAccountId: string;
  participantId: string;
  isPrivateReply?: boolean;
}): Promise<AutomatedMessageGate> {
  const conversation = await prisma.conversation.findUnique({
    where: { instagramAccountId_participantId: {
      instagramAccountId: input.instagramAccountId, participantId: input.participantId,
    } },
    select: { isActive: true, messages: {
      where: { direction: "INBOUND" }, orderBy: { createdAt: "desc" },
      take: 1, select: { createdAt: true },
    } },
  });
  return automatedMessageBlockReason({
    active: conversation?.isActive ?? null,
    lastInboundAt: conversation?.messages[0]?.createdAt ?? null,
    isPrivateReply: input.isPrivateReply === true,
  });
}

/**
 * Additional product-level abuse guard, NOT a purported official Meta quota.
 * One Instagram recipient cannot receive an unbounded burst of automated
 * replies across different rules from the same business account.
 * A single atomic Redis key is shared by all Vercel/worker instances.
 */
export async function reserveRecipientAutomatedMessageBudget(input: {
  instagramAccountId: string;
  participantId: string;
}): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const { getRedisClient } = await import("@/lib/redis/client");
  const hash = createHash("sha256")
    .update(input.instagramAccountId + ":" + input.participantId)
    .digest("hex");
  const redis = getRedisClient();
  const count = await redis.eval(
    'local n = redis.call("INCR", KEYS[1]); if n == 1 then redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1])) end; return n',
    ["smartdirect:meta:recipient-message-budget:v1:" + hash],
    ["600"],
  ) as number;
  // 20 outbound automated sends / recipient / 10 minutes. This limit is an
  // application anti-spam guard and may be tuned after observing actual usage.
  return Number(count) <= 20;
}
