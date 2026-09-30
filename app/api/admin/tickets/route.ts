import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const params = req.nextUrl.searchParams;
  const status = params.get("status") || undefined;
  const q = params.get("q")?.trim() ?? "";
  const where = {
    ...(status ? { status: status as never } : {}),
    ...(q ? { OR: [{ subject: { contains: q, mode: "insensitive" as const } }, { user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };

  const items = await prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, subject: true, status: true, priority: true, createdAt: true, updatedAt: true, closedAt: true, user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ data: items });
}
