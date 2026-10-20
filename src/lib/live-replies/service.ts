import { prisma } from "@/lib/prisma";
import { instagramApiRequest } from "@/lib/instagram/client";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { sendAutomationMessage } from "@/lib/automation/send-automation-message";
import { normalizeAutomationText } from "@/lib/automation/trigger";
import {
  defaultLiveMessage, LIVE_AUTOMATION_TYPE, LIVE_COMMENT_DELIVERY_PREFIX,
  LIVE_REPLY_SESSION_MS, LIVE_REPLY_SESSION_PREFIX,
  liveOpeningMessage, matchLiveRule, parseLiveRule,
  type LiveMessage, type LiveReplyOption, type LiveReplyType, type LiveRule,
} from "./config";

type LiveAccount = { id: string; userId: string; igUserId: string };
type JsonObject = Record<string, unknown>;
type LivePending = {
  ruleId: string;
  commentId: string;
  stage: "AWAITING_KEYWORD" | "AWAITING_FORM";
  options?: LiveReplyOption[];
  attempts?: number;
};
const sessionKey = (accountId: string, participantId: string) =>
  LIVE_REPLY_SESSION_PREFIX + accountId + ":" + participantId;
const deliveryKey = (accountId: string, commentId: string) =>
  LIVE_COMMENT_DELIVERY_PREFIX + accountId + ":" + commentId;
