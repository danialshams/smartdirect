import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, subject: true, status: true, priority: true, createdAt: true, updatedAt: true, closedAt: true, user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true, senderUserId: true, sender: { select: { name: true, role: true } } } } },
  });
  if (!ticket) return NextResponse.json({ message: "تیکت پیدا نشد" }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const current = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!current) return NextResponse.json({ message: "تیکت پیدا نشد" }, { status: 404 });
  const status = String(body.status ?? "");
  const priority = String(body.priority ?? "");
  const updated = await prisma.ticket.update({ where: { id }, data: { ...(status ? { status: status as never } : {}), ...(priority ? { priority: priority as never } : {}), ...(status === "CLOSED" || status === "RESOLVED" ? { closedAt: new Date() } : {}) } });
  await writeAdminAudit({ actorUserId: guard.session!.user.id, action: "ticket.update", targetType: "Ticket", targetId: id, metadata: body });
  return NextResponse.json(updated);
}
