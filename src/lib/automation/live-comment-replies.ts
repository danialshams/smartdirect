import { prisma } from "@/lib/prisma";
import { findMatchingAutomation } from "@/lib/automation/find-matching-automation";
import { normalizeAutomationText } from "@/lib/automation/trigger";
import { executeAutomation } from "@/lib/automation/execute-automation";
import { instagramApiRequest } from "@/lib/instagram/client";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

type Account = { id: string; userId: string; igUserId: string; igUsername: string };
type LiveCommentValue = {
  id?: unknown; comment_id?: unknown; text?: unknown; media?: { id?: unknown };
  media_id?: unknown; from?: { id?: unknown; username?: unknown };
};
const valueOf = (v: unknown) => typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
const privateReplyLifetime = 24 * 60 * 60 * 1000;

export async function processLiveComment(value: LiveCommentValue | null | undefined, account: Account) {
  const commentId = valueOf(value?.id || value?.comment_id);
  const liveMediaId = valueOf(value?.media?.id || value?.media_id);
  const text = typeof value?.text === "string" ? value.text : "";
  const fromId = valueOf(value?.from?.id);
  if (!commentId || !text.trim() || !liveMediaId || fromId === account.igUserId) return;
  const rule = await findMatchingAutomation({
    instagramAccountId: account.id, triggerType: "LIVE_COMMENT_KEYWORD",
    keyword: normalizeAutomationText(text), mediaId: liveMediaId,
  });
  if (!rule?.replyText?.trim()) return;
  // The first message is always plain text. Neither a button template nor
  // a normal DM is sent until the viewer explicitly replies.
  if (fromId) {
    const previouslySent = await prisma.liveCommentReply.findFirst({
      where: {
        instagramAccountId: account.id, liveMediaId, commenterId: fromId,
        status: { in: ["RESERVED","SENT","WAIT_REPLY","PROCESSING","DONE"] },
      },
      select: { id: true },
    });
    if (previouslySent) return;
  }
  const reservation = await prisma.liveCommentReply.createMany({
    data: [{
      instagramAccountId: account.id, automationId: rule.id, commentId, liveMediaId,
      commenterId: fromId || null, participantId: null, status: "RESERVED",
      expiresAt: new Date(Date.now() + privateReplyLifetime),
    }],
    skipDuplicates: true,
  });
  if (reservation.count !== 1) return;
  try {
    const token = await getValidInstagramAccessToken(account.id);
    const textToSend = rule.requireFollow && rule.followGateText
      ? [rule.replyText.trim(), rule.followGateText.trim()].filter(Boolean).join("\n\n")
      : rule.replyText.trim();
    if (textToSend.length > 1000)
      throw new Error("The combined private reply text and follow instruction exceed 1000 characters.");
    const data = await instagramApiRequest<{ recipient_id?: string; message_id?: string }>(
      "/" + encodeURIComponent(account.igUserId) + "/messages",
      {
        method: "POST", accessToken: token, maxRetries: 0, rateLimitWaitMs: 0,
        body: { recipient: { comment_id: commentId }, message: { text: textToSend } },
        rateLimit: { instagramAccountId: account.id, tenantId: account.userId, operation: "COMMENT_PRIVATE_REPLY" },
      },
    );
    const participantId = valueOf(data.recipient_id) || fromId;
    await prisma.liveCommentReply.update({
      where: { commentId },
      data: {
        participantId: participantId || null, outboundMessageId: data.message_id || null,
        status: rule.liveReplyMode === "FOLLOWUP" && participantId ? "WAIT_REPLY" : "SENT",
      },
    });
    // Mirror the outbound message in the existing inbox when Instagram supplies
    // an Instagram-scoped recipient ID.
    if (participantId) {
      const conversation = await prisma.conversation.upsert({
        where: { instagramAccountId_participantId: { instagramAccountId: account.id, participantId } },
        create: { instagramAccountId: account.id, userId: account.userId, participantId, igUserId: participantId, isActive: true, lastMessageAt: new Date() },
        update: { isActive: true, lastMessageAt: new Date() },
      });
      await prisma.conversationMessage.create({
        data: { conversationId: conversation.id, direction: "OUTBOUND", messageType: "TEXT",
          text: textToSend, igMessageId: data.message_id || null },
      }).catch((error: unknown) => console.warn("[Live reply] inbox mirror failed", error));
    }
  } catch (error) {
    // A failed/ambiguous Private Reply must never retry automatically: Meta
    // only permits one attempt per comment and may have delivered it.
    await prisma.liveCommentReply.updateMany({
      where: { commentId, status: "RESERVED" }, data: { status: "FAILED" },
    });
    console.error("[Live reply] one-shot private reply failed", { accountId: account.id, commentId, error });
  }
}

