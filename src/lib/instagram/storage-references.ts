import { prisma } from "@/lib/prisma";

/**
 * Uploaded media may be referenced by automation messages or showcase items
 * before/without being attached to a publishing job. Never delete such files.
 */
export async function isStorageObjectReferenced(input: {
  storageKey: string;
  publicUrl: string | null;
  ignorePublishMediaId?: string;
}) {
  const [publishMedia, automationMessage, showcaseItem, savedResponse, reelCover] = await Promise.all([
    prisma.instagramPublishMedia.findFirst({
      where: {
        storageKey: input.storageKey,
        deletedAt: null,
        ...(input.ignorePublishMediaId ? { id: { not: input.ignorePublishMediaId } } : {}),
      },
      select: { id: true },
    }),
    input.publicUrl
      ? prisma.automationMessage.findFirst({
          where: { mediaUrl: input.publicUrl },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.publicUrl
      ? prisma.showcaseItem.findFirst({
          where: { imageUrl: input.publicUrl },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.publicUrl
      ? prisma.savedAutomationResponse.findFirst({
          where: { mediaUrl: input.publicUrl },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.instagramPublishJob.findFirst({
      where: { status: { in: ["DRAFT", "SCHEDULED", "PROCESSING", "PUBLISHING", "FAILED"] }, reelOptions: { path: ["coverStorageKey"], equals: input.storageKey } },
      select: { id: true },
    }),
  ]);

  return Boolean(publishMedia || automationMessage || showcaseItem || savedResponse || reelCover);
}
