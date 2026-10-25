import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

const LIVE_SENTINEL = "__smartdirect_live_comments_v1__";

/** Rules without a session are armed for the next broadcast.
 * Once a Live is observed, remember its ID. An ended broadcast disarms its rules.
 * Never infer that a broadcast ended from a failed Meta request.
 */
export async function synchronizeLiveReplySessions(accountId: string, activeIds: string[]) {
  const ids = new Set(activeIds.filter(Boolean));
  const rules = await prisma.automation.findMany({
    where: { instagramAccountId: accountId, triggerType: "COMMENT_KEYWORD",
      mediaId: LIVE_SENTINEL, isActive: true },
    select: { id: true, mediaIds: true },
  });
  let changed = false;
  for (const rule of rules) {
    if (rule.mediaIds) {
      if (ids.has(rule.mediaIds)) continue;
      const result = await prisma.automation.updateMany({
        where: { id: rule.id, isActive: true, mediaIds: rule.mediaIds },
        data: { isActive: false },
      });
      changed = changed || result.count > 0;
    } else if (ids.size) {
      const current = ids.values().next().value;
      if (!current) continue;
      const result = await prisma.automation.updateMany({
        where: { id: rule.id, isActive: true, mediaIds: null },
        data: { mediaIds: current },
      });
      changed = changed || result.count > 0;
    }
  }
  if (changed) await invalidateAutomationCache(accountId);
  return changed;
}

/** Graph /live_media returns active broadcasts; failure must not modify activation. */
export async function pollLiveReplySessions(account: { id: string; igUserId: string }) {
  const token = await getValidInstagramAccessToken(account.id);
  const response = await instagramApiRequest<{data?: Array<{id?:string}>}>(
    "/" + encodeURIComponent(account.igUserId) + "/live_media",
    { accessToken: token, params: { fields: "id", limit: 20 },
      rateLimit: { instagramAccountId: account.id, operation: "PROFILE_READ" } },
  );
  if (!Array.isArray(response.data)) throw new Error("Instagram did not provide active Live data");
  return synchronizeLiveReplySessions(account.id, response.data.map(item => item.id||""));
}
