import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFailedJobs, getRecoveryHealth } from "@/lib/queue/recovery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    const [jobs, health] = await Promise.all([
      getFailedJobs(Number.isFinite(limit) ? limit : 100),
      getRecoveryHealth(),
    ]);

    return NextResponse.json({
      success: true,
      data: jobs,
      health,
    });
  } catch (error) {
    console.error("GET /api/admin/queue/failed error:", error);
    return NextResponse.json({ success: false, message: "دریافت Failed Jobs ناموفق بود." }, { status: 500 });
  }
}
