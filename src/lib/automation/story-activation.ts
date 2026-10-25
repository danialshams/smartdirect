import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

/** Serializes active-story changes per IG account; old rule remains until the
 * full new response is persisted and activation succeeds. */
export async function activateStoryReply(automationId: string, instagramAccountId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM "InstagramAccount" WHERE id = $1 FOR UPDATE', instagramAccountId);
    const target = await tx.automation.findFirst({
      where: { id: automationId, instagramAccountId, triggerType: "STORY_REPLY_KEYWORD" },
      select: { id: true },
    });
    if (!target) throw new Error("پاسخ استوری پیدا نشد.");
    await tx.automation.updateMany({
      where: { instagramAccountId, triggerType: "STORY_REPLY_KEYWORD",
        isActive: true, id: { not: automationId } },
      data: { isActive: false },
    });
    await tx.automation.update({ where: { id: automationId }, data: { isActive: true } });
  }, { maxWait: 10000, timeout: 30000 });
  try { await invalidateAutomationCache(instagramAccountId); }
  catch (error) { console.warn("[STORY_REPLY] Cache invalidation failed after activation", error); }
}
