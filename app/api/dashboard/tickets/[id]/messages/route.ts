import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const { id } = await context.params;
  const data = await req.json().catch(() => null);
  const body = typeof data?.body === "string" ? data.body.trim() : "";
  if (body.length < 1 || body.length > 5000) {
    return NextResponse.json({ message: "متن پاسخ باید بین ۱ تا ۵۰۰۰ نویسه باشد." }, { status: 400 });
  }

  try {
    const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.user.id }, select: { id: true, status: true } });
    if (!ticket) return NextResponse.json({ message: "درخواست پیدا نشد." }, { status: 404 });
    if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
      return NextResponse.json({ message: "برای پاسخ دادن ابتدا درخواست را باز کنید." }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.ticketMessage.create({ data: { ticketId: id, senderUserId: session.user.id, body } }),
      prisma.ticket.update({ where: { id }, data: { status: "IN_PROGRESS" } }),
    ]);
    return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Support ticket reply]", error);
    return NextResponse.json({ message: "ارسال پاسخ ناموفق بود." }, { status: 500 });
  }
}
