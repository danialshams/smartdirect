import { NextRequest, NextResponse } from "next/server";

import { cleanupInstagramPublishStorage } from "@/lib/instagram/publishing-media-cleanup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await cleanupInstagramPublishStorage();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Publishing storage cleanup cron failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Storage cleanup failed.",
      },
      { status: 500 },
    );
  }
}
