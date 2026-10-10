import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

function parseDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id: userId } = await context.params;
  const body = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ message: "کاربر پیدا نشد" }, { status: 404 });

  const action = String(body.action ?? "");
  const days = Number(body.days ?? 0);
  const planKey = String(body.planKey ?? "monthly").trim() || "monthly";
  const now = new Date();

  let current = await prisma.subscription.findFirst({ where: { userId }, orderBy: { expiresAt: "desc" } });

  if (action === "save") {
    if (!["monthly", "yearly"].includes(planKey)) {
      return NextResponse.json({ message: "نوع اشتراک معتبر نیست" }, { status: 400 });
    }
    if (!Number.isInteger(days) || days < -3650 || days > 3650) {
      return NextResponse.json({ message: "تعداد روز معتبر نیست" }, { status: 400 });
    }
    if (!current) {
      if (days < 0) return NextResponse.json({ message: "برای ایجاد اشتراک جدید نمی‌توان روز منفی وارد کرد" }, { status: 400 });
      const initialDays = days || 30;
      current = await prisma.subscription.create({
        data: { userId, planKey, source: "MANUAL", status: "ACTIVE", startedAt: now, expiresAt: new Date(now.getTime() + initialDays * 86400000) },
      });
    } else {
      const base = current.expiresAt > now ? current.expiresAt : now;
      const expiresAt = days === 0 ? current.expiresAt : new Date(base.getTime() + days * 86400000);
      if (expiresAt <= now) return NextResponse.json({ message: "تاریخ انقضا نمی‌تواند در گذشته باشد" }, { status: 400 });
      const status = days !== 0 ? "ACTIVE" : current.status;
      current = await prisma.subscription.update({
        where: { id: current.id },
        data: { planKey, expiresAt, status, ...(status === "ACTIVE" ? { suspendedAt: null, cancelledAt: null } : {}) },
      });
    }
  } else if (action === "create") {
    const expiresAt = new Date(now.getTime() + Math.max(1, days || 30) * 86400000);
    current = await prisma.subscription.create({ data: { userId, planKey, source: "MANUAL", status: "ACTIVE", startedAt: now, expiresAt } });
  } else if (!current) {
    if (!["activate", "extend"].includes(action)) return NextResponse.json({ message: "این کاربر اشتراک ندارد" }, { status: 400 });
    const expiresAt = new Date(now.getTime() + Math.max(1, days || 30) * 86400000);
    current = await prisma.subscription.create({ data: { userId, planKey, source: "MANUAL", status: "ACTIVE", startedAt: now, expiresAt } });
  } else if (action === "activate") {
    const expiresAt = current.expiresAt > now ? current.expiresAt : new Date(now.getTime() + Math.max(1, days || 30) * 86400000);
    current = await prisma.subscription.update({ where: { id: current.id }, data: { status: "ACTIVE", expiresAt, suspendedAt: null, cancelledAt: null, planKey } });
  } else if (action === "suspend") {
    current = await prisma.subscription.update({ where: { id: current.id }, data: { status: "SUSPENDED", suspendedAt: now } });
  } else if (action === "cancel") {
    current = await prisma.subscription.update({ where: { id: current.id }, data: { status: "CANCELLED", cancelledAt: now } });
  } else if (action === "extend" || action === "adjust") {
    if (!Number.isFinite(days) || days === 0) return NextResponse.json({ message: "تعداد روز معتبر نیست" }, { status: 400 });
    const base = current.expiresAt > now ? current.expiresAt : now;
    const expiresAt = new Date(base.getTime() + days * 86400000);
    const status = expiresAt > now && current.status !== "CANCELLED" ? "ACTIVE" : "EXPIRED";
    current = await prisma.subscription.update({ where: { id: current.id }, data: { expiresAt, status, planKey } });
  } else if (action === "change-plan") {
    current = await prisma.subscription.update({ where: { id: current.id }, data: { planKey } });
  } else {
    return NextResponse.json({ message: "عملیات نامعتبر است" }, { status: 400 });
  }

  await writeAdminAudit({ actorUserId: guard.session!.user.id, action: "subscription."+action, targetType: "Subscription", targetId: current.id, metadata: { userId, days, planKey } });
  return NextResponse.json(current);
}
