import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";

// Both app-level Webhooks > Instagram > live_comments and account subscription
// must be enabled. Never overwrite other subscribed fields.
export async function ensureLiveCommentSubscription(instagramAccountId: string) {
  const token = await getValidInstagramAccessToken(instagramAccountId);
  const current = await instagramApiRequest<{
    data?: Array<{ subscribed_fields?: string[] }>;
  }>("/me/subscribed_apps", { accessToken: token, maxRetries: 1 });
  const fields = new Set<string>(["live_comments","comments","messages","messaging_postbacks"]);
  for (const item of current.data ?? []) {
    for (const field of item.subscribed_fields ?? []) fields.add(field);
  }
  if ((current.data ?? []).some((item) => item.subscribed_fields?.includes("live_comments"))) return;
  const form = new URLSearchParams({ subscribed_fields: [...fields].join(",") });
  const response = await fetch("https://graph.instagram.com/v26.0/me/subscribed_apps", {
    method: "POST", cache: "no-store",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) throw new Error("فعال‌سازی Webhook کامنت‌های لایو در متا انجام نشد. تنظیمات Webhooks و مجوزهای پیج را بررسی کنید.");
}
