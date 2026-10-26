import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const where = { sender: { role: "USER" as const }, readAt: null };
  const [unreadCount, recent] = await Promise.all([
    prisma.ticketMessage.count({ where }),
    prisma.ticketMessage.findFirst({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, ticketId: true, body: true, createdAt: true, ticket: { select: { subject: true, user: { select: { name: true } } } } } })
  ]);
  return NextResponse.json({ unreadCount, latest: recent && { id: recent.id, ticketId: recent.ticketId, subject: recent.ticket.subject, name: recent.ticket.user.name, body: recent.body.slice(0, 120), createdAt: recent.createdAt } }, { headers: { "Cache-Control": "private, no-store" } });
}
