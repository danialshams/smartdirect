import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const { id } = await params;
    const triggerType = new URL(request.url).searchParams.get("triggerType");
    if (triggerType && triggerType !== "COMMENT_KEYWORD" && triggerType !== "STORY_REPLY_KEYWORD") {
      return NextResponse.json({ success: false, message: "نوع پاسخ خودکار نامعتبر است." }, { status: 400 });
    }
    if (!id) return NextResponse.json({ success: false, message: "شناسه محتوا الزامی است." }, { status: 400 });

    const job = await prisma.instagramPublishJob.findFirst({
      where: { id, userId: session.user.id, status: "PUBLISHED" },
      select: {
        id: true, instagramAccountId: true, instagramMediaId: true,
        commentAutomationId: true, storyReplyAutomationId: true,
      },
    });
    if (!job) {
      return NextResponse.json(
        { success: false, message: "محتوای منتشرشده پیدا نشد یا متعلق به شما نیست." },
        { status: 404 },
      );
    }

    const removeComment = !triggerType || triggerType === "COMMENT_KEYWORD";
    const removeStory = !triggerType || triggerType === "STORY_REPLY_KEYWORD";
    const linkedIds = Array.from(new Set([
      ...(removeComment && job.commentAutomationId ? [job.commentAutomationId] : []),
      ...(removeStory && job.storyReplyAutomationId ? [job.storyReplyAutomationId] : []),
    ]));

    await prisma.$transaction(async (tx) => {
      // Clear only this job's selected reply type, not the other type or the
      // underlying Instagram content. Do not delete reusable automations.
      await tx.instagramPublishJob.update({
        where: { id: job.id },
        data: {
          ...(removeComment ? {
            commentAutomationId: null,
            commentTriggerKeywords: null,
            commentTriggerResponse: null,
          } : {}),
          ...(removeStory ? {
            storyReplyAutomationId: null,
            storyReplyTriggerKeywords: null,
            storyReplyTriggerResponse: null,
          } : {}),
        },
      });
      for (const linkedId of linkedIds) {
        const automation = await tx.automation.findFirst({
          where: { id: linkedId, instagramAccountId: job.instagramAccountId },
          select: { id: true, mediaId: true, mediaIds: true },
        });
        if (!automation || !job.instagramMediaId) continue;
        // Story keyword rules apply to all stories. Removing a published
        // job's association must never modify the account-wide rule.
        if (linkedId === job.storyReplyAutomationId) continue;
        const current = Array.from(new Set([
          ...(automation.mediaId ? [automation.mediaId] : []),
          ...(automation.mediaIds || "").split(",").map((value) => value.trim()).filter(Boolean),
        ]));
        if (!current.includes(job.instagramMediaId)) continue;
        const remaining = current.filter((value) => value !== job.instagramMediaId);
        await tx.automation.update({
          where: { id: automation.id },
          data: {
            mediaId: remaining.length === 1 ? remaining[0] : null,
            mediaIds: remaining.length ? remaining.join(",") : null,
          },
        });
      }
    }, { maxWait: 10000, timeout: 15000 });

    try { await invalidateAutomationCache(job.instagramAccountId); }
    catch (cacheError) { console.warn("Automation cache invalidation failed:", cacheError); }

    return NextResponse.json({
      success: true,
      message: "پاسخ این محتوا غیرفعال شد و تنظیمات پاسخ‌های دیگر حفظ شدند.",
    });
  } catch (error) {
    console.error("DELETE /api/instagram/publishing/[id]/automation error:", error);
    return NextResponse.json({ success: false, message: "حذف پاسخ این محتوا ناموفق بود." }, { status: 500 });
  }
}
