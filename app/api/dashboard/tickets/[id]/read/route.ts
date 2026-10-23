import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const { id } = await context.params;
  const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ message: "درخواست پیدا نشد." }, { status: 404 });
  const updated = await prisma.ticketMessage.updateMany({
    where: { ticketId: id, ticket: { userId: session.user.id }, senderUserId: { not: session.user.id }, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ success: true, updated: updated.count }, { headers: { "Cache-Control": "private, no-store" } });
}