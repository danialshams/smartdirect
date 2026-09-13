import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { processScheduledInstagramJob } from "@/lib/instagram/scheduled-publishing";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - 45_000);

    const jobs = await prisma.instagramPublishJob.findMany({
      where: {
        OR: [
          {
            status: "SCHEDULED",
            scheduledAt: { lte: now },
          },
          {
            status: { in: ["PROCESSING", "PUBLISHING"] },
            lastAttemptAt: {
              lte: leaseCutoff,
            },
          },
        ],
      },
      orderBy: [
        { scheduledAt: "asc" },
        { updatedAt: "asc" },
      ],
      take: 25,
      select: { id: true },
    });

    const results = [];

    for (const job of jobs) {
      const result = await processScheduledInstagramJob(job.id);
      results.push({ id: job.id, ...result });
    }

    return NextResponse.json({
      success: true,
      processed: results.filter((item) => item.processed).length,
      published: results.filter((item) => item.published).length,
      failed: results.filter((item) => Boolean(item.error)).length,
      skipped: results.filter((item) => item.skipped).length,
      results,
    });
  } catch (error) {
    console.error("[Instagram Publishing Cron] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Cron failed",
      },
      { status: 500 },
    );
  }
}
