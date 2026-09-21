import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { proxyInstagramMediaUrl } from "@/lib/instagram/media-proxy";
import { getCachedInstagramMedia } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "احراز هویت انجام نشده است.",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "instagramAccountId الزامی است.",
        },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
        isConnected: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت Instagram پیدا نشد.",
        },
        { status: 404 },
      );
    }

    const result = await getCachedInstagramMedia(account.id, 50);

    if (!result) {
      return NextResponse.json({ success: false, message: "دریافت Media اینستاگرام ناموفق بود." }, { status: 502 });
    }

    const data = (result.data ?? []).map((item: Record<string, unknown>) => ({
      ...item,
      media_url: proxyInstagramMediaUrl(
        typeof item.media_url === "string" ? item.media_url : null,
      ),
      thumbnail_url: proxyInstagramMediaUrl(
        typeof item.thumbnail_url === "string" ? item.thumbnail_url : null,
      ),
    }));

    return NextResponse.json({
      success: true,
      data,
      paging: result.paging ?? null,
    });
  } catch (error) {
    console.error("GET /api/instagram/media error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "خطای داخلی سرور.",
      },
      { status: 500 },
    );
  }
}
