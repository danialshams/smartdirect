import { prisma } from "@/lib/prisma";

/** Only a template owned by the same user and Instagram account can be reused.
 * Undefined means the caller did not request any lineage change.
 */
export async function validateSavedResponseOrigin(
  value: unknown, instagramAccountId: string, userId: string,
): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim())
    throw new Error("شناسه پاسخ ذخیره‌شده معتبر نیست.");
  const id = value.trim();
  const template = await prisma.savedAutomationResponse.findFirst({
    where: { id, instagramAccountId, userId },
    select: { id: true },
  });
  if (!template) throw new Error("این پاسخ ذخیره‌شده متعلق به پیج شما نیست یا حذف شده است.");
  return id;
}
