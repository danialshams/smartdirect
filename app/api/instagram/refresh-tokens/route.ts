import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshInstagramToken } from "@/lib/instagram/token-manager";

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const accounts = await prisma.instagramAccount.findMany({
      where: {
        isConnected: true,

        OR: [
          {
            tokenExpiresAt: null,
          },
          {
            tokenExpiresAt: {
              lte: threshold,
            },
          },
        ],
      },

      select: {
        id: true,
        igUserId: true,
        igUsername: true,
        tokenExpiresAt: true,
      },
    });

    const results: Array<{
      id: string;
      username: string;
      success: boolean;
      expiresAt?: string;
      error?: string;
    }> = [];

    for (const account of accounts) {
      try {
        const refreshed = await refreshInstagramToken(account.id);

        results.push({
          id: account.id,
          username: account.igUsername,
          success: true,
          expiresAt: refreshed.expiresAt.toISOString(),
        });
      } catch (error) {
        results.push({
          id: account.id,
          username: account.igUsername,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      checked: accounts.length,
      results,
    });
  } catch (error) {
    console.error("[Instagram Token Cron] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در بررسی و تمدید توکن‌ها",
      },
      { status: 500 },
    );
  }
}
