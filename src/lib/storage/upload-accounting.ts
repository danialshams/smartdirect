import { prisma } from "@/lib/prisma";
import { getUnlinkedUploadExpiry } from "@/lib/instagram/publishing-media-cleanup";

const DEFAULT_USER_CAP = 2 * 1024 * 1024 * 1024;
const DEFAULT_OBJECT_COUNT_CAP = 500;

function configuredPositiveInteger(name: string, defaultValue: number) {
  const raw = Number(process.env[name]);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : defaultValue;
}

export function getUploadQuota() {
  return {
    maxBytes: configuredPositiveInteger("STORAGE_MAX_BYTES_PER_USER", DEFAULT_USER_CAP),
    maxObjects: configuredPositiveInteger("STORAGE_MAX_OBJECTS_PER_USER", DEFAULT_OBJECT_COUNT_CAP),
  };
}

/** Serialize reservations per tenant so parallel browser uploads cannot bypass the cap. */
export async function reserveUpload(input: {
  userId: string; storageKey: string; bytes: number; purpose: "AUTOMATION" | "PUBLISHING";
}) {
  if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0) throw new Error("حجم فایل نامعتبر است.");
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE
    `;
    if (!rows.length) throw new Error("کاربر پیدا نشد.");
    const existing = await tx.instagramStorageObject.findUnique({ where: { storageKey: input.storageKey } });
    if (existing) {
      if (existing.userId !== input.userId || existing.deletedAt) throw new Error("کلید فایل متعلق به کاربر نیست.");
      return existing;
    }
    const stats = await tx.instagramStorageObject.aggregate({
      where: { userId: input.userId, deletedAt: null },
      _count: { id: true },
      _sum: { fileSize: true },
    });
    const quota = getUploadQuota();
    if (stats._count.id >= quota.maxObjects || (stats._sum.fileSize ?? BigInt(0)) + BigInt(input.bytes) > BigInt(quota.maxBytes)) {
      throw new Error("سهمیه عمومی فضای ذخیره‌سازی این حساب تکمیل شده است. فایل‌های بدون استفاده را حذف کنید.");
    }
    return tx.instagramStorageObject.create({
      data: {
        userId: input.userId,
        storageKey: input.storageKey,
        fileSize: BigInt(input.bytes),
        purpose: input.purpose,
        expiresAt: getUnlinkedUploadExpiry(),
      },
    });
  });
}

/** Release an unsuccessful reservation. The physical object is deleted separately. */
export async function releaseUploadReservation(userId: string, storageKey: string) {
  await prisma.instagramStorageObject.deleteMany({
    where: { userId, storageKey, publicUrl: null, deletedAt: null },
  });
}
