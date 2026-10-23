import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSupportPayload, supportAttachmentCreate, publishSupportChange } from "@/lib/support/tickets";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const { id } = await context.params;
  let body = "", image: Awaited<ReturnType<typeof getSupportPayload>>["image"] = null;
  try {
    const data = await getSupportPayload(request);
    body = data.body;
    image = data.image;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "پیام نامعتبر است." }, { status: 400 });
  }
  if (!body || body.length > 5000) return NextResponse.json({ message: "متن پاسخ باید بین ۱ تا ۵۰۰۰ نویسه باشد." }, { status: 400 });
  try {
    const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.user.id }, select: { id: true, status: true } });
    if (!ticket) return NextResponse.json({ message: "درخواست پیدا نشد." }, { status: 404 });
    if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
      return NextResponse.json({ message: "برای پاسخ دادن ابتدا درخواست را باز کنید." }, { status: 409 });
    }
    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: { ticketId: id, senderUserId: session.user.id, body, attachments: supportAttachmentCreate(image) },
        select: { id: true },
      });
      await tx.ticket.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      return message;
    });
    await publishSupportChange(session.user.id, id, created.id);
    return NextResponse.json({ success: true, id: created.id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[support] send message", error);
    return NextResponse.json({ message: "ارسال پاسخ ناموفق بود." }, { status: 500 });
  }
}