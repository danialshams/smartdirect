import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSavedResponseOrigin } from "@/lib/automation/saved-response-origin";
import { invalidateAutomationCache } from "@/lib/cache/instagram";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SHOWCASE" | "FORM";
type QuickReplyInput = {
  id: string;
  title: string;
  payload: string;
  destinationType: MessageType;
  savedResponseId?: string | null;
  destinationText: string;
  destinationFormId: string;
  destinationShowcaseId: string;
  destinationMediaUrl: string;
  destinationMediaId: string;
  destinationQuestion: string;
  destinationQuickReplies: QuickReplyInput[];
  isExit: boolean;
};
type MessageInput = {
  id: string;
  messageType: MessageType;
  text: string;
  mediaUrl: string;
  mediaId: string;
  showcaseId: string;
  formId: string;
  savedResponseId?: string | null;
  quickReplies: QuickReplyInput[];
  updateQuickReplies: boolean;
};

class StoryEditError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const types: MessageType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];

function keywordsFrom(value: unknown) {
  return Array.from(new Set(clean(value)
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .split(/[,،;؛\n]+/).map((word) => word.toLowerCase().trim()).filter(Boolean)));
}

function parseQuickReplies(value: unknown, depth: number, payloads: Set<string>): QuickReplyInput[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 13 || depth > 3)
    throw new StoryEditError("هر سؤال فرم باید بین ۲ تا ۱۳ گزینه داشته باشد (حداکثر ۴ سطح).");
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new StoryEditError("یکی از گزینه‌های فرم نامعتبر است.");
    const node = raw as JsonRecord;
    const title = clean(node.title);
    const payload = clean(node.payload);
    const destinationType = clean(node.destinationType) as MessageType;
    if (!title || title.length > 20 || !payload || payload.length > 1000 || !types.includes(destinationType))
      throw new StoryEditError("عنوان یا مقصد یکی از گزینه‌های فرم نامعتبر است.");
    if (payloads.has(payload)) throw new StoryEditError("شناسه گزینه‌های فرم تکراری است.");
    payloads.add(payload);
    const destinationText = clean(node.destinationText);
    const destinationQuestion = clean(node.destinationQuestion);
    const destinationShowcaseId = clean(node.destinationShowcaseId);
    const destinationMediaUrl = clean(node.destinationMediaUrl);
    const destinationMediaId = clean(node.destinationMediaId);
    if (destinationType === "TEXT" && !destinationText) throw new StoryEditError("متن مقصد گزینه فرم الزامی است.");
    if (destinationType === "SHOWCASE" && !destinationShowcaseId) throw new StoryEditError("ویترین مقصد یکی از گزینه‌ها مشخص نیست.");
    if (["IMAGE", "VIDEO", "AUDIO"].includes(destinationType) && !destinationMediaUrl && !destinationMediaId)
      throw new StoryEditError("فایل مقصد یکی از گزینه‌های فرم مشخص نیست.");
    if (destinationType === "FORM" && !destinationQuestion) throw new StoryEditError("متن سؤال بعدی را وارد کنید.");
    const children = destinationType === "FORM" ? parseQuickReplies(node.destinationQuickReplies, depth + 1, payloads) : [];
    return {
      id: clean(node.id), title, payload, destinationType, destinationText,
      savedResponseId: clean(node.savedResponseId) || null,
      destinationFormId: clean(node.destinationFormId), destinationShowcaseId,
      destinationMediaUrl, destinationMediaId, destinationQuestion, destinationQuickReplies: children,
      isExit: node.isExit === true,
    };
  });
}

function parseMessage(value: unknown): MessageInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StoryEditError("اطلاعات پاسخ استوری نامعتبر است.");
  const message = value as JsonRecord;
  const messageType = clean(message.messageType) as MessageType;
  if (!types.includes(messageType)) throw new StoryEditError("نوع پاسخ معتبر نیست.");
  const text = clean(message.text);
  const mediaUrl = clean(message.mediaUrl);
  const mediaId = clean(message.mediaId);
  const showcaseId = clean(message.showcaseId);
  const formId = clean(message.formId);
  if ((messageType === "TEXT" || messageType === "FORM") && (!text || text.length > 2000))
    throw new StoryEditError("متن پاسخ یا سؤال فرم را کامل وارد کنید (حداکثر ۲۰۰۰ کاراکتر).");
  if (["IMAGE", "VIDEO", "AUDIO"].includes(messageType) && !mediaUrl && !mediaId)
    throw new StoryEditError("فایل پاسخ را انتخاب کنید.");
  if (messageType === "SHOWCASE" && !showcaseId) throw new StoryEditError("ویترین پاسخ را انتخاب کنید.");
  const updateQuickReplies = message.updateQuickReplies !== false;
  const quickReplies = messageType === "FORM" && updateQuickReplies
    ? parseQuickReplies(message.quickReplies, 0, new Set<string>()) : [];
  return { id: clean(message.id), messageType, text, mediaUrl, mediaId, showcaseId, formId,
    savedResponseId: message.savedResponseId === undefined ? undefined : clean(message.savedResponseId) || null,
    quickReplies, updateQuickReplies };
}

