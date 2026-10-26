import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSupportPayload, supportAttachmentCreate, publishAdminSupportChange } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  try {
    const items = await prisma.ticket.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderUserId: true, createdAt: true } },
      },
    });
    const unreadRows = items.length ? await prisma.ticketMessage.groupBy({
      by: ["ticketId"],
      where: { ticketId: { in: items.map(item => item.id) }, senderUserId: { not: session.user.id }, readAt: null },
      _count: { _all: true },
    }) : [];
    const unreadMap = new Map(unreadRows.map(row => [row.ticketId, row._count._all]));
    return NextResponse.json({ userId: session.user.id, data: items.map(item => ({ ...item, unreadCount: unreadMap.get(item.id) || 0 })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Support tickets list]", error);
    return NextResponse.json({ message: "دریافت درخواست‌های پشتیبانی ناموفق بود." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  let data: Awaited<ReturnType<typeof getSupportPayload>>;
  try { data = await getSupportPayload(req); }
  catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "درخواست نامعتبر است." }, { status: 400 }); }
  const { subject, body, category, image } = data;
  if (subject.length < 5 || subject.length > 140 || body.length < 10 || body.length > 5000) {
    return NextResponse.json({ message: "عنوان باید ۵ تا ۱۴۰ و متن درخواست ۱۰ تا ۵۰۰۰ نویسه باشد." }, { status: 400 });
  }

  try {
    const recentCount = await prisma.ticket.count({
      where: { userId: session.user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recentCount >= 10) {
      return NextResponse.json({ message: "حداکثر ۱۰ درخواست در هر ساعت مجاز است." }, { status: 429 });
    }

    const ticket = await prisma.ticket.create({
      data: { userId: session.user.id, subject, category, messages: { create: { body, senderUserId: session.user.id, attachments: supportAttachmentCreate(image) } } },
      select: { id: true },
    });
    await publishAdminSupportChange(ticket.id, "new-ticket");
    return NextResponse.json(ticket, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Support create ticket]", error);
    return NextResponse.json({ message: "ثبت درخواست پشتیبانی ناموفق بود." }, { status: 500 });
  }
}
