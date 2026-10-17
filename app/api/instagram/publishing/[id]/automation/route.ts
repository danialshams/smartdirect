import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "شناسه محتوا الزامی است." }, { status: 400 });
    }

    const job = await prisma.instagramPublishJob.findFirst({
      where: { id, userId: session.user.id, status: "PUBLISHED" },
      select: {
        id: true,
        instagramAccountId: true,
        commentAutomationId: true,
        storyReplyAutomationId: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, message: "محتوای منتشرشده پیدا نشد یا متعلق به شما نیست." },
        { status: 404 },
      );
    }

    const linkedAutomationIds = [job.commentAutomationId, job.storyReplyAutomationId].filter(
      (value): value is string => Boolean(value),
    );

    await prisma.$transaction(async (tx) => {
      // Remove only the reply rule/configuration. The published Instagram media stays untouched.
      await tx.instagramPublishJob.update({
        where: { id: job.id },
        data: {
          commentAutomationId: null,
          storyReplyAutomationId: null,
          commentTriggerKeywords: null,
          commentTriggerResponse: null,
          storyReplyTriggerKeywords: null,
          storyReplyTriggerResponse: null,
        },
      });

      if (linkedAutomationIds.length) {
        await tx.automation.deleteMany({
          where: {
            id: { in: linkedAutomationIds },
            instagramAccountId: job.instagramAccountId,
          },
        });
      }
    });

    try {
      await invalidateAutomationCache(job.instagramAccountId);
    } catch (cacheError) {
      console.warn("Automation cache invalidation failed:", cacheError);
    }

    return NextResponse.json({
      success: true,
      message: "قانون پاسخ خودکار حذف شد؛ محتوای منتشرشده در اینستاگرام باقی می‌ماند.",
    });
  } catch (error) {
    console.error("DELETE /api/instagram/publishing/[id]/automation error:", error);
    return NextResponse.json(
      { success: false, message: "حذف قانون پاسخ خودکار ناموفق بود." },
      { status: 500 },
    );
  }
}
