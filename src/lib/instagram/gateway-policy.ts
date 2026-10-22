import { createHash } from "node:crypto";
import type { InstagramRateLimitContext, InstagramRateLimitOperation } from "@/lib/instagram/rate-limit";

/** Every authenticated call must use shared Redis traffic control.
 * Unknown legacy calls use a stable hashed-token account scope. Callers
 * should explicitly provide the real Instagram account ID when available. */
export function resolveInstagramTrafficContext(
  method: string,
  path: string,
  accessToken?: string,
  explicit?: InstagramRateLimitContext,
): InstagramRateLimitContext | undefined {
  if (explicit) return explicit;
  if (!accessToken?.trim()) return undefined;
  const p = path.toLowerCase();
  let operation: InstagramRateLimitOperation = "PROFILE_READ";
  if (method.toUpperCase() === "GET") {
    if (p.includes("/insights")) operation = "INSIGHTS_READ";
    else if (p.includes("/comments") || p.includes("/conversations")) operation = "CONVERSATION_READ";
    else if (p.includes("/media")) operation = "MEDIA_READ";
  } else if (p.includes("/replies")) {
    operation = "COMMENT_REPLY";
  } else if (p.includes("/messages")) {
    operation = "MESSAGE_TEXT";
  } else if (p.includes("/media")) {
    operation = "PUBLISH_MEDIA";
  }
  return {
    instagramAccountId: "token:" + createHash("sha256").update(accessToken).digest("hex").slice(0, 32),
    operation,
  };
}
