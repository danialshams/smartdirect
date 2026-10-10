import { NextRequest, NextResponse } from "next/server";
import { Prisma, SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_BULK_USERS = 500;
const VALID_STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED", "NONE"] as const;
type FilterStatus = (typeof VALID_STATUSES)[number];

type Filters = {
  q?: string;
  planKey?: string;
  status?: FilterStatus | "";
  expiryWithin?: "3" | "7" | "";
  connection?: "connected" | "disconnected" | "";
};

function buildUserWhere(filters: Filters, now: Date): Prisma.UserWhereInput {
  const q = filters.q?.trim() ?? "";
  const planKey = filters.planKey?.trim() ?? "";
  const status = filters.status ?? "";
  const expiryWithin = filters.expiryWithin ?? "";
  const connection = filters.connection ?? "";
  const AND: Prisma.UserWhereInput[] = [];
  const subscriptionConditions: Prisma.SubscriptionWhereInput[] = [];
  if (planKey) subscriptionConditions.push({ planKey });
  if (status === "ACTIVE") subscriptionConditions.push({ status: "ACTIVE", expiresAt: { gt: now } });
  if (status === "EXPIRED") subscriptionConditions.push({ OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lte: now } }] });
  if (status === "SUSPENDED" || status === "CANCELLED") subscriptionConditions.push({ status: status as SubscriptionStatus });
  if (expiryWithin === "3" || expiryWithin === "7") subscriptionConditions.push({ status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + Number(expiryWithin) * 86400000) } });

  if (q) AND.push({ OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] });
  if (status === "NONE") {
    AND.push({ subscriptions: { none: {} } });
    if (planKey || expiryWithin) AND.push({ subscriptions: { some: { AND: subscriptionConditions } } });
  } else if (subscriptionConditions.length) {
    AND.push({ subscriptions: { some: { AND: subscriptionConditions } } });
  }
  if (connection === "connected") AND.push({ instagramAccounts: { some: { isConnected: true } } });
  if (connection === "disconnected") AND.push({ instagramAccounts: { none: { isConnected: true } } });
  return { role: "USER" as const, ...(AND.length ? { AND } : {}) };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "درخواست معتبر نیست" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const selection = body.selection as
    | { mode: "ids"; userIds: unknown }
    | { mode: "filtered"; filters?: Filters; excludeUserIds?: unknown }
    | undefined;

  if (!selection || !["ids", "filtered"].includes(selection.mode)) {
    return NextResponse.json({ message: "روش انتخاب کاربران معتبر نیست" }, { status: 400 });
  }

  let userIds: string[] = [];
  if (selection.mode === "ids") {
    if (!Array.isArray(selection.userIds)) return NextResponse.json({ message: "فهرست کاربران معتبر نیست" }, { status: 400 });
    userIds = [...new Set(selection.userIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (!userIds.length) return NextResponse.json({ message: "حداقل یک کاربر انتخاب کنید" }, { status: 400 });
    if (userIds.length > MAX_BULK_USERS) return NextResponse.json({ message: "در هر عملیات حداکثر ۵۰۰ کاربر قابل انتخاب است" }, { status: 400 });
  } else {
    const filters = selection.filters ?? {};
    if (filters.status && !VALID_STATUSES.includes(filters.status)) return NextResponse.json({ message: "فیلتر وضعیت اشتراک معتبر نیست" }, { status: 400 });
    if (filters.expiryWithin && !["3", "7"].includes(filters.expiryWithin)) return NextResponse.json({ message: "فیلتر زمان انقضا معتبر نیست" }, { status: 400 });
    if (filters.connection && !["connected", "disconnected"].includes(filters.connection)) return NextResponse.json({ message: "فیلتر اتصال اینستاگرام معتبر نیست" }, { status: 400 });
    const excludeUserIds = Array.isArray(selection.excludeUserIds) ? [...new Set(selection.excludeUserIds.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
    const where = { ...buildUserWhere(filters, new Date()), ...(excludeUserIds.length ? { id: { notIn: excludeUserIds } } : {}) };
    const matching = await prisma.user.findMany({ where, select: { id: true }, orderBy: { createdAt: "desc" }, take: MAX_BULK_USERS + 1 });
    if (matching.length > MAX_BULK_USERS) {
      return NextResponse.json({ message: "بیش از ۵۰۰ کاربر با این فیلتر مطابقت دارند؛ فیلتر را محدودتر کنید", matchingAtLeast: matching.length }, { status: 400 });
    }
    userIds = matching.map((user) => user.id);
    if (!userIds.length) return NextResponse.json({ message: "کاربری با این فیلتر پیدا نشد" }, { status: 400 });
  }

  if (action === "subscription-adjust") {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 3650) {
      return NextResponse.json({ message: "تعداد روز باید عدد صحیح بین ۱ و ۳۶۵۰ یا منفی آن باشد" }, { status: 400 });
    }
  } else if (action === "subscription-change-plan") {
    const planKey = String(body.planKey ?? "").trim().toLowerCase();
    if (!["monthly", "yearly"].includes(planKey)) {
      return NextResponse.json({ message: "نوع اشتراک باید ماهانه یا سالانه باشد" }, { status: 400 });
    }
  } else if (action === "subscription-activate" || action === "subscription-suspend") {
    // No additional parameters required.
  } else {
    return NextResponse.json({ message: "عملیات گروهی معتبر نیست" }, { status: 400 });
  }

  const targets = await prisma.user.findMany({
    where: { id: { in: userIds }, role: "USER" },
    select: { id: true },
  });
  if (!targets.length) return NextResponse.json({ message: "کاربر معتبری برای اجرای عملیات پیدا نشد" }, { status: 400 });

  const actorUserId = guard.session!.user.id;
  const now = new Date();
  const processTarget = async (target: { id: string }) => {
    try {
      await prisma.$transaction(async (tx) => {
        if (action.startsWith("subscription-")) {
          let current = await tx.subscription.findFirst({ where: { userId: target.id }, orderBy: { expiresAt: "desc" } });

          if (action === "subscription-adjust") {
            const days = Number(body.days);
            if (!current && days < 0) throw new Error("اشتراک ندارد؛ کم‌کردن روز ممکن نیست");
            if (!current) {
              current = await tx.subscription.create({
                data: { userId: target.id, planKey: "monthly", source: "MANUAL", status: "ACTIVE", startedAt: now, expiresAt: new Date(now.getTime() + days * 86400000), note: "BULK_ADMIN_ADJUST" },
              });
            } else {
              const base = days > 0 && current.expiresAt < now ? now : current.expiresAt;
              const expiresAt = new Date(base.getTime() + days * 86400000);
              const status = current.status === "SUSPENDED" || current.status === "CANCELLED"
                ? current.status
                : expiresAt > now ? "ACTIVE" : "EXPIRED";
              current = await tx.subscription.update({ where: { id: current.id }, data: { expiresAt, status: status as never } });
            }
          } else if (action === "subscription-change-plan") {
            if (!current) throw new Error("اشتراک ندارد");
            current = await tx.subscription.update({ where: { id: current.id }, data: { planKey: String(body.planKey) } });
          } else if (action === "subscription-suspend") {
            if (!current) throw new Error("اشتراک ندارد");
            current = await tx.subscription.update({ where: { id: current.id }, data: { status: "SUSPENDED", suspendedAt: now } });
          } else if (action === "subscription-activate") {
            if (!current) {
              current = await tx.subscription.create({ data: { userId: target.id, planKey: "monthly", source: "MANUAL", status: "ACTIVE", startedAt: now, expiresAt: new Date(now.getTime() + 30 * 86400000), note: "BULK_ADMIN_ACTIVATE" } });
            } else {
              const expiresAt = current.expiresAt > now ? current.expiresAt : new Date(now.getTime() + 30 * 86400000);
              current = await tx.subscription.update({ where: { id: current.id }, data: { status: "ACTIVE", expiresAt, suspendedAt: null, cancelledAt: null } });
            }
          }
          if (current) {
            await tx.auditLog.create({
              data: { actorUserId, action: action.replaceAll("-", "."), targetType: "Subscription", targetId: current.id, metadata: { userId: target.id, planKey: current.planKey, expiresAt: current.expiresAt.toISOString(), days: body.days ?? null } },
            });
          }
        }
      });
      return { userId: target.id, success: true };
    } catch (error) {
      return { userId: target.id, success: false, message: error instanceof Error ? error.message : "خطای نامشخص" };
    }
  };

  const results: { userId: string; success: boolean; message?: string }[] = [];
  for (let index = 0; index < targets.length; index += 10) {
    const batch = targets.slice(index, index + 10);
    results.push(...await Promise.all(batch.map(processTarget)));
  }

  const succeeded = results.filter((result) => result.success).length;
  const failed = results.length - succeeded;
  return NextResponse.json({
    ok: failed === 0,
    action,
    requested: userIds.length,
    processed: results.length,
    succeeded,
    failed,
    results,
  }, { status: failed ? 207 : 200 });
}
