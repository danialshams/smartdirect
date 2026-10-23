import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadQuota } from "@/lib/storage/upload-accounting";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const [totals, missingSizes] = await Promise.all([
    prisma.instagramStorageObject.aggregate({
      where: { userId: session.user.id, deletedAt: null },
      _sum: { fileSize: true },
      _count: { id: true },
    }),
    prisma.instagramStorageObject.count({
      where: { userId: session.user.id, deletedAt: null, fileSize: BigInt(0) },
    }),
  ]);
  const quota = getUploadQuota();
  return NextResponse.json({
    success: true,
    usedBytes: Number(totals._sum.fileSize ?? BigInt(0)),
    maxBytes: quota.maxBytes,
    fileCount: totals._count.id,
    maxObjects: quota.maxObjects,
    missingSizeRecords: missingSizes,
  });
}
