import { prisma } from "@/lib/prisma";
import { matchesAutomationKeyword } from "./trigger";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";
import { sendAutomationMessage } from "./send-automation-message";
import { executeAutomation } from "./execute-automation";

/**
 * Live rules are stored as COMMENT_KEYWORD automations attached to this reserved,
 * impossible-to-occur media ID. This keeps existing PostgreSQL/Prisma migrations
 * and the full DM flow engine compatible with the current production database.
 * Never pass this ID to the ordinary comment-automation UI or media APIs.
 */
export const LIVE_MEDIA_ID = "__smartdirect_live_comments_v1__";
export const LIVE_CONFIRM_FOLLOW_KEYWORD = "بررسی فالو";
const LIVE_PENDING_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type LiveReplyConfig = { followupKeyword: string };
export const normalized = (s: string) => s.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).trim().toLowerCase();

export function parseLiveConfig(value: string | null): LiveReplyConfig {
  try {
    const config = JSON.parse(value || "{}") as { kind?: string; followupKeyword?: unknown };
    if (config.kind !== "smartdirect-live-v1") return { followupKeyword: "" };
    return { followupKeyword: typeof config.followupKeyword === "string" ? config.followupKeyword.trim() : "" };
  } catch { return { followupKeyword: "" }; }
}

export function serializeLiveConfig(config: LiveReplyConfig) {
  return JSON.stringify({ kind: "smartdirect-live-v1", followupKeyword: config.followupKeyword.trim() });
}

function gateReplyText(text: string, keyword: string) {
  return `${text.trim()}\n\nبعد از فالو کردن، در همین دایرکت «${keyword}» را بنویس.`;
}

async function followsAccount(participantId: string, instagramAccountId: string): Promise<boolean> {
  try {
    const token = await getValidInstagramAccessToken(instagramAccountId);
    const result = await instagramApiRequest<{ is_user_follow_business?: boolean }>(
      `/${encodeURIComponent(participantId)}`, {
        accessToken: token, params: { fields: "is_user_follow_business" },
        rateLimit: { instagramAccountId, operation: "PROFILE_READ" },
      });
    // Unknown is NOT equivalent to following; fail closed.
    return result.is_user_follow_business === true;
  } catch (error) {
    console.warn("[LIVE_REPLY] follow-check-failed", error instanceof Error ? error.message : String(error));
    return false;
  }
}

export type IncomingLiveComment = {
  id?: unknown;
  text?: unknown;
  from?: { id?: unknown; username?: unknown };
  media?: { id?: unknown };
  media_id?: unknown;
};

/** Called only for the Instagram live_comments webhook field. */
export async function processLiveComment(value: unknown, instagramAccount: {
  id: string; igUserId: string; userId: string;
}, eventId: string) {
  const comment = value && typeof value === "object" && !Array.isArray(value) ? value as IncomingLiveComment : {};
  const commentId = typeof comment.id === "string" ? comment.id.trim() : "";
  const participantId = typeof comment.from?.id === "string" ? comment.from.id.trim() : "";
  const text = typeof comment.text === "string" ? comment.text.trim() : "";
  if (!commentId || !participantId || !text) return;

  const automations = await prisma.automation.findMany({
    where: {
      instagramAccountId: instagramAccount.id,
      triggerType: "COMMENT_KEYWORD",
      mediaId: LIVE_MEDIA_ID,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, keyword: true, keywordMatchMode: true, replyText: true, commentReplyText: true, requireFollow: true, followGateText: true, messages: { select: { id: true }, take: 1 } },
  });
  const rule = automations.find(a => matchesAutomationKeyword(
    a.keyword, text, a.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT",
  ));
  if (!rule?.replyText?.trim()) return;

  const followupKeyword = parseLiveConfig(rule.commentReplyText).followupKeyword;
  const checkKeyword = followupKeyword || LIVE_CONFIRM_FOLLOW_KEYWORD;
  const isFollowing = !rule.requireFollow || await followsAccount(participantId, instagramAccount.id);
  const shouldGate = rule.requireFollow && !isFollowing;
  const reply = shouldGate
    ? gateReplyText(rule.followGateText || "برای دریافت پاسخ ابتدا پیج را فالو کن.", checkKeyword)
    : rule.replyText.trim();

  // Meta allows exactly one private reply per Live comment. The Send API's
  // existing execution-key lease prevents duplicate deliveries on webhook retry.
  const send = await sendAutomationMessage({
    instagramAccountId: instagramAccount.id,
    instagramUserId: instagramAccount.igUserId,
    recipientId: participantId,
    commentId,
    executionId: `live-comment:${commentId}`,
    message: { id: `live-intro-${rule.id}`, messageType: "TEXT", text: reply, mediaUrl: null, mediaId: null },
  });
  if (!send.success) throw new Error(send.error || "Live private reply could not be delivered");
  // Meta returns the messaging recipient ID for Private Replies. Prefer it
  // over the commenter ID when linking the later incoming DM continuation.
  const dmParticipantId = send.recipientId?.trim() || participantId;

  // A reply by the viewer opens the normal 24-hour DM messaging window.
  // We never send a second unsolicited message after the Private Reply.
  if (shouldGate || (followupKeyword && rule.messages.length)) {
    const gate = await prisma.pendingFollowGate.findFirst({
      where: { instagramAccountId: instagramAccount.id, participantId: dmParticipantId, automationId: rule.id, status: "PENDING" },
      select: { id: true },
    });
    const data = { expiresAt: new Date(Date.now() + LIVE_PENDING_LIFETIME_MS) };
    if (gate) await prisma.pendingFollowGate.update({ where: { id: gate.id }, data });
    else await prisma.pendingFollowGate.create({ data: {
      instagramAccountId: instagramAccount.id, participantId: dmParticipantId, automationId: rule.id, status: "PENDING", ...data,
    } });
  }
  console.info("[LIVE_REPLY] private-reply-processed", { accountId: instagramAccount.id, automationId: rule.id, commentId, eventId, followGate: shouldGate });
}

