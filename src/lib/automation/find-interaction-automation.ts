import { prisma } from "@/lib/prisma";
import { getCachedInstagramMedia } from "@/lib/cache/instagram";
import { matchesSharedMedia, type InboundInteraction } from "./inbound-interactions";

/**
 * Match only active, owner-scoped interaction automations.
 * Never guess the identity of a post from a transient lookaside media URL.
 */
export async function findMatchingInteractionAutomation(accountId: string, interaction: InboundInteraction) {
  const automations = await prisma.automation.findMany({
    where: { instagramAccountId: accountId, triggerType: interaction.kind, isActive: true },
    select: { id:true, mediaId:true, mediaIds:true },
    orderBy: { createdAt: "asc" },
  });
  if (interaction.kind === "STORY_MENTION") return automations[0] ?? null;
  if (!interaction.mediaId && !interaction.shortcode) return null;
  const requirePermalinks = Boolean(interaction.shortcode && !interaction.mediaId);
  const owned = requirePermalinks
    ? await getCachedInstagramMedia(accountId, 50).catch(() => null)
    : null;
  const media = (owned?.data ?? []).map((item:Record<string,unknown>) => ({
    id: String(item.id ?? ""), permalink: typeof item.permalink === "string" ? item.permalink : null,
  }));
  return automations.find(automation => matchesSharedMedia(interaction,
    (automation.mediaIds || automation.mediaId || "").split(",").filter(Boolean), media)) ?? null;
}
