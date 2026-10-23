import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const { id } = await context.params;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, senderUserId: true, createdAt: true, attachments: { select: { id: true, fileName: true, mimeType: true } }, sender: { select: { role: true, name: true } } },
        },
      },
    });
    if (!ticket) return NextResponse.json({ message: "درخواست پیدا نشد." }, { status: 404 });
    return NextResponse.json({ data: ticket, userId: session.user.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Support ticket detail]", error);
    return NextResponse.json({ message: "دریافت درخواست ناموفق بود." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  const { id } = await context.params;
  const data = await req.json().catch(() => null);
  if (data?.status !== "CLOSED" && data?.status !== "OPEN") {
    return NextResponse.json({ message: "وضعیت نامعتبر است." }, { status: 400 });
  }

  try {
    const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.user.id }, select: { status: true } });
    if (!ticket) return NextResponse.json({ message: "درخواست پیدا نشد." }, { status: 404 });
    const isClosed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";
    if (data.status === "OPEN" && !isClosed) {
      return NextResponse.json({ message: "این درخواست از قبل باز است." }, { status: 409 });
    }
    const result = await prisma.ticket.updateMany({
      where: { id, userId: session.user.id },
      data: data.status === "CLOSED" ? { status: "CLOSED", closedAt: new Date() } : { status: "OPEN", closedAt: null },
    });
    if (!result.count) return NextResponse.json({ message: "درخواست پیدا نشد." }, { status: 404 });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Support update ticket]", error);
    return NextResponse.json({ message: "تغییر وضعیت درخواست ناموفق بود." }, { status: 500 });
  }
}
