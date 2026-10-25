import { prisma } from "@/lib/prisma";
import { getInstagramMessagingWindow } from "@/lib/instagram/messaging-window";

/**
 * Inbound user requests are stronger than automation rules. The existing
 * Conversation.isActive column is the durable, account-scoped opt-out switch:
 * no schema migration or Redis-only preference can be lost on redeployment.
 */
export function getInboundAutomationPreference(text: string | null | undefined): "STOP" | "START" | null {
  const normalized = (text || "").normalize("NFKC").replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
  if (["stop", "/stop", "unsubscribe", "لغو پیام", "لغو پیام ها", "لغو پیام‌ها",
    "دیگر پیام نده", "دیگه پیام نده", "پیام نده", "توقف پاسخ خودکار",
    "توقف پیام های خودکار", "توقف پیام‌های خودکار"].includes(normalized)) return "STOP";
  if (["start", "/start", "subscribe", "شروع مجدد پیام", "فعال سازی پاسخ خودکار",
    "فعال‌سازی پاسخ خودکار"].includes(normalized)) return "START";
  return null;
}

/** Process STOP/START exactly once per inbound event, AFTER it was stored. */
export async function applyInboundAutomationPreference(
  conversationId: string,
  text: string | null | undefined,
): Promise<boolean> {
  const preference = getInboundAutomationPreference(text);
  if (!preference) return false;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isActive: preference === "START" },
  });
  return true;
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
