import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.maxUses === "number") data.maxUses = body.maxUses;
  if (typeof body.maxUsesPerUser === "number") data.maxUsesPerUser = Math.max(1, body.maxUsesPerUser);
  if (body.expiresAt !== undefined) {
    const date = body.expiresAt ? new Date(body.expiresAt) : null;
    if (date && Number.isNaN(date.getTime())) return NextResponse.json({ message: "تاریخ نامعتبر است" }, { status: 400 });
    data.expiresAt = date;
  }
  const updated = await prisma.coupon.update({ where: { id }, data: data as never });
  await writeAdminAudit({ actorUserId: guard.session!.user.id, action: "coupon.update", targetType: "Coupon", targetId: id, metadata: body });
  return NextResponse.json({ ...updated, value: updated.value.toString() });
}
