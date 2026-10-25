import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";
import { synchronizeLiveReplySessions } from "@/lib/automation/live-session-lifecycle";

export const dynamic = "force-dynamic";

type LiveMedia = { id: string; permalink?: string | null };

/** Current Instagram broadcasts, filtered by ownership; never exposes access tokens. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const accountId = request.nextUrl.searchParams.get("instagramAccountId")?.trim();
    if (!accountId) return NextResponse.json({ success: false, error: "شناسه پیج الزامی است." }, { status: 400 });
    const account = await prisma.instagramAccount.findFirst({
      where: { id: accountId, userId: session.user.id, isConnected: true },
      select: { id: true, igUserId: true },
    });
    if (!account) return NextResponse.json({ success: false, error: "پیج متصل یافت نشد." }, { status: 404 });
    const accessToken = await getValidInstagramAccessToken(account.id);
    const response = await instagramApiRequest<{ data?: LiveMedia[] }>(
      "/" + encodeURIComponent(account.igUserId) + "/live_media", {
        accessToken,
        params: { fields: "id,permalink", limit: 20 },
        rateLimit: { instagramAccountId: account.id, operation: "PROFILE_READ" },
      },
    );
    const data = Array.isArray(response.data) ? response.data
      .filter(item => typeof item?.id === "string" && Boolean(item.id.trim()))
      .map(item => ({ id: item.id, permalink: item.permalink || null })) : [];
    await synchronizeLiveReplySessions(account.id, data.map(item=>item.id));
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET live media failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, error: "امکان بررسی لایو فعال در حال حاضر وجود ندارد." }, { status: 502 });
  }
}
