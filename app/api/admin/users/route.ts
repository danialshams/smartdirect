import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const VALID_STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED", "NONE"] as const;

function buildUserWhere(q: string, planKey: string, status: string, now: Date) {
  const AND: Record<string, unknown>[] = [];
  if (q) AND.push({ OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] });
  if (planKey) AND.push({ subscriptions: { some: { planKey } } });
  if (status === "NONE") AND.push({ subscriptions: { none: {} } });
  if (status === "ACTIVE") AND.push({ subscriptions: { some: { status: "ACTIVE", expiresAt: { gt: now } } } });
  if (status === "EXPIRED") AND.push({ subscriptions: { some: { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lte: now } }] } } });
  if (status === "SUSPENDED" || status === "CANCELLED") AND.push({ subscriptions: { some: { status } } });
  return { role: "USER" as const, ...(AND.length ? { AND } : {}) };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const planKey = params.get("planKey")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize") ?? 20)));

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ message: "فیلتر وضعیت اشتراک معتبر نیست" }, { status: 400 });
  }

  const where = buildUserWhere(q, planKey, status, new Date());
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
