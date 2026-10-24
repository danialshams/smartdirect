import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectSavedResponseMedia } from "@/lib/automation/saved-response-media";
import { getStorageProviderForObject } from "@/lib/storage/provider";
import { checkedUsagePlan, type ResponseUsageSelection } from "@/lib/automation/saved-response-scope";
import { nestedReplyUses, editQuickReplyDestination } from "@/lib/automation/nested-response-usage";
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
      const quickReplyId = string(v.quickReplyId);
      const nodePath = v.nodePath;
      if (quickReplyId && (!Array.isArray(nodePath) || nodePath.length > 16 ||
        nodePath.some((part: unknown, i: number) => i % 2 === 0
          ? part !== "quickReplies" && part !== "destinationQuickReplies"
          : typeof part !== "number" || !Number.isSafeInteger(part) || part < 0)))
        throw new ApplyError("مسیر گزینه داخلی فرم معتبر نیست.");
      return { messageId: v.messageId.trim(),
        ...(quickReplyId ? { quickReplyId, nodePath: nodePath as Array<string | number> } : {}),
        mediaIds: v.mediaIds,
        expectedMessageUpdatedAt: string(v.expectedMessageUpdatedAt),
        expectedAutomationUpdatedAt: string(v.expectedAutomationUpdatedAt) };
    });

    const expectedUsagesRaw = body.expectedUsages;
    if (!Array.isArray(expectedUsagesRaw) || expectedUsagesRaw.length > 100)
      throw new ApplyError("اطلاعات محل‌های استفاده ناقص است. فهرست را تازه‌سازی کن.", 409);
    const expectedUsages = expectedUsagesRaw.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ApplyError("اطلاعات محل استفاده معتبر نیست.", 409);
      const item = raw as JsonRecord;
      if (!string(item.messageId) || !Number.isFinite(Date.parse(string(item.messageUpdatedAt))) ||
        !Number.isFinite(Date.parse(string(item.automationUpdatedAt))))
        throw new ApplyError("نسخه محل استفاده معتبر نیست.", 409);
      return {
        messageId: string(item.messageId), messageUpdatedAt: string(item.messageUpdatedAt),
        automationUpdatedAt: string(item.automationUpdatedAt),
      };
    });
    if (new Set(expectedUsages.map((item) => item.messageId)).size !== expectedUsages.length)
      throw new ApplyError("اطلاعات محل‌های استفاده تکراری است.", 409);
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
    // Recursive form destinations also need account and type isolation.
    const nestedRefs = new Map<string, string>();
    const nestedShowcases = new Set<string>();
    const nestedForms = new Set<string>();
    function collectNested(items: Reply[]) {
      for (const item of items) {
        if (item.savedResponseId) nestedRefs.set(item.savedResponseId, item.destinationType);
        if (item.destinationShowcaseId) nestedShowcases.add(item.destinationShowcaseId);
        if (item.destinationFormId) nestedForms.add(item.destinationFormId);
        collectNested(item.destinationQuickReplies);
      }
    }
    collectNested(quickReplies);
    if (nestedRefs.size) {
      const found = await prisma.savedAutomationResponse.findMany({
        where: { id: { in: [...nestedRefs.keys()] }, userId: session.user.id, instagramAccountId: saved.instagramAccountId },
        select: { id: true, messageType: true },
      });
      if (found.length !== nestedRefs.size || found.some((item) => item.messageType !== nestedRefs.get(item.id)))
        throw new ApplyError("یکی از پاسخ‌های داخل فرم با این پیج یا نوع مقصد سازگار نیست.");
    }
    if (nestedShowcases.size && await prisma.showcase.count({
      where: { id: { in: [...nestedShowcases] }, userId: session.user.id, instagramAccountId: saved.instagramAccountId },
    }) !== nestedShowcases.size) throw new ApplyError("یکی از ویترین‌های داخل فرم متعلق به این پیج نیست.");
    if (nestedForms.size && await prisma.form.count({
      where: { id: { in: [...nestedForms] }, userId: session.user.id, instagramAccountId: saved.instagramAccountId },
    }) !== nestedForms.size) throw new ApplyError("یکی از فرم‌های داخلی متعلق به این پیج نیست.");
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
    type NestedLink = {
      usageId: string; quickReplyId: string; path: Array<string | number>;
      root: { id: string; updatedAt: Date; replyText: string | null; automationMessageId: string;
        nextMessageId: string | null; title: string; payload: string;
        automationMessage: { automation: (typeof current)[number]["automation"] } };
    };
    const nested: NestedLink[] = [];
    const candidates = await prisma.quickReply.findMany({
      where: { replyText: { contains: "savedResponseId" },
        automationMessage: { automation: { instagramAccountId: saved.instagramAccountId } } },
      select: { id: true, updatedAt: true, replyText: true, automationMessageId: true,
        nextMessageId: true, title: true, payload: true,
        automationMessage: { select: { automation: true } } },
    });
    for (const root of candidates) {
      for (const use of nestedReplyUses(root.replyText)) if (use.savedResponseId === id) {
        const usageId = "qr:" + root.id + ":" + (use.path.length ? use.path.join(".") : "root");
        if (use.messageType !== type)
          throw new ApplyError("نوع یک مقصد داخلی با قالب ذخیره‌شده متفاوت است.", 409);
        nested.push({ usageId, quickReplyId: root.id, path: use.path, root });
      }
    }
    const allIds = [...current.map((item) => item.id), ...nested.map((item) => item.usageId)];
    if (allIds.length !== expectedUsages.length ||
      new Set(allIds).size !== allIds.length ||
      current.some((item) => {
        const snapshot = expectedUsages.find((expected) => expected.messageId === item.id);
        return !snapshot || item.updatedAt.getTime() !== Date.parse(snapshot.messageUpdatedAt) ||
          item.automation.updatedAt.getTime() !== Date.parse(snapshot.automationUpdatedAt);
      }) ||
      nested.some((item) => {
        const snapshot = expectedUsages.find((expected) => expected.messageId === item.usageId);
        return !snapshot || item.root.updatedAt.getTime() !== Date.parse(snapshot.messageUpdatedAt) ||
          item.root.automationMessage.automation.updatedAt.getTime() !== Date.parse(snapshot.automationUpdatedAt);
      }))
      throw new ApplyError("اتصال‌های این پاسخ تغییر کرده‌اند. فهرست را تازه‌سازی کن.", 409);
    if (current.some((item) => item.messageType !== type))
      throw new ApplyError("نوع یکی از پیام‌های متصل با قالب ذخیره‌شده متفاوت است. آن را از صفحه مربوط بررسی کن.", 409);
    const mediaFor = (a: { mediaId: string | null; mediaIds: string | null }) =>
      Array.from(new Set([...(a.mediaId ? [a.mediaId] : []), ...(a.mediaIds || "").split(",").map((i) => i.trim()).filter(Boolean)]));
    const directChoices = selections.filter((selection) => !selection.quickReplyId);
    const plan = directChoices.length
      ? checkedUsagePlan(
          current.map((m) => ({ messageId: m.id, mediaIds: mediaFor(m.automation) })),
          directChoices,
        )
      : [];
    const nestedChoices = selections.filter((selection) => selection.quickReplyId);
    for (const choice of nestedChoices) {
      const link = nested.find((item) => item.usageId === choice.messageId);
      if (!link || choice.quickReplyId !== link.quickReplyId ||
        JSON.stringify(choice.nodePath || []) !== JSON.stringify(link.path))
        throw new ApplyError("یکی از شاخه‌های انتخاب‌شده متعلق به این پاسخ نیست.", 409);
    }
    const nestedPlan = nestedChoices.length
      ? checkedUsagePlan(nested.map((item) => ({
        messageId: item.usageId, mediaIds: mediaFor(item.root.automationMessage.automation),
      })), nestedChoices)
      : [];
    const byNested = new Map(nestedPlan.map((item) => [item.messageId, item]));
    const nestedGroups = new Map<string, NestedLink[]>();
    for (const item of nested) {
      const aId = item.root.automationMessage.automation.id;
      nestedGroups.set(aId, [...(nestedGroups.get(aId) || []), item]);
    }
    const byMessage = new Map(plan.map((p) => [p.messageId, p]));
    const bySelection = new Map(selections.map((s) => [s.messageId, s]));
    const groups = new Map<string, typeof current>();
    for (const message of current) {
      const list = groups.get(message.automationId) || [];
      list.push(message);
      groups.set(message.automationId, list);
    }
    // A single automation can contain both standalone and nested references.
    // Mixed structural edits are refused rather than risking a partial clone.
    for (const [automationId, links] of nestedGroups) {
      if (links.some((item) => byNested.has(item.usageId)) &&
        groups.get(automationId)?.some((message) => byMessage.has(message.id)))
        throw new ApplyError("این اتوماسیون هم پاسخ اصلی و هم شاخه فرم را استفاده می‌کند. آن‌ها را جداگانه ویرایش کن.", 409);
      const active = links.filter((item) => byNested.has(item.usageId));
      const partitions = active.map((item) => byNested.get(item.usageId)!.selected.join(","));
      if (new Set(partitions).size > 1)
        throw new ApplyError("برای شاخه‌های یک اتوماسیون باید یک محدوده محتوایی انتخاب شود.");
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

      const refreshed = await tx.automationMessage.findMany({
        where: { savedResponseId: id, automation: { instagramAccountId: saved.instagramAccountId } },
        select: { id: true, updatedAt: true, automation: { select: { updatedAt: true } } },
      });
      if (refreshed.length !== expectedUsages.length ||
        refreshed.some((item) => {
          const expectedUsage = expectedUsages.find((usage) => usage.messageId === item.id);
          return !expectedUsage || item.updatedAt.getTime() !== Date.parse(expectedUsage.messageUpdatedAt) ||
            item.automation.updatedAt.getTime() !== Date.parse(expectedUsage.automationUpdatedAt);
        }))
        throw new ApplyError("اتصال‌ها هم‌زمان تغییر کرده‌اند. دوباره بارگذاری کن.", 409);

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
        if (old.some((reply) => reply.nextMessageId))
          throw new ApplyError("این فرم به مرحله‌های جداگانه متصل است؛ برای حفظ مسیر گفتگو آن را از صفحه اتوماسیون ویرایش کن.", 409);
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
          const lockedAutomation = await tx.automation.updateMany({
            where: { id: automationId, updatedAt: a.updatedAt },
            data: { updatedAt: new Date() },
          });
          if (lockedAutomation.count !== 1)
            throw new ApplyError("این اتوماسیون هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کن.", 409);
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
    }, { maxWait: 10000, timeout: 30000, isolationLevel: "Serializable" });

    const updatedTemplate = await prisma.savedAutomationResponse.findUniqueOrThrow({ where: { id } });
    try { await invalidateAutomationCache(saved.instagramAccountId); }
    catch (error) { console.warn("Reusable response cache invalidation failed:", error); }
    return NextResponse.json({ success: true, data: { ...applied, template: updatedTemplate } });
  } catch (error) {
    console.error("PATCH saved response scoped apply error:", error);
    const status = error instanceof ApplyError ? error.status :
      (typeof error === "object" && error !== null && "code" in error && error.code === "P2034" ? 409 : 500);
    return NextResponse.json({ success: false, error: error instanceof ApplyError ? error.message : status === 409 ? "اطلاعات هم‌زمان تغییر کرده است. صفحه را تازه‌سازی کن." : "اعمال تغییرات پاسخ ناموفق بود." }, { status });
  }
}
