import { prisma } from "@/lib/prisma";

/**
 * Uploaded media may be referenced by automation messages or showcase items
 * before/without being attached to a publishing job. Never delete such files.
 */
export async function isStorageObjectReferenced(input: {
  storageKey: string;
  publicUrl: string | null;
}) {
  const [publishMedia, automationMessage, showcaseItem] = await Promise.all([
    prisma.instagramPublishMedia.findFirst({
      where: { storageKey: input.storageKey, deletedAt: null },
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
  ]);

  return Boolean(publishMedia || automationMessage || showcaseItem);
}
