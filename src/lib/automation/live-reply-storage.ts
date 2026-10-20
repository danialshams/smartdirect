import { prisma } from "@/lib/prisma";
import type { MessageDraft, QuickReplyDraft } from "@/components/dashboard/automation-form-utils";
import { LIVE_MEDIA_ID, serializeLiveConfig, parseLiveConfig } from "./live-replies";
import { LiveReplyValidationError, type ValidatedLiveRule, serializeLiveQuickReply, liveReplyOptionsOverlap } from "./live-reply-validation";

export const liveReplyInclude = {
  messages: { orderBy: { order: "asc" as const }, include: {
    quickReplies: { orderBy: { createdAt: "asc" as const } },
  } },
} as const;

function destinationShowcases(replies: QuickReplyDraft[], ids: Set<string>) {
  for (const reply of replies) {
    if (reply.destinationType === "SHOWCASE") ids.add(reply.destinationShowcaseId);
    destinationShowcases(reply.destinationQuickReplies, ids);
  }
}

export async function verifyLiveResponseOwnership(input: ValidatedLiveRule, accountId: string, userId: string) {
  if (!input.message) return;
  const ids = new Set<string>();
  if (input.message.messageType === "SHOWCASE") ids.add(input.message.showcaseId);
  destinationShowcases(input.message.quickReplies, ids);
  if (ids.size) {
    const valid = await prisma.showcase.findMany({
      where: { id: { in: [...ids] }, instagramAccountId: accountId, userId }, select: { id: true },
    });
    if (valid.length !== ids.size) throw new LiveReplyValidationError("یک ویترین انتخاب‌شده متعلق به این اکانت نیست.");
  }
  if (input.message.messageType === "FORM" && input.message.formId) {
    const form = await prisma.form.findFirst({
      where: { id: input.message.formId, instagramAccountId: accountId, userId }, select: { id: true },
    });
    if (!form) throw new LiveReplyValidationError("فرم انتخاب‌شده متعلق به این اکانت نیست.");
  }
}

export async function assertNonOverlappingLiveKeywords(accountId: string, keyword: string, exceptId?: string) {
  const candidates = await prisma.automation.findMany({
    where: { instagramAccountId: accountId, triggerType: "COMMENT_KEYWORD", mediaId: LIVE_MEDIA_ID,
      ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { keyword: true },
  });
  if (candidates.some(item => liveReplyOptionsOverlap(item.keyword || "", keyword)))
    throw new LiveReplyValidationError("یکی از کلمات کلیدی قبلاً برای پاسخ لایو ثبت شده است.", 409);
}

function savedMessageData(message: MessageDraft) {
  const media = ["IMAGE", "VIDEO", "AUDIO"].includes(message.messageType);
  return {
    messageType: message.messageType,
    text: message.text || null,
    mediaUrl: media ? message.mediaUrl || null : null,
    mediaId: media ? message.mediaId || null : null,
    showcaseId: message.messageType === "SHOWCASE" ? message.showcaseId || null : null,
    formId: message.messageType === "FORM" ? message.formId || null : null,
  };
}

function savedRuleData(rule: ValidatedLiveRule) {
  return {
    keyword: rule.keyword,
    keywordMatchMode: rule.matchMode,
    replyText: rule.initialText,
    commentReplyText: serializeLiveConfig({ followupKeyword: rule.followupKeyword }),
    requireFollow: rule.requireFollow,
    followGateText: rule.requireFollow ? rule.followGateText : null,
    followGateButtonText: rule.requireFollow ? "بررسی فالو" : null,
    sendDm: true,
  };
}

export async function createLiveReplyRule(input: ValidatedLiveRule, accountId: string) {
  return prisma.$transaction(async tx => tx.automation.create({
    data: {
      instagramAccountId: accountId, triggerType: "COMMENT_KEYWORD",
      mediaId: LIVE_MEDIA_ID, mediaIds: null, isActive: true,
      ...savedRuleData(input),
      ...(input.message ? {
        messages: { create: [{
          order: 0, ...savedMessageData(input.message),
          ...(input.message.quickReplies.length ? {
            quickReplies: { create: input.message.quickReplies.map(serializeLiveQuickReply) },
          } : {}),
        }] },
      } : {}),
    },
    include: liveReplyInclude,
  }));
}

export async function updateLiveReplyRule(input: ValidatedLiveRule, automationId: string, expectedUpdatedAt: Date) {
  return prisma.$transaction(async tx => {
    const changed = await tx.automation.updateMany({
      where: { id: automationId, updatedAt: expectedUpdatedAt, mediaId: LIVE_MEDIA_ID, triggerType: "COMMENT_KEYWORD" },
      data: savedRuleData(input),
    });
    if (!changed.count) throw new LiveReplyValidationError("اطلاعات پاسخ در جای دیگری تغییر کرده است. صفحه را دوباره باز کن.", 409);
    const existing = await tx.automationMessage.findFirst({
      where: { automationId }, orderBy: { order: "asc" }, include: { quickReplies: true },
    });
    if (!input.message) {
      if (existing) {
        // Preserve previously used quick-reply IDs for inbox message history.
        // A deleted response is deactivated by removing the executable message.
        await tx.automationMessage.deleteMany({ where: { automationId } });
      }
    } else {
      const data = savedMessageData(input.message);
      const target = existing
        ? await tx.automationMessage.update({ where: { id: existing.id }, data })
        : await tx.automationMessage.create({ data: { automationId, order: 0, ...data } });
      const prior = existing?.quickReplies ?? [];
      const oldIds = new Set(prior.map(item => item.id));
      const retained = input.message.quickReplies.map(item => item.id).filter(id => oldIds.has(id));
      await tx.quickReply.deleteMany({ where: { automationMessageId: target.id, id: { notIn: retained } } });
      for (const reply of input.message.quickReplies) {
        const qr = serializeLiveQuickReply(reply);
        if (oldIds.has(reply.id)) await tx.quickReply.update({ where: { id: reply.id }, data: qr });
        else await tx.quickReply.create({ data: { automationMessageId: target.id, ...qr } });
      }
    }
    return tx.automation.findUniqueOrThrow({ where: { id: automationId }, include: liveReplyInclude });
  }, { maxWait: 10000, timeout: 30000 });
}

export function displayLiveReply(rule: {
  id: string; instagramAccountId: string; keyword: string | null;
  keywordMatchMode: string; replyText: string | null; commentReplyText: string | null;
  requireFollow: boolean; followGateText: string | null; updatedAt: Date;
  createdAt: Date; messages: unknown[];
}) {
  const config = parseLiveConfig(rule.commentReplyText);
  return {
    id: rule.id, instagramAccountId: rule.instagramAccountId,
    keyword: rule.keyword ?? "", matchMode: rule.keywordMatchMode,
    initialText: rule.replyText ?? "", followupKeyword: config.followupKeyword,
    followupEnabled: Boolean(config.followupKeyword),
    requireFollow: rule.requireFollow, followGateText: rule.followGateText ?? "",
    messages: rule.messages, createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}
