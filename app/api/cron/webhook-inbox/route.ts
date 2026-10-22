import { NextRequest, NextResponse } from "next/server";
import { recoverWebhookInbox, webhookInboxHealth } from "@/lib/webhook/durable-inbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Portable cron fallback; for fast recovery on VPS run the dedicated Worker.
 * Protected by CRON_SECRET and safe for repeated/concurrent calls. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await recoverWebhookInbox(50);
    const metrics = await webhookInboxHealth();
    return NextResponse.json({ success: true, ...results, metrics }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[WEBHOOK_INBOX] recovery failed", error);
    return NextResponse.json({ success: false, error: "Webhook recovery failed" }, { status: 503 });
  }
}
