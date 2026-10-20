import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const parseIds = (mediaId: string | null, mediaIds: string | null) =>
  Array.from(new Set([
    ...(mediaId ? [mediaId] : []),
    ...(mediaIds || "").split(",").map((item) => item.trim()).filter(Boolean),
  ]));

/**
 * Detach ONE Instagram media from an automation, without deleting its reusable
 * response configuration or changing the other media associations.
 */
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const { id } = await params;
    const mediaId = new URL(request.url).searchParams.get("mediaId")?.trim();
    if (!mediaId) {
      return NextResponse.json({ success: false, error: "شناسه محتوای انتخاب‌شده الزامی است." }, { status: 400 });
    }
    const owned = await prisma.automation.findFirst({
      where: { id, instagramAccount: { userId: session.user.id } },
      select: { id: true, instagramAccountId: true, triggerType: true },
    });
    if (!owned || !["COMMENT_KEYWORD", "STORY_REPLY_KEYWORD"].includes(owned.triggerType)) {
      return NextResponse.json({ success: false, error: "پاسخ خودکار پیدا نشد." }, { status: 404 });
    }

    const changed = await prisma.$transaction(async (tx) => {
      const automation = await tx.automation.findUnique({
        where: { id: owned.id },
        select: { id: true, mediaId: true, mediaIds: true, instagramAccountId: true, triggerType: true },
      });
      if (!automation) return false;
      const current = parseIds(automation.mediaId, automation.mediaIds);
      if (!current.includes(mediaId)) return false;

      const remaining = current.filter((item) => item !== mediaId);
      await tx.automation.update({
        where: { id: automation.id },
        data: {
          mediaId: remaining.length === 1 ? remaining[0] : null,
          mediaIds: remaining.length ? remaining.join(",") : null,
        },
      });

      // A published post may also point at this response through its publishing job.
      // Clear only that media's link; never delete shared messages, forms or settings.
      if (automation.triggerType === "COMMENT_KEYWORD") {
        await tx.instagramPublishJob.updateMany({
          where: { instagramAccountId: automation.instagramAccountId, instagramMediaId: mediaId, commentAutomationId: automation.id },
          data: {
            commentAutomationId: null,
            commentTriggerKeywords: null,
            commentTriggerResponse: null,
          },
        });
      } else {
        await tx.instagramPublishJob.updateMany({
          where: { instagramAccountId: automation.instagramAccountId, instagramMediaId: mediaId, storyReplyAutomationId: automation.id },
          data: {
            storyReplyAutomationId: null,
            storyReplyTriggerKeywords: null,
            storyReplyTriggerResponse: null,
          },
        });
      }
      return true;
    }, { maxWait: 10000, timeout: 15000 });

    if (!changed) {
      return NextResponse.json({ success: false, error: "این محتوا دیگر به پاسخ انتخاب‌شده متصل نیست." }, { status: 409 });
    }
    try { await invalidateAutomationCache(owned.instagramAccountId); }
    catch (error) { console.warn("Could not invalidate detached automation cache:", error); }

    return NextResponse.json({
      success: true,
      message: "اتصال پاسخ خودکار به این محتوا حذف شد؛ پاسخ و سایر اتصال‌ها محفوظ هستند.",
    });
  } catch (error) {
    console.error("DELETE automation media link error:", error);
    return NextResponse.json({ success: false, error: "حذف اتصال محتوا ناموفق بود." }, { status: 500 });
  }
}
