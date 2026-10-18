import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const { id } = await params;
    const saved = await prisma.savedAutomationResponse.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!saved) {
      return NextResponse.json({ success: false, error: "پاسخ ذخیره‌شده پیدا نشد." }, { status: 404 });
    }

    await prisma.savedAutomationResponse.delete({ where: { id: saved.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/saved-responses/[id] error:", error);
    return NextResponse.json({ success: false, error: "حذف پاسخ ذخیره‌شده ناموفق بود." }, { status: 500 });
  }
}
