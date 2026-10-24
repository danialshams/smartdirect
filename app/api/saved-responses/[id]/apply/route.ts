import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectSavedResponseMedia } from "@/lib/automation/saved-response-media";
import { getStorageProviderForObject } from "@/lib/storage/provider";
import { checkedUsagePlan, type ResponseUsageSelection } from "@/lib/automation/saved-response-scope";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";
type JsonRecord = Record<string, unknown>;
const string = (v: unknown) => typeof v === "string" ? v.trim() : "";
const messageTypes = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"] as const;
type Type = (typeof messageTypes)[number];
class ApplyError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
type Reply = { title: string; payload: string; destinationType: Type; destinationText: string;
  destinationShowcaseId: string; destinationFormId: string; destinationMediaUrl: string;
  destinationMediaId: string; destinationQuestion: string; destinationQuickReplies: Reply[];
  savedResponseId: string | null; isExit: boolean };

function parseReplies(raw: unknown, depth = 0, seen = new Set<string>()): Reply[] {
  if (!Array.isArray(raw) || raw.length > 13 || depth > 3) throw new ApplyError("ساختار فرم معتبر نیست.");
  return raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ApplyError("یکی از پاسخ‌های فرم معتبر نیست.");
    const o = item as JsonRecord;
    const destinationType = string(o.destinationType) as Type;
    const title = string(o.title), payload = string(o.payload);
    if (!title || title.length > 20 || !payload || seen.has(payload) || !messageTypes.includes(destinationType))
      throw new ApplyError("عنوان، مقصد یا شناسه یکی از پاسخ‌های فرم معتبر نیست.");
    seen.add(payload);
    const destinationText = string(o.destinationText);
    const destinationQuestion = string(o.destinationQuestion);
    const destinationShowcaseId = string(o.destinationShowcaseId);
    const destinationFormId = string(o.destinationFormId);
    const destinationMediaUrl = string(o.destinationMediaUrl);
    const destinationMediaId = string(o.destinationMediaId);
    if (destinationType === "TEXT" && !destinationText) throw new ApplyError("متن گزینه فرم را وارد کن.");
    if (destinationType === "FORM" && !destinationQuestion) throw new ApplyError("سؤال بعدی فرم ناقص است.");
    if (destinationType === "SHOWCASE" && !destinationShowcaseId) throw new ApplyError("ویترین گزینه فرم مشخص نیست.");
    if (["IMAGE", "VIDEO", "AUDIO"].includes(destinationType) && !destinationMediaUrl && !destinationMediaId)
      throw new ApplyError("فایل گزینه فرم مشخص نیست.");
    return {
      title, payload, destinationType, destinationText, destinationQuestion,
      destinationShowcaseId, destinationFormId, destinationMediaUrl, destinationMediaId,
      savedResponseId: string(o.savedResponseId) || null, isExit: o.isExit === true,
      destinationQuickReplies: destinationType === "FORM" ? parseReplies(o.destinationQuickReplies, depth + 1, seen) : [],
    };
  });
}