/**
 * Consume a pending Live DM continuation BEFORE the generic DM keyword handler.
 * Return true only if we handled the user's explicit confirmation/keyword.
 */
export async function processLiveReplyContinuation(input: {
  instagramAccountId: string; igUserId: string; participantId: string; text: string; messageId: string | null;
}): Promise<boolean> {
  const { instagramAccountId, igUserId, participantId } = input;
  const incoming = normalized(input.text);
  if (!incoming) return false;
  const pending = await prisma.pendingFollowGate.findMany({
    where: { instagramAccountId, participantId, status: "PENDING", expiresAt: { gt: new Date() },
      automation: { triggerType: "COMMENT_KEYWORD", mediaId: LIVE_MEDIA_ID, isActive: true } },
    orderBy: { createdAt: "desc" },
    include: { automation: { include: { messages: { select: { id: true }, take: 1 } } } },
    take: 5,
  });
  const matched = pending.find(gate => {
    const configured = parseLiveConfig(gate.automation.commentReplyText).followupKeyword;
    return incoming === normalized(configured || LIVE_CONFIRM_FOLLOW_KEYWORD);
  });
  if (!matched) return false;

  const rule = matched.automation;
  if (rule.requireFollow && !await followsAccount(participantId, instagramAccountId)) {
    const reply = await sendAutomationMessage({
      instagramAccountId, instagramUserId: igUserId, recipientId: participantId,
      executionId: `live-follow-check:${matched.id}:${input.messageId || incoming}`,
      message: { id: `live-follow-gate-${rule.id}`, messageType: "TEXT",
        text: rule.followGateText?.trim() || "لطفاً ابتدا پیج را فالو کن و دوباره امتحان کن.", mediaUrl: null, mediaId: null },
    });
    if (!reply.success) throw new Error(reply.error || "Live follow reminder failed");
    return true;
  }

  const hasFollowup = Boolean(parseLiveConfig(rule.commentReplyText).followupKeyword && rule.messages.length);
  if (hasFollowup) {
    const result = await executeAutomation({
      automationId: rule.id, instagramAccountId, igUserId, participantId,
      executionId: `live-followup:${matched.id}:${input.messageId || incoming}`,
    });
    if (!result.success) throw new Error(("error" in result ? result.error : null) || "Live followup automation failed");
  } else {
    const result = await sendAutomationMessage({
      instagramAccountId, instagramUserId: igUserId, recipientId: participantId,
      executionId: `live-gate-release:${matched.id}:${input.messageId || incoming}`,
      message: { id: `live-gate-text-${rule.id}`, messageType: "TEXT", text: rule.replyText || "", mediaUrl: null, mediaId: null },
    });
    if (!result.success) throw new Error(result.error || "Live followup reply failed");
  }
  // One viewer may comment more than once during the same Live. All those
  // comments can create pending continuations, but the viewer must receive
  // the configured DM follow-up only once after explicitly opting in.
  await prisma.pendingFollowGate.updateMany({
    where: {
      instagramAccountId, participantId, automationId: rule.id,
      status: "PENDING",
    },
    data: { status: "COMPLETED" },
  });
  return true;
}
