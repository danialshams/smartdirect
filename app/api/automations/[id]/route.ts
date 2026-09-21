import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

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
const validTriggerTypes = ["COMMENT_KEYWORD", "DM", "STORY_REPLY_KEYWORD"] as const;
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
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "اطلاعات ارسالی نامعتبر است" }, { status: 400 });

    const { triggerType, keyword, mediaId, likeComment, commentReplyText, sendDm, likeIncomingDm, likeStoryReply, replyText, requireFollow, followGateText, isActive } = body;
    const nextTriggerType: TriggerType = triggerType !== undefined ? triggerType : existingAutomation.triggerType;
    if (!isValidTriggerType(nextTriggerType)) return NextResponse.json({ success: false, error: "نوع Trigger نامعتبر است" }, { status: 400 });

    const requiresKeyword = nextTriggerType === "COMMENT_KEYWORD" || nextTriggerType === "STORY_REPLY_KEYWORD";
    let nextKeyword: string | null = null;
    if (requiresKeyword) {
      nextKeyword = keyword !== undefined ? normalizeKeywords(keyword) : normalizeKeywords(existingAutomation.keyword);
      if (!nextKeyword) return NextResponse.json({ success: false, error: "حداقل یک Keyword معتبر وارد کنید" }, { status: 400 });
    }

    const nextMediaId = mediaId !== undefined ? (typeof mediaId === "string" && mediaId.trim() ? mediaId.trim() : null) : existingAutomation.mediaId;
    const duplicate = await prisma.automation.findFirst({ where: { id: { not: id }, instagramAccountId: existingAutomation.instagramAccountId, triggerType: nextTriggerType, keyword: nextKeyword, mediaId: nextMediaId } });
    if (duplicate) return NextResponse.json({ success: false, error: "Automation مشابه قبلاً وجود دارد", data: duplicate }, { status: 409 });

    const supportsFollowGate = nextTriggerType === "COMMENT_KEYWORD" || nextTriggerType === "STORY_REPLY_KEYWORD";
    const nextRequireFollow = !supportsFollowGate ? false : requireFollow !== undefined ? Boolean(requireFollow) : existingAutomation.requireFollow;
    const nextFollowGateText = !supportsFollowGate || !nextRequireFollow ? null : followGateText !== undefined ? normalizeOptionalString(followGateText) : existingAutomation.followGateText;
    if (supportsFollowGate && nextRequireFollow && !nextFollowGateText) return NextResponse.json({ success: false, error: "وقتی Follow Gate فعال است، متن درخواست فالو الزامی است" }, { status: 400 });

    const updateData: Record<string, unknown> = {
      ...(triggerType !== undefined ? { triggerType: nextTriggerType } : {}),
      ...(triggerType !== undefined || keyword !== undefined ? { keyword: nextKeyword } : {}),
      ...(mediaId !== undefined ? { mediaId: nextMediaId } : {}),
      ...(likeComment !== undefined ? { likeComment: nextTriggerType === "COMMENT_KEYWORD" ? Boolean(likeComment) : false } : {}),
      ...(commentReplyText !== undefined ? { commentReplyText: nextTriggerType === "COMMENT_KEYWORD" ? normalizeOptionalString(commentReplyText) : null } : {}),
      ...(sendDm !== undefined ? { sendDm: Boolean(sendDm) } : {}),
      ...(likeIncomingDm !== undefined ? { likeIncomingDm: nextTriggerType === "DM" ? Boolean(likeIncomingDm) : false } : {}),
      ...(likeStoryReply !== undefined ? { likeStoryReply: nextTriggerType === "STORY_REPLY_KEYWORD" ? Boolean(likeStoryReply) : false } : {}),
      ...(replyText !== undefined ? { replyText: normalizeOptionalString(replyText) } : {}),
      requireFollow: nextRequireFollow,
      followGateText: nextFollowGateText,
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    };

    const automation = await prisma.automation.update({ where: { id }, data: updateData, include: automationInclude });
    await invalidateAutomationCache(existingAutomation.instagramAccountId);
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
    await prisma.automation.delete({ where: { id } });
    await invalidateAutomationCache(automation.instagramAccountId);
    return NextResponse.json({ success: true, message: "Automation با موفقیت حذف شد" });
  } catch (error) {
    console.error("DELETE /api/automations/[id] error:", error);
    return NextResponse.json({ success: false, error: "خطا در حذف Automation" }, { status: 500 });
  }
}
