import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const where = { sender: { role: "USER" as const }, readAt: null };
  const [unreadCount, recentItems] = await Promise.all([
    prisma.ticketMessage.count({ where }),
    prisma.ticketMessage.findMany({ where, take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, ticketId: true, body: true, createdAt: true, ticket: { select: { subject: true, user: { select: { name: true } } } } } })
  ]);
  const items = recentItems.map(item => ({ id: item.id, ticketId: item.ticketId, subject: item.ticket.subject, name: item.ticket.user.name || "کاربر", body: item.body.slice(0, 120), createdAt: item.createdAt }));
  return NextResponse.json({ unreadCount, latest: items[0] || null, items }, { headers: { "Cache-Control": "private, no-store" } });
}