const rec = (v: unknown): JsonObject => v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {};
const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";
function parsePending(value: unknown): LivePending | null {
  const o = rec(value);
  if (!clean(o.ruleId) || !clean(o.commentId) || (o.stage !== "AWAITING_KEYWORD" && o.stage !== "AWAITING_FORM")) return null;
  return {
    ruleId: clean(o.ruleId),
    commentId: clean(o.commentId),
    stage: o.stage,
    options: Array.isArray(o.options) ? o.options as LiveReplyOption[] : undefined,
    attempts: typeof o.attempts === "number" ? o.attempts : 0,
  };
}
function readLiveComment(value: unknown) {
  const item = rec(value);
  const from = rec(item.from);
  return {
    commentId: clean(item.id),
    text: clean(item.text),
    participantId: clean(from.id),
    mediaId: clean(rec(item.media).id),
  };
}
async function sendPrivateReply(account: LiveAccount, commentId: string, text: string) {
  const token = await getValidInstagramAccessToken(account.id);
  // Meta allows one private reply per Live comment, during the broadcast only.
  // Never retry POST: a timed-out request may already have consumed that reply.
  return instagramApiRequest<{ recipient_id?: string; message_id?: string }>(
    "/" + account.igUserId + "/messages", {
      method: "POST", accessToken: token, maxRetries: 0, rateLimitWaitMs: 0,
      rateLimit: { instagramAccountId: account.id, tenantId: account.userId, operation: "COMMENT_PRIVATE_REPLY" },
      body: { recipient: { comment_id: commentId }, message: { text } },
    },
  );
}
async function sendNormalText(account: LiveAccount, participantId: string, text: string) {
  const token = await getValidInstagramAccessToken(account.id);
  const data = await instagramApiRequest<{ message_id?: string }>(
    "/" + account.igUserId + "/messages", {
      method: "POST", accessToken: token, maxRetries: 0, rateLimitWaitMs: 0,
      rateLimit: { instagramAccountId: account.id, tenantId: account.userId, operation: "MESSAGE_TEXT" },
      body: { recipient: { id: participantId }, messaging_type: "RESPONSE", message: { text } },
    },
  );
  return data.message_id;
}
async function saveOutbound(account: LiveAccount, participantId: string, text: string, mid?: string) {
  const conversation = await prisma.conversation.upsert({
    where: { instagramAccountId_participantId: { instagramAccountId: account.id, participantId } },
    update: { lastMessageAt: new Date(), isActive: true },
    create: { instagramAccountId: account.id, userId: account.userId, igUserId: participantId,
      participantId, isActive: true, lastMessageAt: new Date() },
  });
  if (mid) {
    await prisma.conversationMessage.upsert({
      where: { igMessageId: mid },
      update: {},
      create: { conversationId: conversation.id, direction: "OUTBOUND", messageType: "TEXT",
        text, igMessageId: mid, createdAt: new Date() },
    });
  }
}
async function deliverFollowup(
  account: LiveAccount,
  participantId: string,
  message: LiveMessage,
  executionId: string,
): Promise<{ success: boolean; error?: string }> {
  const type = message.messageType;
  const quickReplies = type === "FORM" ? message.quickReplies.map((o) => ({
    id: o.id, title: o.title, payload: o.payload,
  })) : [];
  const result = await sendAutomationMessage({
    instagramAccountId: account.id,
    recipientId: participantId,
    instagramUserId: account.igUserId,
    executionId,
    message: {
      id: executionId,
      messageType: type,
      text: message.text || null,
      mediaUrl: message.mediaUrl || null,
      mediaId: message.mediaId || null,
      showcaseId: message.showcaseId || null,
      formId: message.formId || null,
      quickReplies,
    },
  });
  if (result.success && result.igMessageId) {
    const conversation = await prisma.conversation.upsert({
      where: { instagramAccountId_participantId: { instagramAccountId: account.id, participantId } },
      update: { lastMessageAt: new Date(), isActive: true },
      create: { instagramAccountId: account.id, userId: account.userId, igUserId: participantId,
        participantId, lastMessageAt: new Date() },
    });
    await prisma.conversationMessage.upsert({
      where: { igMessageId: result.igMessageId },
      update: {},
      create: { conversationId: conversation.id, direction: "OUTBOUND",
        messageType: type === "FORM" || type === "SHOWCASE" ? "TEXT" : type,
        text: result.conversationText || message.text || null,
        mediaUrl: message.mediaUrl || null, mediaId: message.mediaId || null,
        igMessageId: result.igMessageId },
    });
  }
  return { success: result.success, error: result.error };
}
function messageFromOption(option: LiveReplyOption): LiveMessage {
  return {
    messageType: option.destinationType || "TEXT",
    text: option.destinationType === "FORM" ? option.destinationQuestion : option.destinationText,
    mediaUrl: option.destinationMediaUrl, mediaId: option.destinationMediaId,
    showcaseId: option.destinationShowcaseId, formId: option.destinationFormId,
    quickReplies: option.destinationQuickReplies,
  };
}
export async function processInstagramLiveComment(value: unknown, account: LiveAccount, eventId: string) {
  const { commentId, text, participantId } = readLiveComment(value);
  if (!commentId || !text || !participantId) return;
  const rules = await prisma.savedAutomationResponse.findMany({
    where: { userId: account.userId, instagramAccountId: account.id, messageType: LIVE_AUTOMATION_TYPE },
    orderBy: { createdAt: "asc" },
  });
  const matched = rules.map((item) => {
    try { return { item, config: parseLiveRule(item.quickReplies) }; }
    catch { return null; }
  }).find((item) => item && matchLiveRule(item.config, text));
  if (!matched) return;
  const { item, config } = matched;
  const key = deliveryKey(account.id, commentId);
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key, tenantId: account.id, operation: "LIVE_COMMENT_PRIVATE_REPLY",
        resourceId: commentId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        response: { automationId: item.id, eventId },
      },
    });
  } catch (error) {
    if (rec(error).code === "P2002") return; // Already claimed. Never send a second private reply.
    throw error;
  }
  const session = sessionKey(account.id, participantId);
  const needsContinuation = config.requireFollow || config.mode === "FOLLOW_UP";
  if (needsContinuation) {
    const pending: LivePending = { ruleId: item.id, commentId, stage: "AWAITING_KEYWORD", attempts: 0 };
    await prisma.idempotencyRecord.upsert({
      where: { key: session },
      create: { key: session, tenantId: account.id, operation: "LIVE_DM_CONTINUATION",
        resourceId: participantId, expiresAt: new Date(Date.now() + LIVE_REPLY_SESSION_MS),
        response: { ...pending } },
      update: { status: "IN_PROGRESS", response: { ...pending },
        expiresAt: new Date(Date.now() + LIVE_REPLY_SESSION_MS) },
    });
  }
  try {
    const opening = liveOpeningMessage(config);
    const result = await sendPrivateReply(account, commentId, opening);
    await prisma.idempotencyRecord.update({
      where: { key }, data: { status: "COMPLETED",
        response: { automationId: item.id, eventId, messageId: result.message_id || null },
        completedAt: new Date() },
    });
    await saveOutbound(account, participantId, opening, result.message_id);
  } catch (error) {
    // A Meta-side failure may still have consumed the single permitted reply.
    // Keep the delivery claim so webhook retries never duplicate a private reply.
    await prisma.idempotencyRecord.update({
      where: { key }, data: { status: "FAILED",
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Private reply failed" },
    });
    if (needsContinuation) {
      await prisma.idempotencyRecord.updateMany({
        where: { key: session, resourceId: participantId },
        data: { status: "FAILED", expiresAt: new Date() },
      });
    }
    console.error("[LIVE_PRIVATE_REPLY_FAILED]", {
      accountId: account.id, commentId, reason: error instanceof Error ? error.message : String(error),
    });
    // Do not rethrow: Meta permits one reply only. Retrying an uncertain POST is unsafe.
  }
}
export async function processInstagramLiveDmContinuation(input: {
  account: LiveAccount; participantId: string; text: string | null;
  quickReplyPayload?: string | null; executionId: string;
}): Promise<boolean> {
  const { account, participantId } = input;
  const incoming = normalizeAutomationText(input.text || "");
  const payload = clean(input.quickReplyPayload);
  if (!incoming && !payload) return false;
  const key = sessionKey(account.id, participantId);
  const state = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (!state || state.status !== "IN_PROGRESS" || state.expiresAt.getTime() <= Date.now()) return false;
  const pending = parsePending(state.response);
  if (!pending) return false;
  const stored = await prisma.savedAutomationResponse.findFirst({
    where: { id: pending.ruleId, instagramAccountId: account.id, userId: account.userId, messageType: LIVE_AUTOMATION_TYPE },
  });
  if (!stored) {
    await prisma.idempotencyRecord.update({ where: { key }, data: { status: "FAILED", expiresAt: new Date() } });
    return false;
  }
  let config: LiveRule;
  try { config = parseLiveRule(stored.quickReplies); } catch { return false; }
  let outgoing: LiveMessage;
  if (pending.stage === "AWAITING_FORM") {
    const choice = pending.options?.find((option) => option.payload === payload
      || normalizeAutomationText(option.title) === incoming);
    if (!choice) return false;
    outgoing = messageFromOption(choice);
  } else {
    const expected = config.nextKeyword;
    if (incoming !== normalizeAutomationText(expected) && payload !== expected) return false;
    if (config.requireFollow) {
      const token = await getValidInstagramAccessToken(account.id);
      let follows: boolean | null = null;
      try {
        const status = await instagramApiRequest<{ is_user_follow_business?: boolean }>(
          "/" + participantId, { accessToken: token, method: "GET",
            params: { fields: "is_user_follow_business" },
            rateLimit: { instagramAccountId: account.id, tenantId: account.userId, operation: "PROFILE_READ" } },
        );
        follows = typeof status.is_user_follow_business === "boolean" ? status.is_user_follow_business : null;
      } catch (error) {
        console.warn("[LIVE_FOLLOW_GATE_CHECK_FAILED]", error instanceof Error ? error.message : String(error));
      }
      if (follows !== true) {
        const attempts = (pending.attempts || 0) + 1;
        await prisma.idempotencyRecord.update({ where: { key },
          data: { response: { ...pending, attempts } } });
        if (attempts <= 5) {
          await sendNormalText(account, participantId,
            follows === false ? "برای دریافت پاسخ، ابتدا پیج را فالو کن؛ سپس دوباره «" + expected + "» را بنویس."
              : "فعلاً امکان بررسی فالو وجود ندارد؛ بعداً دوباره «" + expected + "» را بنویس.");
        }
        return true;
      }
    }
    outgoing = config.mode === "DIRECT"
      ? { ...defaultLiveMessage(), text: config.initialText } : config.response;
  }
  // A per-participant conversation lock is already held by the incoming webhook.
  // Complete the state first to prevent a duplicate send if Meta retries the event.
  const next = outgoing.messageType === "FORM"
    ? { ...pending, stage: "AWAITING_FORM", options: outgoing.quickReplies }
    : null;
  await prisma.idempotencyRecord.update({
    where: { key },
    data: next
      ? { response: next, expiresAt: new Date(Date.now() + LIVE_REPLY_SESSION_MS) }
      : { status: "COMPLETED", completedAt: new Date(), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  try {
    const result = await deliverFollowup(account, participantId, outgoing, "live:" + pending.commentId + ":" + input.executionId);
    if (!result.success) console.error("[LIVE_CONTINUATION_SEND_FAILED]", result.error);
  } catch (error) {
    console.error("[LIVE_CONTINUATION_SEND_ERROR]", error instanceof Error ? error.message : String(error));
  }
  return true; // Consumed: do not also trigger the generic DM automation.
}
