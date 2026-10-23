import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const userId = session.user.id;
  try {
    const where = { ticket: { userId }, senderUserId: { not: userId }, readAt: null };
    const [unreadCount, newest] = await Promise.all([
      prisma.ticketMessage.count({ where }),
      prisma.ticketMessage.findFirst({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, ticketId: true, body: true, createdAt: true, ticket: { select: { subject: true } } },
      }),
    ]);
    return NextResponse.json({ unreadCount, latestUnread: newest ? {
      id: newest.id, ticketId: newest.ticketId, subject: newest.ticket.subject,
      body: newest.body.slice(0, 140), createdAt: newest.createdAt,
    } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[support] unread summary", error);
    return NextResponse.json({ message: "دریافت اعلان‌ها ناموفق بود." }, { status: 500 });
  }
}