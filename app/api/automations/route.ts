import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storePublicCommentReplies } from "@/lib/automation/comment-reply-variants";
import { getCachedInstagramMedia, invalidateAutomationCache } from "@/lib/cache/instagram";

function normalizePersianDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeKeyword(value: string) {
  return normalizePersianDigits(value).trim().toLowerCase();
}

function normalizeKeywords(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const keywords = value
    .split(/[\n,،;؛]+/)
    .map(normalizeKeyword)
    .filter(Boolean)
    .filter((keyword, index, list) => list.indexOf(keyword) === index);

  return keywords.length ? keywords.join(",") : null;
}

const validTriggerTypes = ["COMMENT_KEYWORD", "DM", "STORY_REPLY_KEYWORD"] as const;
type TriggerType = (typeof validTriggerTypes)[number];

function isValidTriggerType(value: unknown): value is TriggerType {
  return typeof value === "string" && validTriggerTypes.includes(value as TriggerType);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const instagramAccountId = searchParams.get("instagramAccountId");
    if (!instagramAccountId) return NextResponse.json({ success: false, error: "instagramAccountId الزامی است" }, { status: 400 });

    const instagramAccount = await prisma.instagramAccount.findFirst({
      where: { id: instagramAccountId, userId: session.user.id },
    });
    if (!instagramAccount) return NextResponse.json({ success: false, error: "اکانت اینستاگرام پیدا نشد" }, { status: 404 });

    const automations = await prisma.automation.findMany({
      where: { instagramAccountId },
      include: {
        messages: {
          orderBy: { order: "asc" },
          include: {
            quickReplies: {
              orderBy: { createdAt: "asc" },
              include: { nextMessage: { select: { id: true, messageType: true, text: true, mediaUrl: true, mediaId: true, showcaseId: true, formId: true, order: true } } },
            },
            showcase: { include: { items: { where: { isActive: true }, orderBy: { order: "asc" } } } },
            form: { include: { fields: { orderBy: { order: "asc" } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: automations });
  } catch (error) {
    console.error("GET /api/automations error:", error);
    return NextResponse.json({ success: false, error: "خطا در دریافت Automation ها" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });

    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "اطلاعات ارسالی نامعتبر است" }, { status: 400 });

    const {
      instagramAccountId,
      title,
      triggerType = "COMMENT_KEYWORD",
      keyword,
      keywordMatchMode = "EXACT",
      mediaId,
      mediaIds,
      likeComment = false,
      commentReplyText,
      commentReplyVariants,
      sendDm = false,
      likeIncomingDm = false,
      likeStoryReply = false,
      replyText,
      requireFollow = false,
      followGateText,
      followGateButtonText,
      isActive = true,
    } = body;

    if (typeof instagramAccountId !== "string" || !instagramAccountId.trim()) return NextResponse.json({ success: false, error: "instagramAccountId الزامی است" }, { status: 400 });
    if (!isValidTriggerType(triggerType)) return NextResponse.json({ success: false, error: "نوع Trigger نامعتبر است" }, { status: 400 });

    const instagramAccount = await prisma.instagramAccount.findFirst({ where: { id: instagramAccountId, userId: session.user.id } });
    if (!instagramAccount) return NextResponse.json({ success: false, error: "اکانت Instagram متعلق به این کاربر نیست" }, { status: 403 });

    const requiresKeyword = triggerType === "COMMENT_KEYWORD" || triggerType === "STORY_REPLY_KEYWORD";
    const normalizedKeywordMatchMode = triggerType === "COMMENT_KEYWORD" && keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT";
    const normalizedKeyword = requiresKeyword && normalizedKeywordMatchMode !== "CONTAINS_ANY" ? normalizeKeywords(keyword) : null;
    if (requiresKeyword && normalizedKeywordMatchMode !== "CONTAINS_ANY" && !normalizedKeyword) return NextResponse.json({ success: false, error: "حداقل یک کلمه کلیدی معتبر وارد کنید" }, { status: 400 });
    if (normalizedKeyword && normalizedKeyword.split(",").filter(Boolean).length > 10) return NextResponse.json({ success: false, error: "حداکثر ۱۰ کلمه کلیدی مجاز است." }, { status: 400 });

    const normalizedMediaId = typeof mediaId === "string" && mediaId.trim() ? mediaId.trim() : null;
    const normalizedMediaIds = Array.isArray(mediaIds)
      ? [...new Set(mediaIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0).map((id: string) => id.trim()))]
      : [];
    if (normalizedMediaIds.length > 0 && triggerType === "COMMENT_KEYWORD") {
      const mediaResult = await getCachedInstagramMedia(instagramAccount.id, 50);
      if (!mediaResult) return NextResponse.json({ success: false, error: "دریافت رسانه‌های اینستاگرام برای اعتبارسنجی انتخاب‌ها ناموفق بود." }, { status: 502 });
      const availableIds = new Set((mediaResult.data ?? []).map((item: Record<string, unknown>) => String(item.id ?? "")));
      if (normalizedMediaIds.some((id) => !availableIds.has(id))) return NextResponse.json({ success: false, error: "یکی از پست‌های انتخاب‌شده متعلق به این اکانت نیست یا دیگر در دسترس نیست. فهرست محتوا را تازه‌سازی کنید." }, { status: 400 });
    }
    const supportsFollowGate = triggerType === "COMMENT_KEYWORD" || triggerType === "STORY_REPLY_KEYWORD";
    const normalizedRequireFollow = supportsFollowGate ? Boolean(requireFollow) : false;
    const normalizedFollowGateText = supportsFollowGate && normalizedRequireFollow && typeof followGateText === "string" && followGateText.trim() ? followGateText.trim() : null;
    const normalizedFollowGateButtonText = supportsFollowGate && normalizedRequireFollow && typeof followGateButtonText === "string" && followGateButtonText.trim() ? followGateButtonText.trim().slice(0, 20) : (supportsFollowGate && normalizedRequireFollow ? "بررسی فالو" : null);

    if (supportsFollowGate && normalizedRequireFollow && !normalizedFollowGateText) return NextResponse.json({ success: false, error: "وقتی Follow Gate فعال است، متن درخواست فالو الزامی است" }, { status: 400 });

    // Comment/Story automations are unique per media. DM automations are
    // intentionally allowed to coexist because Ice Breakers and Persistent
    // Menu items each need their own hidden DM automation.
    const isMediaBasedTrigger = triggerType === "COMMENT_KEYWORD";

    if (isMediaBasedTrigger) {
      const existingAutomations = await prisma.automation.findMany({
        where: { instagramAccountId, triggerType },
        select: { id: true, mediaId: true, mediaIds: true },
      });
      const requestedIds = normalizedMediaIds.length > 0 ? normalizedMediaIds : normalizedMediaId ? [normalizedMediaId] : [];
      const requestedAll = requestedIds.length === 0;
      const duplicate = existingAutomations.find((existing) => {
        const existingIds = existing.mediaIds ? existing.mediaIds.split(",").filter(Boolean) : existing.mediaId ? [existing.mediaId] : [];
        // Templates without any linked media are kept for reuse and must not
        // block new replies on unrelated content.
        if (existingIds.length === 0) return false;
        return requestedAll || requestedIds.some((id) => existingIds.includes(id));
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

    let normalizedCommentReply = typeof commentReplyText === "string" && commentReplyText.trim() ? commentReplyText.trim() : null;
    if (triggerType === "COMMENT_KEYWORD" && commentReplyVariants !== undefined) {
      try { normalizedCommentReply = storePublicCommentReplies(commentReplyVariants); }
      catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "پاسخ‌های کامنت معتبر نیستند." }, { status: 400 }); }
    }

    if (title !== undefined && (typeof title !== "string" || title.trim().length > 80)) return NextResponse.json({ success: false, error: "نام پاسخ حداکثر ۸۰ نویسه است." }, { status: 400 });

    const automation = await prisma.automation.create({
      data: {
        instagramAccountId,
        title: typeof title === "string" ? title.trim() || null : null,
        triggerType,
        keyword: normalizedKeyword,
        keywordMatchMode: normalizedKeywordMatchMode,
        mediaIds: normalizedMediaIds.join(",") || null,
        mediaId: normalizedMediaId,
        likeComment: triggerType === "COMMENT_KEYWORD" ? Boolean(likeComment) : false,
        commentReplyText: triggerType === "COMMENT_KEYWORD" ? normalizedCommentReply : null,
        sendDm: Boolean(sendDm),
        likeIncomingDm: triggerType === "DM" ? Boolean(likeIncomingDm) : false,
        likeStoryReply: triggerType === "STORY_REPLY_KEYWORD" ? Boolean(likeStoryReply) : false,
        replyText: typeof replyText === "string" && replyText.trim() ? replyText.trim() : null,
        requireFollow: normalizedRequireFollow,
        followGateText: normalizedFollowGateText,
        followGateButtonText: normalizedFollowGateButtonText,
        isActive: Boolean(isActive),
      },
      include: { messages: { orderBy: { order: "asc" } } },
    });

    try {
      await invalidateAutomationCache(instagramAccountId);
    } catch (cacheError) {
      console.warn("Automation cache invalidation failed:", cacheError);
    }
    return NextResponse.json({ success: true, data: automation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/automations error:", error);
    return NextResponse.json({ success: false, error: "خطا در ساخت Automation" }, { status: 500 });
  }
}
