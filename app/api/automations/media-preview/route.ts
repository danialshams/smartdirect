import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

type MediaResponse = {
  id?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "احراز هویت انجام نشده است" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const instagramAccountId = searchParams.get("instagramAccountId");
    const mediaId = searchParams.get("mediaId");

    if (!instagramAccountId || !mediaId) {
      return NextResponse.json(
        { success: false, error: "instagramAccountId و mediaId الزامی هستند" },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
        isConnected: true,
      },
      select: { id: true, igUserId: true },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "اکانت Instagram پیدا نشد" },
        { status: 404 },
      );
    }

    const token = await getValidInstagramAccessToken(account.id);

    const media = await instagramApiRequest<MediaResponse>(`/${encodeURIComponent(mediaId)}`, {
      accessToken: token,
      params: {
        fields: "id,media_type,media_url,thumbnail_url",
      },
      timeoutMs: 15_000,
      maxRetries: 1,
      rateLimit: {
        instagramAccountId: account.id,
        operation: "AUTOMATION_MEDIA_PREVIEW",
        tenantId: session.user.id,
      },
    });

    const mediaType =
      media.media_type === "VIDEO"
        ? "VIDEO"
        : media.media_type === "IMAGE"
          ? "IMAGE"
          : "UNKNOWN";

    return NextResponse.json({
      success: true,
      data: {
        mediaUrl: media.media_url ?? null,
        thumbnailUrl: media.thumbnail_url ?? null,
        mediaType,
      },
    });
  } catch (error) {
    console.warn("[AUTOMATION_MEDIA_PREVIEW] unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({
      success: true,
      data: {
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: "UNKNOWN",
      },
    });
  }
}
