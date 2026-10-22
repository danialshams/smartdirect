import { NextRequest, NextResponse } from "next/server";
import { recoverWebhookInbox, webhookInboxHealth } from "@/lib/webhook/durable-inbox";
import { getLatencyPercentiles, getFailureCount } from "@/lib/observability/metrics";
import { observabilityLogger } from "@/lib/observability/logger";

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
    const [ackLatency, replyLatency, dispatchFailures] = await Promise.all([
      getLatencyPercentiles("webhook"),
      getLatencyPercentiles("webhook_end_to_end"),
      getFailureCount("webhook_dispatch", "retryable"),
    ]);
    const maxAgeMs = Math.max(60_000, Number(process.env.WEBHOOK_INBOX_ALERT_AGE_MS ?? 5 * 60_000));
    const maxPending = Math.max(1, Number(process.env.WEBHOOK_INBOX_ALERT_PENDING ?? 1000));
    const degraded = metrics.oldestPendingAgeMs > maxAgeMs || metrics.pending > maxPending;
    if (degraded) {
      observabilityLogger.warn("webhook_inbox_backlog_alert", { ...metrics, maxAgeMs, maxPending });
    }
    return NextResponse.json({
      success: true, degraded, ...results, metrics, dispatchFailures,
      latency: { webhookAck: ackLatency, endToEnd: replyLatency },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WEBHOOK_INBOX] recovery failed", error);
    return NextResponse.json({ success: false, error: "Webhook recovery failed" }, { status: 503 });
  }
}
