import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { publishInstagramJob } from "@/lib/instagram/publishing";

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
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const now = new Date();

    const jobs = await prisma.instagramPublishJob.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          lte: now,
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      take: 10,
      select: {
        id: true,
      },
    });

    const results: Array<{
      id: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const job of jobs) {
      try {
        await prisma.instagramPublishJob.updateMany({
          where: {
            id: job.id,
            status: "SCHEDULED",
          },
          data: {
            status: "UPLOADING",
            lastAttemptAt: new Date(),
          },
        });

        await publishInstagramJob(job.id);

        results.push({
          id: job.id,
          success: true,
        });
      } catch (error) {
        results.push({
          id: job.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      successful: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
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
