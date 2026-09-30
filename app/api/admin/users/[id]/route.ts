import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true,
      instagramAccounts: { select: { id: true, igUsername: true, igUserId: true, isConnected: true, createdAt: true } },
      subscriptions: { orderBy: { createdAt: "desc" }, select: { id: true, planKey: true, status: true, source: true, startedAt: true, expiresAt: true, suspendedAt: true, cancelledAt: true, note: true, autoRenew: true, createdAt: true } },
      tickets: { orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, subject: true, status: true, priority: true, updatedAt: true } },
    },
  });

  if (!user) return NextResponse.json({ message: "کاربر پیدا نشد" }, { status: 404 });
  return NextResponse.json(user);
}
