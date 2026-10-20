import { getInstagramMessagingWindow } from "@/lib/instagram/messaging-window";

export const SMART_REMINDER_WINDOW_SAFETY_MS = 5 * 60_000;

export function reminderWindowValidAt(lastInboundAt: Date | null, at: Date): boolean {
  // Human-agent exceptions are intentionally not available to automations.
  const window = getInstagramMessagingWindow(lastInboundAt, at);
  return window.mode === "STANDARD" && window.remainingMs > SMART_REMINDER_WINDOW_SAFETY_MS;
}

export function reminderBlockReason(input: {
  anchorAt: Date | null;
  lastInboundAt: Date | null;
  latestOutboundMatches: boolean;
  now: Date;
}): string | null {
  if (!input.anchorAt || !input.lastInboundAt ||
      input.lastInboundAt > input.anchorAt || !input.latestOutboundMatches)
    return "CONVERSATION_CHANGED";
  if (!reminderWindowValidAt(input.lastInboundAt, input.now))
    return "INSTAGRAM_24H_WINDOW_CLOSED";
  return null;
}
