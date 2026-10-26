import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminUsersPage, type AdminFilters } from "@/lib/admin-users";
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(); if (guard.response) return guard.response;
  const p = req.nextUrl.searchParams;
  const filters: AdminFilters = { q: p.get("q") || "", planKey: p.get("planKey") || "", status: p.get("status") || "", expiryWithin: p.get("expiryWithin") || "", connection: p.get("connection") || "", access: p.get("access") || "" };
  const page = Math.max(1, Math.floor(Number(p.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(p.get("pageSize")) || 20)));
  const {data:subset,total} = await getAdminUsersPage(filters,page,pageSize);
  const ids = subset.flatMap(u => u.instagramAccounts.map(a => a.id));
  const [counts, tickets] = await Promise.all([
    ids.length ? prisma.automation.groupBy({ by: ["instagramAccountId"], where: { instagramAccountId: { in: ids }, isActive: true }, _count: { _all: true } }) : Promise.resolve([]),
    subset.length ? prisma.ticket.groupBy({ by: ["userId"], where: { userId: { in: subset.map(u=>u.id) }, status: { in: ["OPEN","IN_PROGRESS","WAITING_USER"] } }, _count: { _all: true } }) : Promise.resolve([])
  ]);
  const activeByPage = new Map<string,number>();
  for (const c of counts) activeByPage.set(c.instagramAccountId, c._count._all);
  const ticketByUser = new Map(tickets.map(t=>[t.userId,t._count._all]));
  return NextResponse.json({ data: subset.map(u=>({ ...u, activeAutomations: u.instagramAccounts.reduce((sum,a)=>sum+(activeByPage.get(a.id)||0),0), openTickets: ticketByUser.get(u.id)||0 })), total, page, pageSize }, { headers: { "Cache-Control":"private, no-store" } });
}