function encodeReply(reply: Reply) {
  return JSON.stringify({
    type: reply.destinationType, destinationType: reply.destinationType,
    isExit: reply.isExit, text: reply.destinationText, destinationText: reply.destinationText,
    question: reply.destinationQuestion, destinationQuestion: reply.destinationQuestion,
    showcaseId: reply.destinationShowcaseId, destinationShowcaseId: reply.destinationShowcaseId,
    formId: reply.destinationFormId, destinationFormId: reply.destinationFormId,
    mediaUrl: reply.destinationMediaUrl, destinationMediaUrl: reply.destinationMediaUrl,
    mediaId: reply.destinationMediaId, destinationMediaId: reply.destinationMediaId,
    savedResponseId: reply.savedResponseId, quickReplies: reply.destinationQuickReplies,
    destinationQuickReplies: reply.destinationQuickReplies,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ApplyError("درخواست معتبر نیست.");
    const body = raw as JsonRecord;
    const expected = new Date(string(body.expectedUpdatedAt));
    if (!Number.isFinite(expected.getTime())) throw new ApplyError("نسخه پاسخ مشخص نیست.", 409);
    const title = string(body.title);
    const type = string(body.messageType) as Type;
    if (!title || title.length > 80 || !messageTypes.includes(type)) throw new ApplyError("نام یا نوع پاسخ نامعتبر است.");
    const text = string(body.text) || null;
    const mediaUrl = string(body.mediaUrl) || null;
    const mediaId = string(body.mediaId) || null;
    const showcaseId = string(body.showcaseId) || null;
    const formId = string(body.formId) || null;
    const quickReplies = type === "FORM" ? parseReplies(body.quickReplies) : [];
    if ((type === "TEXT" || type === "FORM") && (!text || text.length > 2000))
      throw new ApplyError("متن پاسخ باید بین ۱ تا ۲۰۰۰ نویسه باشد.");
    if (type === "FORM" && (quickReplies.length < 2 || quickReplies.length > 13))
      throw new ApplyError("فرم حداقل دو گزینه لازم دارد.");
    if (["IMAGE", "VIDEO", "AUDIO"].includes(type) && !mediaUrl && !mediaId)
      throw new ApplyError("فایل پاسخ انتخاب نشده است.");
    if (type === "SHOWCASE" && !showcaseId) throw new ApplyError("ویترین را انتخاب کن.");

    const selectionsRaw = body.selections;
    if (!Array.isArray(selectionsRaw) || selectionsRaw.length > 100 || !selectionsRaw.length)
      throw new ApplyError("حداقل یک محل استفاده را انتخاب کن.");
    const selections: ResponseUsageSelection[] = selectionsRaw.map((x) => {
      if (!x || typeof x !== "object" || Array.isArray(x)) throw new ApplyError("انتخاب محل استفاده نامعتبر است.");
      const v = x as JsonRecord;
      if (typeof v.messageId !== "string" || !v.messageId.trim() || !Array.isArray(v.mediaIds) ||
        v.mediaIds.some((m: unknown) => typeof m !== "string"))
        throw new ApplyError("شناسه یا محتوای انتخاب‌شده معتبر نیست.");
      if (!Number.isFinite(Date.parse(string(v.expectedMessageUpdatedAt))) ||
        !Number.isFinite(Date.parse(string(v.expectedAutomationUpdatedAt))))
        throw new ApplyError("نسخه محل استفاده مشخص نیست. دوباره بارگذاری کن.", 409);
      return { messageId: v.messageId.trim(), mediaIds: v.mediaIds,
        expectedMessageUpdatedAt: string(v.expectedMessageUpdatedAt),
        expectedAutomationUpdatedAt: string(v.expectedAutomationUpdatedAt) };
    });

    const saved = await prisma.savedAutomationResponse.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!saved) throw new ApplyError("پاسخ ذخیره‌شده پیدا نشد.", 404);
    if (saved.updatedAt.getTime() !== expected.getTime()) throw new ApplyError("پاسخ تغییر کرده است؛ صفحه را تازه‌سازی کن.", 409);
    if (saved.messageType !== type) throw new ApplyError("نوع پاسخ مشترک قابل تغییر نیست؛ یک پاسخ جدید بساز.");

    if (type === "SHOWCASE" && !await prisma.showcase.findFirst({
      where: { id: showcaseId || "", userId: session.user.id, instagramAccountId: saved.instagramAccountId }, select: { id: true },
    })) throw new ApplyError("ویترین انتخاب‌شده متعلق به این پیج نیست.");
    if (type === "FORM" && formId && !await prisma.form.findFirst({
      where: { id: formId, userId: session.user.id, instagramAccountId: saved.instagramAccountId }, select: { id: true },
    })) throw new ApplyError("فرم انتخاب‌شده متعلق به این پیج نیست.");
    const refs = collectSavedResponseMedia({ messageType: type, mediaUrl, quickReplies });
    if (refs.missingOriginal) throw new ApplyError("برای پاسخ رسانه‌ای، فایل اصلی را آپلود کن.");
    for (const url of refs.urls) {
      const object = await prisma.instagramStorageObject.findFirst({
        where: { userId: session.user.id, publicUrl: url, deletedAt: null },
        select: { storageKey: true, publicUrl: true },
      });
      if (!object || !await getStorageProviderForObject(object.storageKey, object.publicUrl).exists(object.storageKey))
        throw new ApplyError("فایل اصلی این پاسخ در فضای ذخیره‌سازی وجود ندارد.");
    }

    const current = await prisma.automationMessage.findMany({
      where: { savedResponseId: id, automation: { instagramAccountId: saved.instagramAccountId } },
      include: { automation: true, quickReplies: { orderBy: { createdAt: "asc" } } },
    });
    const mediaFor = (a: { mediaId: string | null; mediaIds: string | null }) =>
      Array.from(new Set([...(a.mediaId ? [a.mediaId] : []), ...(a.mediaIds || "").split(",").map((i) => i.trim()).filter(Boolean)]));
    const plan = checkedUsagePlan(
      current.map((m) => ({ messageId: m.id, mediaIds: mediaFor(m.automation) })),
      selections,
    );
    const byMessage = new Map(plan.map((p) => [p.messageId, p]));
    const bySelection = new Map(selections.map((s) => [s.messageId, s]));
    const groups = new Map<string, typeof current>();
    for (const message of current) {
      const list = groups.get(message.automationId) || [];
      list.push(message);
      groups.set(message.automationId, list);
    }
    // The same automation cannot receive contradictory media selections.
    for (const group of groups.values()) {
      const chosen = group.filter((m) => byMessage.has(m.id));
      if (chosen.length < 2) continue;
      const scopes = chosen.map((m) => byMessage.get(m.id)!.selected.join(","));
      if (new Set(scopes).size > 1) throw new ApplyError("محتواهای یک اتوماسیون باید برای تمام پیام‌های مشترک یکسان انتخاب شوند.");
    }

    const applied = await prisma.$transaction(async (tx) => {
      const locked = await tx.savedAutomationResponse.updateMany({
        where: { id, userId: session.user.id, updatedAt: expected },
        data: { title, text, mediaUrl, mediaId,
          showcaseId: type === "SHOWCASE" ? showcaseId : null,
          formId: type === "FORM" ? formId : null, quickReplies },
      });
      if (locked.count !== 1) throw new ApplyError("پاسخ هم‌زمان تغییر کرده است.", 409);

      async function applyToMessage(messageId: string, previousUpdatedAt: Date) {
        const data = {
          text, mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(type) ? mediaUrl : null,
          mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(type) ? mediaId : null,
          showcaseId: type === "SHOWCASE" ? showcaseId : null,
          formId: type === "FORM" ? formId : null,
        };
        const result = await tx.automationMessage.updateMany({
          where: { id: messageId, savedResponseId: id, updatedAt: previousUpdatedAt },
          data,
        });
        if (result.count !== 1) throw new ApplyError("یک پیام هم‌زمان تغییر کرده است.", 409);
        if (type !== "FORM") return;
        const old = await tx.quickReply.findMany({ where: { automationMessageId: messageId }, orderBy: { createdAt: "asc" } });
        if (old.length > quickReplies.length)
          throw new ApplyError("حذف گزینه‌های فرم مشترک باید از صفحه همان اتوماسیون انجام شود تا تاریخچه گفتگو حفظ شود.", 409);
        for (const [index, reply] of quickReplies.entries()) {
          const previous = old[index];
          if (previous) await tx.quickReply.update({
            where: { id: previous.id },
            data: { title: reply.title, replyText: encodeReply(reply) },
          });
          else await tx.quickReply.create({
            data: { automationMessageId: messageId, title: reply.title, payload: reply.payload, replyText: encodeReply(reply) },
          });
        }
      }

      let changed = 0, split = 0;
      for (const [automationId, messages] of groups) {
        const a = messages[0].automation;
        const selected = messages.filter((m) => byMessage.has(m.id));
        if (!selected.length) {
          await tx.automationMessage.updateMany({
            where: { automationId, savedResponseId: id }, data: { savedResponseId: null },
          });
          continue;
        }
        for (const message of selected) {
          const snapshot = bySelection.get(message.id)!;
          if (message.updatedAt.getTime() !== new Date(snapshot.expectedMessageUpdatedAt).getTime() ||
            a.updatedAt.getTime() !== new Date(snapshot.expectedAutomationUpdatedAt).getTime())
            throw new ApplyError("اطلاعات یکی از محل‌های استفاده تغییر کرده است. دوباره بارگذاری کن.", 409);
        }
        const scope = byMessage.get(selected[0].id)!;
        const fullMedia = mediaFor(a);
        if (scope.split) {
          if (a.triggerType !== "COMMENT_KEYWORD" || fullMedia.length < 2 ||
            fullMedia.includes("__smartdirect_live_comments_v1__"))
            throw new ApplyError("جداسازی محتوا برای این نوع اتوماسیون پشتیبانی نمی‌شود.");
          const lockedAutomation = await tx.automation.updateMany({
            where: { id: automationId, updatedAt: a.updatedAt },
            data: { mediaId: scope.remaining.length === 1 ? scope.remaining[0] : null, mediaIds: scope.remaining.join(",") },
          });
          if (lockedAutomation.count !== 1) throw new ApplyError("ارتباط محتواها هم‌زمان تغییر کرده است.", 409);
          const clone = await tx.automation.create({
            data: {
              instagramAccountId: a.instagramAccountId, triggerType: a.triggerType,
              title: a.title, keyword: a.keyword, keywordMatchMode: a.keywordMatchMode,
              mediaId: scope.selected.length === 1 ? scope.selected[0] : null,
              mediaIds: scope.selected.join(","), commentReplyText: a.commentReplyText,
              replyText: a.replyText, isActive: a.isActive, likeComment: a.likeComment,
              likeIncomingDm: a.likeIncomingDm, likeStoryReply: a.likeStoryReply,
              sendDm: a.sendDm, requireFollow: a.requireFollow, followGateText: a.followGateText,
              followGateButtonText: a.followGateButtonText,
            }, select: { id: true },
          });
          const originalMessages = await tx.automationMessage.findMany({
            where: { automationId }, orderBy: { order: "asc" }, include: { quickReplies: true },
          });
          const remap = new Map<string, string>();
          for (const old of originalMessages) {
            const fresh = await tx.automationMessage.create({
              data: {
                automationId: clone.id, order: old.order, messageType: old.messageType,
                text: old.text, mediaId: old.mediaId, mediaUrl: old.mediaUrl,
                showcaseId: old.showcaseId, formId: old.formId,
                linkButtonUrl: old.linkButtonUrl, linkButtonTitle: old.linkButtonTitle,
                linkButtons: old.linkButtons === null ? undefined : old.linkButtons as NonNullable<typeof old.linkButtons>,
                savedResponseId: byMessage.has(old.id) ? id : (old.savedResponseId === id ? null : old.savedResponseId),
              }, select: { id: true },
            });
            remap.set(old.id, fresh.id);
          }
          for (const old of originalMessages) {
            const destination = remap.get(old.id)!;
            for (const reply of old.quickReplies) await tx.quickReply.create({
              data: {
                automationMessageId: destination, title: reply.title, payload: reply.payload,
                replyText: reply.replyText, nextMessageId: reply.nextMessageId ? remap.get(reply.nextMessageId) || null : null,
              },
            });
          }
          for (const message of selected) {
            const targetId = remap.get(message.id);
            if (!targetId) throw new ApplyError("پیام انتخاب‌شده دیگر در اتوماسیون وجود ندارد.", 409);
            const fresh = await tx.automationMessage.findUniqueOrThrow({ where: { id: targetId } });
            await applyToMessage(targetId, fresh.updatedAt);
            changed++;
          }
          // Formerly linked media keep their old response data and are now independent.
          await tx.automationMessage.updateMany({
            where: { automationId, savedResponseId: id }, data: { savedResponseId: null },
          });
          await tx.instagramPublishJob.updateMany({
            where: { instagramAccountId: a.instagramAccountId, instagramMediaId: { in: scope.selected },
              commentAutomationId: automationId },
            data: { commentAutomationId: clone.id },
          });
          split++;
        } else {
          // Update selected linked messages in place; unchecked messages remain independent.
          for (const message of selected) {
            await applyToMessage(message.id, message.updatedAt);
            changed++;
          }
          await tx.automationMessage.updateMany({
            where: { automationId, savedResponseId: id,
              id: { notIn: selected.map((m) => m.id) } },
            data: { savedResponseId: null },
          });
        }
      }
      return { changed, split };
    }, { maxWait: 10000, timeout: 30000 });

    try { await invalidateAutomationCache(saved.instagramAccountId); }
    catch (error) { console.warn("Reusable response cache invalidation failed:", error); }
    return NextResponse.json({ success: true, data: applied });
  } catch (error) {
    console.error("PATCH saved response scoped apply error:", error);
    const status = error instanceof ApplyError ? error.status : 500;
    return NextResponse.json({ success: false, error: error instanceof ApplyError ? error.message : "اعمال تغییرات پاسخ ناموفق بود." }, { status });
  }
}
