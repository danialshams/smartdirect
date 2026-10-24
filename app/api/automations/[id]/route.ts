import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storePublicCommentReplies } from "@/lib/automation/comment-reply-variants";
import { getCachedInstagramMedia, invalidateAutomationCache } from "@/lib/cache/instagram";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

function normalizePersianDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
function normalizeKeyword(value: string) { return normalizePersianDigits(value).trim().toLowerCase(); }
function normalizeKeywords(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const keywords = value.split(/[\n,،;؛]+/).map(normalizeKeyword).filter(Boolean).filter((keyword, index, list) => list.indexOf(keyword) === index);
  return keywords.length ? keywords.join(",") : null;
}
function normalizeOptionalString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
const validTriggerTypes = ["COMMENT_KEYWORD", "DM", "STORY_REPLY_KEYWORD", "DM_MEDIA_SHARE", "STORY_MENTION"] as const;
type TriggerType = (typeof validTriggerTypes)[number];
function isValidTriggerType(value: unknown): value is TriggerType { return typeof value === "string" && validTriggerTypes.includes(value as TriggerType); }

const automationInclude = {
  messages: {
    orderBy: { order: "asc" as const },
    include: {
      quickReplies: {
        orderBy: { createdAt: "asc" as const },
        include: { nextMessage: { select: { id: true, messageType: true, text: true, mediaUrl: true, mediaId: true, showcaseId: true, formId: true, order: true } } },
      },
      showcase: { include: { items: { where: { isActive: true }, orderBy: { order: "asc" as const } } } },
      form: { include: { fields: { orderBy: { order: "asc" as const } } } },
    },
  },
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "شناسه Automation الزامی است" }, { status: 400 });
    const automation = await prisma.automation.findFirst({ where: { id, instagramAccount: { userId: session.user.id } }, include: { instagramAccount: { select: { id: true, igUserId: true, igUsername: true, isConnected: true } }, ...automationInclude } });
    if (!automation) return NextResponse.json({ success: false, error: "Automation پیدا نشد" }, { status: 404 });
    return NextResponse.json({ success: true, data: automation });
  } catch (error) {
    console.error("GET /api/automations/[id] error:", error);
    return NextResponse.json({ success: false, error: "خطا در دریافت Automation" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "شناسه Automation الزامی است" }, { status: 400 });

    const existingAutomation = await prisma.automation.findFirst({ where: { id, instagramAccount: { userId: session.user.id } } });
    if (!existingAutomation) return NextResponse.json({ success: false, error: "Automation پیدا نشد" }, { status: 404 });

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "اطلاعات ارسالی نامعتبر است" }, { status: 400 });

    // Link an existing automation to selected content without modifying its trigger,
    // keywords, messages, follow gate, or active state.
    if (body.linkMediaOnly === true) {
      if (body.triggerType !== existingAutomation.triggerType) {
        return NextResponse.json({ success: false, error: "نوع پاسخ خودکار با محتوای انتخابی سازگار نیست" }, { status: 400 });
      }
      const trigger = existingAutomation.triggerType;
      if (trigger !== "COMMENT_KEYWORD" && trigger !== "STORY_REPLY_KEYWORD") {
        return NextResponse.json({ success: false, error: "این نوع پاسخ خودکار به محتوا متصل نمی‌شود" }, { status: 400 });
      }
      if (!Array.isArray(body.mediaIds) || body.mediaIds.some((value: unknown) => typeof value !== "string" || !value.trim())) {
        return NextResponse.json({ success: false, error: "فهرست محتواهای انتخابی نامعتبر است" }, { status: 400 });
      }
      const targetIds = Array.from(new Set((body.mediaIds as string[]).map((value) => value.trim())));
      if (targetIds.length === 0 || (trigger === "STORY_REPLY_KEYWORD" && targetIds.length !== 1)) {
        return NextResponse.json({ success: false, error: trigger === "COMMENT_KEYWORD" ? "حداقل یک پست یا ریلز انتخاب کنید" : "فقط یک استوری انتخاب کنید" }, { status: 400 });
      }
      const requestedMediaId = typeof body.mediaId === "string" && body.mediaId.trim() ? body.mediaId.trim() : null;
      if (trigger === "STORY_REPLY_KEYWORD" && requestedMediaId !== targetIds[0]) {
        return NextResponse.json({ success: false, error: "شناسه استوری با محتوای انتخابی مطابقت ندارد" }, { status: 400 });
      }
      if (trigger === "COMMENT_KEYWORD" && requestedMediaId !== (targetIds.length === 1 ? targetIds[0] : null)) {
        return NextResponse.json({ success: false, error: "شناسه محتوا با فهرست انتخابی مطابقت ندارد" }, { status: 400 });
      }

      // Verify that every submitted media ID belongs to this connected Instagram account.
      const account = await prisma.instagramAccount.findFirst({
        where: { id: existingAutomation.instagramAccountId, userId: session.user.id, isConnected: true },
        select: { id: true, igUserId: true },
      });
      if (!account) return NextResponse.json({ success: false, error: "اکانت اینستاگرام متصل نیست" }, { status: 409 });

      let ownedMediaIds = new Set<string>();
      if (trigger === "COMMENT_KEYWORD") {
        const mediaResult = await getCachedInstagramMedia(account.id, 50);
        ownedMediaIds = new Set((mediaResult?.data ?? []).map((item: Record<string, unknown>) => String(item.id ?? "")).filter(Boolean));
      } else {
        const accessToken = await getValidInstagramAccessToken(account.id);
        const storiesUrl = new URL(`https://graph.instagram.com/v26.0/${account.igUserId}/stories`);
        storiesUrl.searchParams.set("fields", "id");
        storiesUrl.searchParams.set("limit", "50");
        storiesUrl.searchParams.set("access_token", accessToken);
        const storiesResponse = await fetch(storiesUrl.toString(), { method: "GET", cache: "no-store" });
        const storiesResult = await storiesResponse.json();
        if (!storiesResponse.ok || !Array.isArray(storiesResult?.data)) {
          return NextResponse.json({ success: false, error: "اعتبارسنجی استوری‌های اینستاگرام ناموفق بود؛ دوباره تلاش کنید" }, { status: 502 });
        }
        ownedMediaIds = new Set(storiesResult.data.map((item: { id?: unknown }) => String(item.id ?? "")).filter(Boolean));
      }
      const invalidMediaId = targetIds.find((targetId) => !ownedMediaIds.has(targetId));
      if (invalidMediaId) {
        return NextResponse.json({ success: false, error: "یکی از محتواهای انتخابی متعلق به این اکانت نیست یا دیگر در دسترس نیست" }, { status: 400 });
      }

      const peers = await prisma.automation.findMany({
        where: { instagramAccountId: existingAutomation.instagramAccountId, triggerType: trigger, id: { not: id } },
        select: { id: true, mediaId: true, mediaIds: true },
      });
      const occupied = new Set<string>();
      for (const peer of peers) {
        if (peer.mediaId) occupied.add(peer.mediaId);
        if (peer.mediaIds) peer.mediaIds.split(",").map((value) => value.trim()).filter(Boolean).forEach((value) => occupied.add(value));
      }
      const conflict = targetIds.find((targetId) => occupied.has(targetId));
      if (conflict) {
        return NextResponse.json({ success: false, error: "یکی از محتواهای انتخابی از قبل به پاسخ خودکار دیگری متصل است" }, { status: 409 });
      }
      const automation = await prisma.automation.update({
        where: { id },
        data: {
          mediaId: trigger === "STORY_REPLY_KEYWORD" ? targetIds[0] : (targetIds.length === 1 ? targetIds[0] : null),
          mediaIds: trigger === "COMMENT_KEYWORD" ? targetIds.join(",") : null,
          // Reusing a saved response is a new activity and should update its list position/date.
          updatedAt: new Date(),
        },
        include: automationInclude,
      });
      try { await invalidateAutomationCache(existingAutomation.instagramAccountId); }
      catch (cacheError) { console.warn("Automation cache invalidation failed:", cacheError); }
      return NextResponse.json({ success: true, data: automation });
    }

    const { triggerType, keyword, mediaId, likeComment, commentReplyText, commentReplyVariants, sendDm, likeIncomingDm, likeStoryReply, replyText, requireFollow, followGateText, followGateButtonText, isActive } = body;
    const nextTriggerType: TriggerType = triggerType !== undefined ? triggerType : existingAutomation.triggerType;
    if (!isValidTriggerType(nextTriggerType)) return NextResponse.json({ success: false, error: "نوع Trigger نامعتبر است" }, { status: 400 });

    const requiresKeyword = nextTriggerType === "COMMENT_KEYWORD" || nextTriggerType === "STORY_REPLY_KEYWORD";
    let nextKeyword: string | null = null;
    if (requiresKeyword) {
      nextKeyword = keyword !== undefined ? normalizeKeywords(keyword) : normalizeKeywords(existingAutomation.keyword);
      if (!nextKeyword) return NextResponse.json({ success: false, error: "حداقل یک Keyword معتبر وارد کنید" }, { status: 400 });
    }

    const nextMediaId = mediaId !== undefined
      ? (typeof mediaId === "string" && mediaId.trim() ? mediaId.trim() : null)
      : existingAutomation.mediaId;

    // Only media-based automations have the duplicate constraint.
    // Multiple DM automations are required for separate Ice Breaker and
    // Persistent Menu entries.
    const isMediaBasedTrigger =
      nextTriggerType === "COMMENT_KEYWORD" ||
      nextTriggerType === "STORY_REPLY_KEYWORD";

    if (isMediaBasedTrigger) {
      const duplicate = await prisma.automation.findFirst({
        where: {
          id: { not: id },
          instagramAccountId: existingAutomation.instagramAccountId,
          triggerType: nextTriggerType,
          mediaId: nextMediaId,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: "Automation مشابه قبلاً وجود دارد",
            data: duplicate,
          },
          { status: 409 },
        );
      }
    }

    const supportsFollowGate = nextTriggerType === "COMMENT_KEYWORD" || nextTriggerType === "STORY_REPLY_KEYWORD";
    const nextRequireFollow = !supportsFollowGate ? false : requireFollow !== undefined ? Boolean(requireFollow) : existingAutomation.requireFollow;
    const nextFollowGateText = !supportsFollowGate || !nextRequireFollow ? null : followGateText !== undefined ? normalizeOptionalString(followGateText) : existingAutomation.followGateText;
    const requestedFollowButtonText = followGateButtonText !== undefined ? normalizeOptionalString(followGateButtonText) : existingAutomation.followGateButtonText;
    const nextFollowGateButtonText = !supportsFollowGate || !nextRequireFollow ? null : requestedFollowButtonText?.slice(0, 20) || "بررسی فالو";
    if (supportsFollowGate && nextRequireFollow && !nextFollowGateText) return NextResponse.json({ success: false, error: "وقتی Follow Gate فعال است، متن درخواست فالو الزامی است" }, { status: 400 });

    let normalizedCommentReply: string | null | undefined = commentReplyText === undefined ? undefined : normalizeOptionalString(commentReplyText);
    if (nextTriggerType === "COMMENT_KEYWORD" && commentReplyVariants !== undefined) {
      try { normalizedCommentReply = storePublicCommentReplies(commentReplyVariants); }
      catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "پاسخ‌های کامنت معتبر نیستند." }, { status: 400 }); }
    }

    const updateData: Record<string, unknown> = {
      ...(triggerType !== undefined ? { triggerType: nextTriggerType } : {}),
      ...(triggerType !== undefined || keyword !== undefined ? { keyword: nextKeyword } : {}),
      ...(mediaId !== undefined ? { mediaId: nextMediaId } : {}),
      ...(likeComment !== undefined ? { likeComment: nextTriggerType === "COMMENT_KEYWORD" ? Boolean(likeComment) : false } : {}),
      ...(normalizedCommentReply !== undefined ? { commentReplyText: nextTriggerType === "COMMENT_KEYWORD" ? normalizedCommentReply : null } : {}),
      ...(sendDm !== undefined ? { sendDm: Boolean(sendDm) } : {}),
      ...(likeIncomingDm !== undefined ? { likeIncomingDm: nextTriggerType === "DM" ? Boolean(likeIncomingDm) : false } : {}),
      ...(likeStoryReply !== undefined ? { likeStoryReply: nextTriggerType === "STORY_REPLY_KEYWORD" ? Boolean(likeStoryReply) : false } : {}),
      ...(replyText !== undefined ? { replyText: normalizeOptionalString(replyText) } : {}),
      requireFollow: nextRequireFollow,
      followGateText: nextFollowGateText,
      followGateButtonText: nextFollowGateButtonText,
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    };

    const automation = await prisma.automation.update({ where: { id }, data: updateData, include: automationInclude });
    try {
      await invalidateAutomationCache(existingAutomation.instagramAccountId);
    } catch (cacheError) {
      console.warn("Automation cache invalidation failed:", cacheError);
    }
    return NextResponse.json({ success: true, data: automation });
  } catch (error) {
    console.error("PATCH /api/automations/[id] error:", error);
    return NextResponse.json({ success: false, error: "خطا در ویرایش Automation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "شناسه Automation الزامی است" }, { status: 400 });
    const automation = await prisma.automation.findFirst({ where: { id, instagramAccount: { userId: session.user.id } } });
    if (!automation) return NextResponse.json({ success: false, error: "Automation پیدا نشد" }, { status: 404 });
    await prisma.instagramPublishJob.updateMany({
      where: {
        OR: [
          { commentAutomationId: id },
          { storyReplyAutomationId: id },
        ],
      },
      data: {
        commentAutomationId: null,
        storyReplyAutomationId: null,
      },
    });
    await prisma.automation.delete({ where: { id } });
    try {
      await invalidateAutomationCache(automation.instagramAccountId);
    } catch (cacheError) {
      console.warn("Automation cache invalidation failed:", cacheError);
    }
    return NextResponse.json({ success: true, message: "Automation با موفقیت حذف شد" });
  } catch (error) {
    console.error("DELETE /api/automations/[id] error:", error);
    return NextResponse.json({ success: false, error: "خطا در حذف Automation" }, { status: 500 });
  }
}
