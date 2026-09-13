import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "ابتدا وارد حساب کاربری شوید",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get("accountId");

    const days = Math.min(Number(searchParams.get("days") || 30), 365);

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: accountId || undefined,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "اکانت اینستاگرام پیدا نشد",
        },
        { status: 404 },
      );
    }

    const from = new Date();

    from.setDate(from.getDate() - days);

    const snapshots = await prisma.instagramInsightSnapshot.findMany({
      where: {
        instagramAccountId: account.id,

        snapshotDate: {
          gte: from,
        },
      },

      orderBy: {
        snapshotDate: "asc",
      },
    });

    return NextResponse.json({
      account: {
        id: account.id,
        username: account.igUsername,
      },

      snapshots,
    });
  } catch (error) {
    console.error("[Instagram Insight History]", error);

    return NextResponse.json(
      {
        error: "خطا در دریافت تاریخچه Insights",
      },
      { status: 500 },
    );
  }
}
