import { NextRequest, NextResponse } from "next/server";
import { recoverDueSmartReminders } from "@/lib/automation/smart-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Portable HTTPS fallback for serverless test deployments.
 * The Redis Worker remains the precise scheduler for production/VPS.
 * Invoke with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await recoverDueSmartReminders(20);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SMART_REMINDER] cron fallback failed", error);
    return NextResponse.json({ success: false, error: "Reminder recovery failed" }, { status: 500 });
  }
}
