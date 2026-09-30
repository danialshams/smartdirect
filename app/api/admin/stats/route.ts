import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const now = new Date();
  const [users, pages, activeSubscriptions, expiredSubscriptions, openTickets] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.instagramAccount.count({ where: { isConnected: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    prisma.subscription.count({ where: { OR: [{ status: "EXPIRED" }, { expiresAt: { lte: now } }] } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } } }),
  ]);

  return NextResponse.json({ users, pages, activeSubscriptions, expiredSubscriptions, openTickets });
}
