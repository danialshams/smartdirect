import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize") ?? 20)));
  const where = q\n    ? {\n        role: "USER" as const,\n        AND: [{ OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }],\n      }\n    : { role: "USER" as const };

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
    return {
      ...u,
      pagesCount: u.instagramAccounts.length,
      subscription: subscription
        ? { ...subscription, effectiveStatus: subscription.status === "ACTIVE" && subscription.expiresAt.getTime() > now ? "ACTIVE" : "EXPIRED" }
        : null,
    };
  });

  return NextResponse.json({ data, total, page, pageSize });
}