function collectShowcases(replies: QuickReplyInput[], result: Set<string>) {
  for (const reply of replies) {
    if (reply.destinationType === "SHOWCASE") result.add(reply.destinationShowcaseId);
    collectShowcases(reply.destinationQuickReplies, result);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const current = await prisma.automation.findFirst({
      where: { id, instagramAccount: { userId: session.user.id } },
      include: { messages: { orderBy: { order: "asc" }, select: { id: true, messageType: true, _count: { select: { quickReplies: true } } } } },
    });
    if (!current || current.triggerType !== "STORY_REPLY_KEYWORD")
      return NextResponse.json({ success: false, error: "پاسخ خودکار استوری پیدا نشد." }, { status: 404 });
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new StoryEditError("اطلاعات ویرایش نامعتبر است.");
    const body = raw as JsonRecord;
    const title = body.title === undefined ? current.title || "" : clean(body.title);
    if (title.length > 80) throw new StoryEditError("نام پاسخ حداکثر ۸۰ نویسه است.");
    const expected = clean(body.expectedUpdatedAt);
    if (!expected || !Number.isFinite(Date.parse(expected))) throw new StoryEditError("صفحه را مجدداً باز کنید.", 409);
    if (current.updatedAt.getTime() !== new Date(expected).getTime())
      throw new StoryEditError("این پاسخ در جای دیگری تغییر کرده است. برای جلوگیری از بازنویسی، صفحه را دوباره باز کنید.", 409);

    const mediaId: string | null = null; // Account-wide story reply automation.
    const keywordMatchMode = body.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT";
    const keywords = keywordsFrom(body.keyword);
    if (keywordMatchMode === "EXACT" && !keywords.length) throw new StoryEditError("حداقل یک کلمه کلیدی وارد کنید.");
    if (keywords.length > 10) throw new StoryEditError("حداکثر ۱۰ کلمه کلیدی مجاز است.");
    const requireFollow = body.requireFollow === true;
    const followGateText = clean(body.followGateText);
    const followGateButtonText = clean(body.followGateButtonText);
    if (requireFollow && (!followGateText || followGateText.length > 640))
      throw new StoryEditError("متن درخواست فالو را وارد کنید (حداکثر ۶۴۰ کاراکتر).");
    if (requireFollow && (!followGateButtonText || followGateButtonText.length > 20))
      throw new StoryEditError("عنوان دکمه بررسی فالو باید بین ۱ تا ۲۰ کاراکتر باشد.");
    if (typeof body.isActive !== "boolean" || typeof body.likeStoryReply !== "boolean")
      throw new StoryEditError("وضعیت تنظیمات استوری نامعتبر است.");
    const message = parseMessage(body.message);
    let origin: string | null | undefined;
    try { origin = await validateSavedResponseOrigin(message.savedResponseId, current.instagramAccountId, session.user.id, message.messageType); }
    catch (error) { throw new StoryEditError(error instanceof Error ? error.message : "پاسخ ذخیره‌شده معتبر نیست."); }
    const originalMessageId = current.messages[0]?.id;
    if (message.id && message.id !== originalMessageId &&
        !message.id.startsWith("message_") && !message.id.startsWith("local_"))
      throw new StoryEditError("پیام انتخاب‌شده متعلق به این پاسخ نیست.");
    if (message.messageType === "FORM" && !message.updateQuickReplies &&
        (!originalMessageId || current.messages[0]?.messageType !== "FORM" || (current.messages[0]?._count.quickReplies ?? 0) < 2))
      throw new StoryEditError("گزینه‌های فرم ذخیره‌شده معتبر نیستند. صفحه را دوباره باز کنید.");

    // Story responses no longer bind to an individual story.
    const siblings = await prisma.automation.findMany({
      where: { instagramAccountId: current.instagramAccountId,
        triggerType: "STORY_REPLY_KEYWORD", id: { not: id } },
      select: { keyword: true, keywordMatchMode: true },
    });
    const nextWords = keywords.map(word => word.trim().toLocaleLowerCase());
    if (siblings.some(rule =>
      rule.keywordMatchMode === "CONTAINS_ANY" || keywordMatchMode === "CONTAINS_ANY" ||
      (rule.keyword || "").split(",").some(word => nextWords.includes(word.trim().toLocaleLowerCase()))
    )) throw new StoryEditError("این کلمه کلیدی در پاسخ استوری دیگری استفاده شده است.",409);

    const showcaseIds = new Set<string>();
    if (message.messageType === "SHOWCASE") showcaseIds.add(message.showcaseId);
    if (message.updateQuickReplies) collectShowcases(message.quickReplies, showcaseIds);
    if (showcaseIds.size) {
      const found = await prisma.showcase.findMany({
        where: { id: { in: [...showcaseIds] }, instagramAccountId: current.instagramAccountId, userId: session.user.id },
        select: { id: true },
      });
      if (found.length !== showcaseIds.size) throw new StoryEditError("یکی از ویترین‌های انتخاب‌شده متعلق به این پیج نیست.");
    }
    if (message.messageType === "FORM" && message.formId) {
      const form = await prisma.form.findFirst({
        where: { id: message.formId, instagramAccountId: current.instagramAccountId, userId: session.user.id },
        select: { id: true },
      });
      if (!form) throw new StoryEditError("فرم انتخاب‌شده متعلق به این پیج نیست.");
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.automation.updateMany({
        where: { id, updatedAt: new Date(expected) },
        data: {
          title: title || null,
          mediaId, keyword: keywordMatchMode === "CONTAINS_ANY" ? null : keywords.join(","),
          keywordMatchMode, requireFollow,
          followGateText: requireFollow ? followGateText : null,
          followGateButtonText: requireFollow ? followGateButtonText : null,
          likeStoryReply: body.likeStoryReply as boolean,
          isActive: body.isActive as boolean,
          sendDm: true,
        },
      });
      if (updated.count !== 1)
        throw new StoryEditError("پاسخ هم‌زمان تغییر کرده است. صفحه را دوباره باز کنید.", 409);

      const data = {
        messageType: message.messageType,
        ...(origin !== undefined ? { savedResponseId: null } : {}),
        text: message.text || null,
        mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(message.messageType) ? message.mediaUrl || null : null,
        mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(message.messageType) ? message.mediaId || null : null,
        showcaseId: message.messageType === "SHOWCASE" ? message.showcaseId || null : null,
        formId: message.messageType === "FORM" ? message.formId || null : null,
      };
      const saved = originalMessageId
        ? await tx.automationMessage.update({ where: { id: originalMessageId }, data })
        : await tx.automationMessage.create({ data: { ...data, automationId: id, order: 0 } });

      if (message.updateQuickReplies) {
        const oldReplies = await tx.quickReply.findMany({
          where: { automationMessageId: saved.id }, select: { id: true },
        });
        const oldIds = new Set(oldReplies.map((item) => item.id));
        const retained = message.quickReplies.map((item) => item.id).filter((id) => oldIds.has(id));
        await tx.quickReply.deleteMany({ where: { automationMessageId: saved.id, id: { notIn: retained } } });
        for (const reply of message.quickReplies) {
          const item = {
            title: reply.title, payload: reply.payload,
            replyText: JSON.stringify({
              type: reply.destinationType, isExit: reply.isExit,
              savedResponseId: null,
              text: reply.destinationText, formId: reply.destinationFormId,
              showcaseId: reply.destinationShowcaseId, mediaUrl: reply.destinationMediaUrl,
              mediaId: reply.destinationMediaId, question: reply.destinationQuestion,
              destinationQuestion: reply.destinationQuestion, quickReplies: reply.destinationQuickReplies,
            }),
          };
          if (oldIds.has(reply.id)) await tx.quickReply.update({ where: { id: reply.id }, data: item });
          else await tx.quickReply.create({ data: { ...item, automationMessageId: saved.id } });
        }
      }
      if (mediaId !== current.mediaId && current.mediaId) {
        // A previously published story may still link the old automation through
        // its publishing job. Clear only that old association; never touch other
        // stories or attach a job that already belongs to another response.
        await tx.instagramPublishJob.updateMany({
          where: {
            instagramAccountId: current.instagramAccountId,
            instagramMediaId: current.mediaId,
            storyReplyAutomationId: id,
          },
          data: {
            storyReplyAutomationId: null,
            storyReplyTriggerKeywords: null,
            storyReplyTriggerResponse: null,
          },
        });
      }
      // Older story automations can contain additional messages; leave those
      // intact instead of silently deleting them when editing the main reply.
    }, { maxWait: 10000, timeout: 30000 });

    try { await invalidateAutomationCache(current.instagramAccountId); }
    catch (cacheError) { console.warn("Story automation cache invalidation failed:", cacheError); }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof StoryEditError)
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("PUT /api/automations/[id]/story-edit error:", error);
    return NextResponse.json({ success: false, error: "ذخیره ویرایش پاسخ خودکار استوری ناموفق بود." }, { status: 500 });
  }
}
