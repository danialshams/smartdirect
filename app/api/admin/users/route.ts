import { NextRequest, NextResponse } from "next/server";
import { Prisma, SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const VALID_STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED", "NONE"] as const;

function buildUserWhere(q: string, planKey: string, status: string, expiryWithin: string, connection: string, now: Date): Prisma.UserWhereInput {
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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const planKey = params.get("planKey")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const expiryWithin = params.get("expiryWithin")?.trim() ?? "";
  const connection = params.get("connection")?.trim() ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize") ?? 20)));

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ message: "فیلتر وضعیت اشتراک معتبر نیست" }, { status: 400 });
  }

  if (expiryWithin && !["3", "7"].includes(expiryWithin)) return NextResponse.json({ message: "فیلتر زمان انقضا معتبر نیست" }, { status: 400 });
  if (connection && !["connected", "disconnected"].includes(connection)) return NextResponse.json({ message: "فیلتر اتصال اینستاگرام معتبر نیست" }, { status: 400 });

  const where = buildUserWhere(q, planKey, status, expiryWithin, connection, new Date());
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        instagramAccounts: { where: { isConnected: true }, select: { id: true, igUsername: true, isConnected: true } },
        subscriptions: { orderBy: { expiresAt: "desc" }, take: 1, select: { id: true, planKey: true, status: true, startedAt: true, expiresAt: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const now = Date.now();
  const data = items.map((u) => {
    const subscription = u.subscriptions[0] ?? null;
    const effectiveStatus = !subscription
      ? null
      : subscription.status === "SUSPENDED" || subscription.status === "CANCELLED"
        ? subscription.status
        : subscription.status === "ACTIVE" && subscription.expiresAt.getTime() > now
          ? "ACTIVE"
          : "EXPIRED";
    return {
      ...u,
      pagesCount: u.instagramAccounts.length,
      subscription: subscription ? { ...subscription, effectiveStatus } : null,
    };
  });

  return NextResponse.json({ data, total, page, pageSize });
}