export async function consumeLiveReplyFollowup({
  account, participantId, messageText, messageId,
}: { account: Account; participantId: string; messageText: string | null; messageId: string | null }): Promise<boolean> {
  const text = normalizeAutomationText(messageText || "");
  if (!text) return false;
  const sessions = await prisma.liveCommentReply.findMany({
    where: {
      instagramAccountId: account.id, participantId, status: "WAIT_REPLY",
      expiresAt: { gt: new Date() },
      automation: { isActive: true, triggerType: "LIVE_COMMENT_KEYWORD" },
    },
    include: { automation: { select: { liveReplyKeyword: true, requireFollow: true, followGateText: true } } },
    orderBy: { createdAt: "desc" }, take: 10,
  });
  const session = sessions.find((row) => normalizeAutomationText(row.automation.liveReplyKeyword || "") === text);
  if (!session) return false;
  const claimed = await prisma.liveCommentReply.updateMany({
    where: { id: session.id, status: "WAIT_REPLY" },
    data: { status: "PROCESSING" },
  });
  if (!claimed.count) return true;
  try {
    if (session.automation.requireFollow) {
      const token = await getValidInstagramAccessToken(account.id);
      const result = await instagramApiRequest<{ is_user_follow_business?: boolean }>(
        "/" + encodeURIComponent(participantId), {
          accessToken: token, params: { fields: "is_user_follow_business" },
          maxRetries: 1, rateLimit: { instagramAccountId: account.id, tenantId: account.userId, operation: "PROFILE_READ" },
        },
      );
      if (result.is_user_follow_business !== true) {
        const reminder = session.automation.followGateText?.trim() ||
          "برای دریافت محتوا ابتدا پیج را فالو کن.";
        await instagramApiRequest("/" + encodeURIComponent(account.igUserId) + "/messages", {
          method: "POST", accessToken: token, maxRetries: 0,
          body: { recipient: { id: participantId }, messaging_type: "RESPONSE", message: { text: reminder + "\nبعد از فالو دوباره «" + text + "» را بفرست." } },
          rateLimit: { instagramAccountId: account.id, tenantId: account.userId, operation: "MESSAGE_TEXT" },
        });
        await prisma.liveCommentReply.update({ where: { id: session.id }, data: { status: "WAIT_REPLY" } });
        return true;
      }
    }
    const result = await executeAutomation({
      automationId: session.automationId, instagramAccountId: account.id,
      participantId, igUserId: participantId,
      executionId: "live:" + session.id + ":" + (messageId || "reply"),
      selectedQuickReplyId: null, commentId: null,
    });
    await prisma.liveCommentReply.update({
      where: { id: session.id },
      data: { status: result.success && (result.executed || result.reason === "IDEMPOTENT_DUPLICATE") ? "DONE" : "WAIT_REPLY" },
    });
    return true;
  } catch (error) {
    await prisma.liveCommentReply.updateMany({ where: { id: session.id, status: "PROCESSING" }, data: { status: "WAIT_REPLY" } });
    console.error("[Live reply] follow-up failed", { sessionId: session.id, error });
    return true;
  }
}
