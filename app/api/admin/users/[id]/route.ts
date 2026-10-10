import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
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

export async function PUT(req: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  if (!firstName || !lastName) return NextResponse.json({ message: "نام و نام خانوادگی الزامی است" }, { status: 400 });
  if (firstName.length > 80 || lastName.length > 100) return NextResponse.json({ message: "طول نام یا نام خانوادگی بیش از حد مجاز است" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing || existing.role !== "USER") return NextResponse.json({ message: "کاربر پیدا نشد" }, { status: 404 });
  const name = `${firstName} ${lastName}`;
  const updated = await prisma.user.update({ where: { id }, data: { name }, select: { id: true, name: true, email: true, updatedAt: true } });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (guard.session?.user.id === id) return NextResponse.json({ message: "امکان حذف حساب مدیر واردشده وجود ندارد" }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
  if (!target || target.role !== "USER") return NextResponse.json({ message: "کاربر پیدا نشد" }, { status: 404 });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { actorUserId: guard.session!.user.id, action: "user.delete", targetType: "User", targetId: target.id, metadata: { name: target.name } } });
      await tx.user.delete({ where: { id: target.id } });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "حذف کاربر انجام نشد؛ احتمالاً دادهٔ مرتبطی مانع حذف شده است." }, { status: 409 });
  }
}
