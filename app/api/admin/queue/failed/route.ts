import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFailedJobs, getRecoveryHealth } from "@/lib/queue/recovery";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "دسترسی مجاز نیست." }, { status: 403 });
  }

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
