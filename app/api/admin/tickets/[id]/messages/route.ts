import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const message = String(body.body ?? "").trim();
  if (!message) return NextResponse.json({ message: "متن پاسخ الزامی است" }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ message: "تیکت پیدا نشد" }, { status: 404 });

  const created = await prisma.ticketMessage.create({ data: { ticketId: id, senderUserId: guard.session!.user.id, body: message } });
  await prisma.ticket.update({ where: { id }, data: { status: "WAITING_USER" } });
  await writeAdminAudit({ actorUserId: guard.session!.user.id, action: "ticket.reply", targetType: "Ticket", targetId: id });
  return NextResponse.json(created, { status: 201 });
}
