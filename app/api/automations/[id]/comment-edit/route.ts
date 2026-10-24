import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSavedResponseOrigin } from "@/lib/automation/saved-response-origin";
import { storePublicCommentReplies } from "@/lib/automation/comment-reply-variants";
import { partitionResponseMediaScope } from "@/lib/automation/response-media-scope";
import { getCachedInstagramMedia, invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SHOWCASE" | "FORM";
type LinkButton = { title: string; url: string };
type QuickReplyInput = {
  id?: string;
  title: string;
  payload: string;
  nextMessageId?: string | null;
  isExit?: boolean;
  destinationType?: string | null;
  savedResponseId?: string | null;
  destinationText?: string;
  destinationFormId?: string;
  destinationShowcaseId?: string;
  destinationMediaUrl?: string;
  destinationMediaId?: string;
  destinationQuestion?: string;
  destinationQuickReplies?: QuickReplyInput[];
};
type MessageInput = {
  id?: string;
  messageType: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaId?: string;
  showcaseId?: string;
  formId?: string;
  savedResponseId?: string | null;
  quickReplies?: QuickReplyInput[];
  updateQuickReplies?: boolean;
  linkButtons?: LinkButton[];
};

class EditError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const types: MessageType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];
const destinations = types;
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const normalizedWords = (value: unknown) => Array.from(new Set(
  clean(value).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .split(/[,،;؛\n]+/).map((item) => item.trim().toLowerCase()).filter(Boolean),
));
function parseLinks(value: unknown): LinkButton[] {
  if (!Array.isArray(value) || value.length > 3) throw new EditError("حداکثر سه دکمه لینک مجاز است.");
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new EditError("دکمه لینک نامعتبر است.");
    const item = raw as JsonRecord;
    const title = clean(item.title);
    const url = clean(item.url);
    if (!title || title.length > 20 || url.length > 2048) throw new EditError("عنوان دکمه باید حداکثر ۲۰ کاراکتر و لینک حداکثر ۲۰۴۸ کاراکتر باشد.");
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new EditError("آدرس دکمه لینک معتبر نیست."); }
    if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname) throw new EditError("آدرس دکمه باید یک لینک http یا https معتبر باشد.");
    return { title, url };
  });
}
function validateQuickReplies(value: unknown, depth = 0): QuickReplyInput[] {
  if (!Array.isArray(value)) throw new EditError("ساختار گزینه‌های فرم نامعتبر است.");
  if (depth > 8 || value.length > 13) throw new EditError("حداکثر ۱۳ گزینه و هشت سطح فرم مجاز است.");
  const payloads = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new EditError("یکی از گزینه‌های فرم نامعتبر است.");
    const item = raw as JsonRecord;
    const title = clean(item.title);
    const payload = clean(item.payload);
    const destinationType = clean(item.destinationType);
    if (!title || title.length > 20 || !payload || payload.length > 1000 || !destinations.includes(destinationType as MessageType))
      throw new EditError("عنوان، شناسه یا مقصد یکی از گزینه‌های فرم معتبر نیست.");
    if (payloads.has(payload)) throw new EditError("شناسه گزینه‌های فرم تکراری است.");
    payloads.add(payload);
    const destinationText = clean(item.destinationText);
    const destinationQuestion = clean(item.destinationQuestion);
    const children = destinationType === "FORM" ? validateQuickReplies(item.destinationQuickReplies, depth + 1) : [];
    if (destinationType === "TEXT" && !destinationText) throw new EditError("متن مقصد گزینه الزامی است.");
    if (destinationType === "FORM" && (!destinationQuestion || !children.length)) throw new EditError("سؤال و گزینه‌های فرم بعدی الزامی هستند.");
    if (destinationType === "SHOWCASE" && !clean(item.destinationShowcaseId)) throw new EditError("ویترین مقصد انتخاب نشده است.");
    if (["IMAGE", "VIDEO", "AUDIO"].includes(destinationType) && !clean(item.destinationMediaUrl) && !clean(item.destinationMediaId))
      throw new EditError("فایل مقصد گزینه انتخاب نشده است.");
    return {
      id: clean(item.id) || undefined, title, payload,
      isExit: item.isExit === true,
      destinationType, destinationText,
      savedResponseId: clean(item.savedResponseId) || null,
      destinationQuestion, destinationQuickReplies: children,
      destinationFormId: clean(item.destinationFormId),
      destinationShowcaseId: clean(item.destinationShowcaseId),
      destinationMediaUrl: clean(item.destinationMediaUrl),
      destinationMediaId: clean(item.destinationMediaId),
      nextMessageId: clean(item.nextMessageId) || null,
    };
  });
}
function validateMessage(raw: unknown, index: number): MessageInput {
  if (!raw || typeof raw !== "object") throw new EditError("اطلاعات یک پیام نامعتبر است.");
  const item = raw as JsonRecord;
  const messageType = clean(item.messageType) as MessageType;
  if (!types.includes(messageType)) throw new EditError("نوع پیام انتخاب‌شده معتبر نیست.");
  const text = clean(item.text);
  const mediaUrl = clean(item.mediaUrl);
  const mediaId = clean(item.mediaId);
  const showcaseId = clean(item.showcaseId);
  const formId = clean(item.formId);
  const linkButtons = parseLinks(item.linkButtons ?? []);
  const updateQuickReplies = item.updateQuickReplies !== false;
  const quickReplies = updateQuickReplies ? validateQuickReplies(item.quickReplies ?? []) : [];
  if ((messageType === "TEXT" || messageType === "FORM") && !text)
    throw new EditError("متن پیام " + (index + 1) + " را وارد کنید.");
  if (["IMAGE", "VIDEO", "AUDIO"].includes(messageType) && !mediaUrl && !mediaId)
    throw new EditError("فایل پیام " + (index + 1) + " را انتخاب کنید.");
  if (messageType === "SHOWCASE" && !showcaseId) throw new EditError("ویترین پیام انتخاب نشده است.");
  if (messageType === "FORM" && !(Array.isArray(item.quickReplies) && item.quickReplies.length)) throw new EditError("برای فرم حداقل یک گزینه لازم است.");
  if (linkButtons.length && messageType !== "TEXT") throw new EditError("دکمه لینک فقط برای پیام متنی است.");
  if (text.length > (linkButtons.length ? 640 : 2000)) throw new EditError("متن پیام از حد مجاز طولانی‌تر است.");
  return { id: clean(item.id) || undefined, messageType, text, mediaUrl, mediaId, showcaseId, formId,
    savedResponseId: item.savedResponseId === undefined ? undefined : clean(item.savedResponseId) || null,
    linkButtons, quickReplies, updateQuickReplies };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const automation = await prisma.automation.findFirst({
      where: { id, instagramAccount: { userId: session.user.id } },
      include: { messages: { select: { id: true } } },
    });
    if (!automation || automation.triggerType !== "COMMENT_KEYWORD")
      return NextResponse.json({ success: false, error: "پاسخ خودکار کامنت پیدا نشد." }, { status: 404 });
    const body = await request.json() as JsonRecord;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new EditError("اطلاعات ویرایش نامعتبر است.");
    const title = body.title === undefined ? automation.title || "" : clean(body.title);
    if (title.length > 80) throw new EditError("نام پاسخ حداکثر ۸۰ نویسه است.");
    const sourceMediaId = clean(body.sourceMediaId);
    const expectedUpdatedAt = clean(body.expectedUpdatedAt);
    if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt)))
      throw new EditError("نسخه اطلاعات ویرایش مشخص نیست. صفحه را دوباره باز کنید.", 409);
    if (automation.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime())
      throw new EditError("این پاسخ پس از باز شدن صفحه تغییر کرده است. برای جلوگیری از بازنویسی تغییرات، صفحه را دوباره باز کنید.", 409);
    const mode = body.keywordMatchMode;
    if (mode !== "EXACT" && mode !== "CONTAINS_ANY") throw new EditError("روش فعال‌سازی نامعتبر است.");
    const keywords = normalizedWords(body.keyword);
    if (mode === "EXACT" && !keywords.length) throw new EditError("حداقل یک کلمه کلیدی لازم است.");
    if (keywords.length > 10) throw new EditError("حداکثر ده کلمه کلیدی مجاز است.");
    const keyword = mode === "EXACT" ? keywords.join(",") : null;
    if (!Array.isArray(body.mediaIds) || !body.mediaIds.length || body.mediaIds.some((x) => typeof x !== "string" || !x.trim()))
      throw new EditError("حداقل یک پست یا ریلز انتخاب کنید.");
    const mediaIds = Array.from(new Set((body.mediaIds as string[]).map((x) => x.trim())));
    if (mediaIds.length > 50) throw new EditError("حداکثر پنجاه محتوای انتخابی مجاز است.");
    const requireFollow = body.requireFollow === true;
    const followGateText = clean(body.followGateText);
    const followGateButtonText = clean(body.followGateButtonText);
    if (requireFollow && !followGateText) throw new EditError("متن درخواست فالو الزامی است.");
    if (requireFollow && (!followGateButtonText || followGateButtonText.length > 20))
      throw new EditError("عنوان دکمه بررسی فالو باید بین ۱ تا ۲۰ کاراکتر باشد.");
    if (followGateText.length > 640) throw new EditError("متن درخواست فالو حداکثر ۶۴۰ کاراکتر است.");
    let commentReplyText = clean(body.commentReplyText);
    if (body.commentReplyVariants !== undefined) {
      try { commentReplyText = storePublicCommentReplies(body.commentReplyVariants); }
      catch (error) { throw new EditError(error instanceof Error ? error.message : "پاسخ‌های کامنت معتبر نیستند."); }
    } else if (commentReplyText.length > 2000) {
      throw new EditError("متن پاسخ زیر کامنت حداکثر ۲۰۰۰ کاراکتر است.");
    }
    if (typeof body.isActive !== "boolean") throw new EditError("وضعیت فعال بودن نامعتبر است.");
    if (typeof body.sendDm !== "boolean") throw new EditError("وضعیت ارسال دایرکت نامعتبر است.");
    if (!Array.isArray(body.messages) || body.messages.length > 20 ||
      (body.sendDm === true && !body.messages.length))
      throw new EditError("وقتی ارسال دایرکت فعال است، حداقل یک پیام لازم است.");
    const messages: MessageInput[] = body.messages.map(validateMessage);
    if (!commentReplyText && (body.sendDm !== true || !messages.length))
      throw new EditError("حداقل یک پاسخ زیر کامنت یا پیام دایرکت لازم است.");
    if (requireFollow && body.sendDm !== true)
      throw new EditError("شرط فالو فقط برای پاسخ دایرکت قابل استفاده است.");
    const submittedMessageIds = messages.map((m) => m.id).filter(Boolean) as string[];
    if (new Set(submittedMessageIds).size !== submittedMessageIds.length)
      throw new EditError("شناسه پیام‌های ارسالی تکراری است.");
    const originalMessageIds = new Set(automation.messages.map((item) => item.id));
    if (submittedMessageIds.some((value) => !originalMessageIds.has(value) && !value.startsWith("local_") && !value.startsWith("message_")))
      throw new EditError("یکی از پیام‌ها متعلق به این پاسخ نیست.");
    if (messages.some((item) => item.updateQuickReplies === false && !(item.id && originalMessageIds.has(item.id))))
      throw new EditError("اطلاعات گزینه‌های یکی از پیام‌های جدید کامل نیست.");
    const oldMediaIds = new Set([
      ...(automation.mediaId ? [automation.mediaId] : []),
      ...((automation.mediaIds || "").split(",").map((x) => x.trim()).filter(Boolean)),
    ]);
    if (sourceMediaId && !oldMediaIds.has(sourceMediaId))
      throw new EditError("این محتوا دیگر به پاسخ انتخاب‌شده متصل نیست.", 409);
    // Editing a subset forks only those media; editing the complete set updates in place.
    const scope = partitionResponseMediaScope(oldMediaIds, mediaIds);
    if (!scope.appliedExistingIds.length)
      throw new EditError("حداقل یکی از محتواهای متصل باید برای ویرایش انتخاب شود.", 400);
    const splitShared = scope.splitShared;
    const newMediaIds = mediaIds.filter((value) => !oldMediaIds.has(value));
    if (newMediaIds.length) {
      const account = await prisma.instagramAccount.findFirst({
        where: { id: automation.instagramAccountId, userId: session.user.id, isConnected: true },
        select: { id: true },
      });
      if (!account) throw new EditError("اکانت اینستاگرام متصل نیست.", 409);
      const media = await getCachedInstagramMedia(account.id, 50);
      const ownedIds = new Set((media?.data ?? []).map((x: Record<string, unknown>) => clean(x.id)));
      if (newMediaIds.some((value) => !ownedIds.has(value)))
        throw new EditError("یکی از محتواهای جدید متعلق به این پیج نیست یا دیگر در دسترس نیست.");
    }
    const peers = await prisma.automation.findMany({
      where: { instagramAccountId: automation.instagramAccountId, triggerType: "COMMENT_KEYWORD", id: { not: id } },
      select: { mediaId: true, mediaIds: true },
    });
    const occupied = new Set(peers.flatMap((peer) => [
      ...(peer.mediaId ? [peer.mediaId] : []),
      ...((peer.mediaIds || "").split(",").map((x) => x.trim()).filter(Boolean)),
    ]));
    if (mediaIds.some((value) => occupied.has(value)))
      throw new EditError("یکی از محتواهای انتخابی به پاسخ دیگری متصل است.", 409);
    for (const item of messages) {
      try { await validateSavedResponseOrigin(item.savedResponseId, automation.instagramAccountId, session.user.id, item.messageType); }
      catch (error) { throw new EditError(error instanceof Error ? error.message : "پاسخ ذخیره‌شده معتبر نیست."); }
      if (item.messageType === "SHOWCASE") {
        const showcase = await prisma.showcase.findFirst({ where: { id: item.showcaseId, instagramAccountId: automation.instagramAccountId, userId: session.user.id }, select: { id: true } });
        if (!showcase) throw new EditError("ویترین انتخاب‌شده متعلق به این پیج نیست.");
      }
      if (item.messageType === "FORM" && item.formId) {
        const form = await prisma.form.findFirst({ where: { id: item.formId, instagramAccountId: automation.instagramAccountId, userId: session.user.id }, select: { id: true } });
        if (!form) throw new EditError("فرم انتخاب‌شده متعلق به این پیج نیست.");
      }
    }

    const savedId = await prisma.$transaction(async (tx) => {
      const updatedData = {
        title: title || null,
        keyword, keywordMatchMode: mode,
        mediaId: mediaIds.length === 1 ? mediaIds[0] : null,
        mediaIds: mediaIds.join(","),
        commentReplyText: commentReplyText || null,
        requireFollow,
        followGateText: requireFollow ? followGateText : null,
        followGateButtonText: requireFollow ? followGateButtonText : null,
        isActive: body.isActive as boolean,
        sendDm: body.sendDm as boolean,
      };

      if (splitShared) {
        // Split the selected content away from the shared automation. Do not
        // change the shared messages, keywords, or follow settings of siblings.
        const remaining = scope.untouchedIds;
        const detached = await tx.automation.updateMany({
          where: { id, updatedAt: new Date(expectedUpdatedAt) },
          data: {
            mediaId: remaining.length === 1 ? remaining[0] : null,
            mediaIds: remaining.join(",") || null,
          },
        });
        if (detached.count !== 1)
          throw new EditError("پاسخ هم‌زمان تغییر کرده است. صفحه را دوباره باز کنید.", 409);

        const cloned = await tx.automation.create({
          data: {
            ...updatedData,
            instagramAccountId: automation.instagramAccountId,
            triggerType: "COMMENT_KEYWORD",
            replyText: automation.replyText,
            likeComment: automation.likeComment,
            likeIncomingDm: automation.likeIncomingDm,
            likeStoryReply: automation.likeStoryReply,
          },
          select: { id: true },
        });

        // First create all messages, so quick reply nextMessageId references can
        // be remapped to the new automation, never to a sibling's message.
        const clonedMessageIds = new Map<string, string>();
        const savedMessages: string[] = [];
        for (const [index, item] of messages.entries()) {
          const type = item.messageType;
          const created = await tx.automationMessage.create({
            data: {
              automationId: cloned.id, order: index, messageType: type,
              savedResponseId: item.savedResponseId || null,
              text: item.text || null,
              mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(type) ? item.mediaUrl || null : null,
              mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(type) ? item.mediaId || null : null,
              showcaseId: type === "SHOWCASE" ? item.showcaseId || null : null,
              formId: type === "FORM" ? item.formId || null : null,
              linkButtonUrl: type === "TEXT" ? item.linkButtons?.[0]?.url || null : null,
              linkButtonTitle: type === "TEXT" ? item.linkButtons?.[0]?.title || null : null,
              linkButtons: type === "TEXT" ? item.linkButtons || [] : [],
            },
            select: { id: true },
          });
          savedMessages.push(created.id);
          if (item.id && originalMessageIds.has(item.id)) clonedMessageIds.set(item.id, created.id);
        }

        for (const [index, item] of messages.entries()) {
          const nextId = savedMessages[index];
          if (!nextId) continue;
          if (item.updateQuickReplies === false && item.id && originalMessageIds.has(item.id)) {
            // Old rich replies are preserved byte-for-byte, including JSON
            // destinations, while relational message links are remapped.
            const oldReplies = await tx.quickReply.findMany({
              where: { automationMessageId: item.id },
              select: { title: true, payload: true, replyText: true, nextMessageId: true },
            });
            for (const reply of oldReplies) {
              await tx.quickReply.create({
                data: {
                  automationMessageId: nextId,
                  title: reply.title,
                  payload: reply.payload,
                  replyText: reply.replyText,
                  nextMessageId: reply.nextMessageId ? clonedMessageIds.get(reply.nextMessageId) || null : null,
                },
              });
            }
          } else {
            for (const reply of item.quickReplies || []) {
              await tx.quickReply.create({
                data: {
                  automationMessageId: nextId,
                  title: reply.title,
                  payload: reply.payload,
                  nextMessageId: reply.nextMessageId ? clonedMessageIds.get(reply.nextMessageId) || null : null,
                  replyText: JSON.stringify({
                    isExit: reply.isExit === true,
                    destinationType: reply.destinationType,
                    savedResponseId: reply.savedResponseId || null,
                    destinationText: reply.destinationText,
                    destinationFormId: reply.destinationFormId,
                    destinationShowcaseId: reply.destinationShowcaseId,
                    destinationMediaUrl: reply.destinationMediaUrl,
                    destinationMediaId: reply.destinationMediaId,
                    destinationQuestion: reply.destinationQuestion,
                    destinationQuickReplies: reply.destinationQuickReplies || [],
                  }),
                },
              });
            }
          }
        }

        // A published media job may reference the old shared response. Move
        // only the selected media to its independent reply configuration.
        await tx.instagramPublishJob.updateMany({
          where: {
            instagramAccountId: automation.instagramAccountId,
            instagramMediaId: { in: mediaIds },
            commentAutomationId: id,
          },
          data: { commentAutomationId: cloned.id },
        });
        return cloned.id;
      }

      const updated = await tx.automation.updateMany({
        where: { id, updatedAt: new Date(expectedUpdatedAt) },
        data: updatedData,
      });
      if (updated.count !== 1)
        throw new EditError("پاسخ هم‌زمان تغییر کرده است. صفحه را دوباره باز کنید.", 409);
      const keptIds: string[] = [];
      for (const [index, item] of messages.entries()) {
        const type = item.messageType;
        const data = {
          order: index,
          messageType: type,
          ...(item.savedResponseId !== undefined ? { savedResponseId: item.savedResponseId } : {}),
          text: item.text || null,
          mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(type) ? item.mediaUrl || null : null,
          mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(type) ? item.mediaId || null : null,
          showcaseId: type === "SHOWCASE" ? item.showcaseId || null : null,
          formId: type === "FORM" ? item.formId || null : null,
          linkButtonUrl: type === "TEXT" ? item.linkButtons?.[0]?.url || null : null,
          linkButtonTitle: type === "TEXT" ? item.linkButtons?.[0]?.title || null : null,
          linkButtons: type === "TEXT" ? (item.linkButtons || []) : [],
        };
        const existing = item.id && originalMessageIds.has(item.id);
        const saved = existing
          ? await tx.automationMessage.update({ where: { id: item.id }, data })
          : await tx.automationMessage.create({ data: { ...data, automationId: id } });
        keptIds.push(saved.id);
        if (!item.updateQuickReplies && existing) continue;
        const existingReplies = existing
          ? await tx.quickReply.findMany({ where: { automationMessageId: saved.id }, select: { id: true } })
          : [];
        const replyIds = new Set(existingReplies.map((reply) => reply.id));
        const retained = (item.quickReplies || []).map((reply) => reply.id).filter((value): value is string => Boolean(value && replyIds.has(value)));
        await tx.quickReply.deleteMany({ where: { automationMessageId: saved.id, id: { notIn: retained } } });
        for (const reply of item.quickReplies || []) {
          const replyData = {
            title: reply.title,
            payload: reply.payload,
            replyText: JSON.stringify({
              isExit: reply.isExit === true,
              destinationType: reply.destinationType,
              savedResponseId: reply.savedResponseId || null,
              destinationText: reply.destinationText,
              destinationFormId: reply.destinationFormId,
              destinationShowcaseId: reply.destinationShowcaseId,
              destinationMediaUrl: reply.destinationMediaUrl,
              destinationMediaId: reply.destinationMediaId,
              destinationQuestion: reply.destinationQuestion,
              destinationQuickReplies: reply.destinationQuickReplies || [],
            }),
          };
          if (reply.id && replyIds.has(reply.id)) {
            await tx.quickReply.update({ where: { id: reply.id }, data: replyData });
          } else {
            await tx.quickReply.create({ data: { automationMessageId: saved.id, ...replyData } });
          }
        }
      }
      const removed = [...originalMessageIds].filter((value) => !keptIds.includes(value));
      if (removed.length) {
        await tx.quickReply.updateMany({ where: { nextMessageId: { in: removed } }, data: { nextMessageId: null } });
        await tx.quickReply.deleteMany({ where: { automationMessageId: { in: removed } } });
        await tx.automationMessage.deleteMany({ where: { automationId: id, id: { in: removed } } });
      }
      // Single-media edits remain in place. If the user replaced the selected
      // media, do not leave a stale publishing-job association behind.
      if (sourceMediaId && !mediaIds.includes(sourceMediaId)) {
        await tx.instagramPublishJob.updateMany({
          where: {
            instagramAccountId: automation.instagramAccountId,
            instagramMediaId: sourceMediaId, commentAutomationId: id,
          },
          data: {
            commentAutomationId: null, commentTriggerKeywords: null,
            commentTriggerResponse: null,
          },
        });
      }
      return id;
    }, { maxWait: 10000, timeout: 30000 });
    try { await invalidateAutomationCache(automation.instagramAccountId); }
    catch (cacheError) { console.warn("Comment automation cache invalidation failed:", cacheError); }
    return NextResponse.json({ success: true, data: { id: savedId, detachedFromShared: splitShared } });
  } catch (error) {
    if (error instanceof EditError)
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("PUT /api/automations/[id]/comment-edit error:", error);
    return NextResponse.json({ success: false, error: "ذخیره ویرایش پاسخ خودکار ناموفق بود." }, { status: 500 });
  }
}
