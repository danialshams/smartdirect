import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMonitoringSnapshot } from "@/lib/monitoring/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "احراز هویت انجام نشده است." },
      { status: 401 },
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "دسترسی مجاز نیست." },
      { status: 403 },
    );
  }

  try {
    const data = await getMonitoringSnapshot();

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/admin/monitoring error:", error);

    return NextResponse.json(
      { success: false, message: "دریافت وضعیت Monitoring ناموفق بود." },
      { status: 500 },
    );
  }
}
