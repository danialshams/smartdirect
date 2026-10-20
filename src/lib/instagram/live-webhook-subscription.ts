import { instagramApiRequest } from "@/lib/instagram/client";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

type SubscriptionData = { data?: Array<{ subscribed_fields?: string[] }>; success?: boolean };
export type LiveSubscriptionStatus = { subscribed: boolean; fields: string[]; error?: string };

export async function getLiveSubscription(instagramAccountId: string): Promise<LiveSubscriptionStatus> {
  try {
    const token = await getValidInstagramAccessToken(instagramAccountId);
    const response = await instagramApiRequest<SubscriptionData>("/me/subscribed_apps", {
      accessToken: token, timeoutMs: 15_000,
      rateLimit: { instagramAccountId, operation: "PROFILE_READ" },
    });
    const fields = Array.from(new Set((response.data ?? []).flatMap(row => row.subscribed_fields ?? [])));
    return { subscribed: fields.includes("live_comments"), fields };
  } catch (error) {
    return { subscribed: false, fields: [], error: error instanceof Error ? error.message : "دریافت اشتراک وبهوک ناموفق بود." };
  }
}

export async function subscribeLiveComments(instagramAccountId: string): Promise<LiveSubscriptionStatus> {
  const previous = await getLiveSubscription(instagramAccountId);
  if (previous.subscribed) return previous;
  // Preserve existing messaging, story, and comment fields when enabling Live.
  // If the existing subscription cannot be read, refuse to overwrite it.
  if (previous.error) return previous;
  const required = ["live_comments", "comments", "messages", "messaging_postbacks", "messaging_seen"];
  const fields = [...new Set([...previous.fields, ...required])];
  try {
    const token = await getValidInstagramAccessToken(instagramAccountId);
    const result = await instagramApiRequest<{ success?: boolean }>("/me/subscribed_apps", {
      method: "POST", accessToken: token,
      params: { subscribed_fields: fields.join(",") },
      timeoutMs: 15_000,
      rateLimit: { instagramAccountId, operation: "PROFILE_READ" },
    });
    if (result.success === false) throw new Error("Meta اشتراک live_comments را تأیید نکرد.");
    return { subscribed: true, fields };
  } catch (error) {
    return { subscribed: false, fields: previous.fields, error: error instanceof Error ? error.message : "اشتراک وبهوک لایو ناموفق بود." };
  }
}
