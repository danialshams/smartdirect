import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(); if (guard.response) return guard.response;
  const { id } = await context.params;
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ message: "تیکت پیدا نشد" }, { status: 404 });
  await prisma.ticketMessage.updateMany({ where: { ticketId: id, sender: { role: "USER" }, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ success: true });
}
