import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getMonitoringSnapshot } from "@/lib/monitoring/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

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
