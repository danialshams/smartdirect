import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const current = await prisma.subscription.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ message: "اشتراک پیدا نشد" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.planKey === "string" && body.planKey.trim()) data.planKey = body.planKey.trim();
  if (typeof body.note === "string") data.note = body.note.trim() || null;
  if (typeof body.autoRenew === "boolean") data.autoRenew = body.autoRenew;
  if (body.expiresAt) {
    const date = new Date(body.expiresAt);
    if (!Number.isNaN(date.getTime())) data.expiresAt = date;
  }

  const updated = await prisma.subscription.update({ where: { id }, data: data as never });
  await writeAdminAudit({ actorUserId: guard.session!.user.id, action: "subscription.update", targetType: "Subscription", targetId: id, metadata: body });
  return NextResponse.json(updated);
}
