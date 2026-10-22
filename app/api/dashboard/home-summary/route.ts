import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "ابتدا وارد حساب کاربری شوید." }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ success: false, error: "شناسه پیج الزامی است." }, { status: 400 });
  }

  try {
    const account = await prisma.instagramAccount.findFirst({
      where: { id: accountId, userId: session.user.id, isConnected: true },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json({ success: false, error: "پیج متصل پیدا نشد." }, { status: 404 });
    }

    const [unreadConversations, pendingPublishing, activeAutomations] = await Promise.all([
      prisma.conversation.count({
        where: {
          userId: session.user.id,
          instagramAccountId: account.id,
          messages: { some: { direction: "INBOUND", readAt: null } },
        },
      }),
      prisma.instagramPublishJob.count({
        where: {
          userId: session.user.id,
          instagramAccountId: account.id,
          status: { in: ["SCHEDULED", "PROCESSING", "PUBLISHING"] },
        },
      }),
      prisma.automation.count({
        where: { instagramAccountId: account.id, isActive: true },
      }),
    ]);

    return NextResponse.json(
      { success: true, data: { unreadConversations, pendingPublishing, activeAutomations } },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[Dashboard Home Summary]", error);
    return NextResponse.json({ success: false, error: "دریافت خلاصه داشبورد ناموفق بود." }, { status: 500 });
  }
}
