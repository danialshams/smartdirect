import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueInstagramPublishing } from "@/lib/instagram/publishing-queue";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const { id } = await context.params;
    const job = await prisma.instagramPublishJob.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!job) {
      return NextResponse.json({ success: false, message: "Publishing Job پیدا نشد." }, { status: 404 });
    }

    if (job.status !== "FAILED") {
      return NextResponse.json({ success: false, message: "فقط Jobهای Failed قابل Retry هستند." }, { status: 409 });
    }

    await prisma.instagramPublishJob.update({
      where: { id },
      data: { status: "PROCESSING", errorMessage: null, lastAttemptAt: new Date() },
    });

    try {
      const queued = await enqueueInstagramPublishing(id, { maxAttempts: 4 });
      return NextResponse.json({
        success: true,
        queued: true,
        queueJobId: queued.job.id,
      }, { status: 202 });
    } catch (error) {
      await prisma.instagramPublishJob.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "قرار دادن Retry در صف ناموفق بود.",
          retryCount: { increment: 1 },
        },
      });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "قرار دادن Retry در صف ناموفق بود.",
      }, { status: 502 });
    }
  } catch (error) {
    console.error("POST /api/instagram/publishing/[id]/retry error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "خطای داخلی هنگام Retry.",
    }, { status: 500 });
  }
}
