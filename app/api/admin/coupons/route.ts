import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-audit";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const data = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, code: true, discountType: true, value: true, currency: true, validFrom: true, expiresAt: true, maxUses: true, maxUsesPerUser: true, usageCount: true, isActive: true, createdAt: true } });
  return NextResponse.json({ data: data.map(x => ({ ...x, value: x.value.toString() })) });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  const value = Number(body.value);
  if (!code || !Number.isFinite(value) || value <= 0) return NextResponse.json({ message: "کد و مقدار تخفیف معتبر نیست" }, { status: 400 });
  const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (Number.isNaN(validFrom.getTime()) || (expiresAt && Number.isNaN(expiresAt.getTime()))) return NextResponse.json({ message: "بازه اعتبار نامعتبر است" }, { status: 400 });

  try {
    const coupon = await prisma.coupon.create({ data: { code, discountType: String(body.discountType ?? "PERCENTAGE") as never, value, currency: body.currency ? String(body.currency).trim().toUpperCase() : null, validFrom, expiresAt, maxUses: body.maxUses ? Number(body.maxUses) : null, maxUsesPerUser: Math.max(1, Number(body.maxUsesPerUser ?? 1)) } });
    await writeAdminAudit({ actorUserId: guard.session!.user.id, action: "coupon.create", targetType: "Coupon", targetId: coupon.id, metadata: { code } });
    return NextResponse.json({ ...coupon, value: coupon.value.toString() }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "این کد تخفیف قبلاً ثبت شده است" }, { status: 409 });
  }
}
