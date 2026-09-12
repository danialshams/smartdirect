import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";

type InstagramStory = {
  id: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

type InstagramStoriesResponse = {
  data?: InstagramStory[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
    fbtrace_id?: string;
  };
};

export async function GET(request: NextRequest) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Authentication
     * ---------------------------------------------------------
     */

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

    /*
     * ---------------------------------------------------------
     * 2. Get Instagram Account ID
     * ---------------------------------------------------------
     */

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

    /*
     * ---------------------------------------------------------
     * 3. Make sure this Instagram account belongs to user
     * ---------------------------------------------------------
     */

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
          message: "اکانت Instagram پیدا نشد یا متصل نیست.",
        },
        { status: 404 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Get valid access token
     * ---------------------------------------------------------
     */

    const accessToken = await getValidInstagramAccessToken(account.id);

    /*
     * ---------------------------------------------------------
     * 5. Instagram Stories API
     *
     * GET:
     * https://graph.instagram.com/v26.0/{ig-user-id}/stories
     * ---------------------------------------------------------
     */

    const url = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${account.igUserId}/stories`,
    );

    url.searchParams.set(
      "fields",
      [
        "id",
        "media_type",
        "media_product_type",
        "media_url",
        "thumbnail_url",
        "permalink",
        "timestamp",
      ].join(","),
    );

    url.searchParams.set("limit", "50");
    url.searchParams.set("access_token", accessToken);

    console.log("[Instagram Stories] Fetching stories:", {
      instagramAccountId: account.id,
      igUserId: account.igUserId,
      username: account.igUsername,
    });

    /*
     * ---------------------------------------------------------
     * 6. Request Instagram
     * ---------------------------------------------------------
     */

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const result = (await response.json()) as InstagramStoriesResponse;

    /*
     * ---------------------------------------------------------
     * 7. Handle Instagram error
     * ---------------------------------------------------------
     */

    if (!response.ok) {
      console.error("[Instagram Stories] API error:", {
        status: response.status,
        result,
      });

      return NextResponse.json(
        {
          success: false,
          message:
            result?.error?.message || "دریافت Story های Instagram ناموفق بود.",
          error: result?.error ?? null,
        },
        {
          status: response.status,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. Normalize response
     * ---------------------------------------------------------
     */

    const stories = (result.data ?? []).map((story) => ({
      id: String(story.id),

      mediaType: story.media_type ?? null,

      mediaProductType: story.media_product_type ?? null,

      mediaUrl: story.media_url ?? null,

      thumbnailUrl: story.thumbnail_url ?? null,

      permalink: story.permalink ?? null,

      timestamp: story.timestamp ?? null,
    }));

    /*
     * ---------------------------------------------------------
     * 9. Return
     * ---------------------------------------------------------
     */

    console.log("[Instagram Stories] Stories received:", {
      instagramAccountId: account.id,
      count: stories.length,
      stories: stories.map((story) => ({
        id: story.id,
        mediaType: story.mediaType,
        timestamp: story.timestamp,
      })),
    });

    return NextResponse.json({
      success: true,

      data: stories,

      count: stories.length,

      instagramAccount: {
        id: account.id,
        igUserId: account.igUserId,
        username: account.igUsername,
      },

      paging: result.paging ?? null,
    });
  } catch (error) {
    console.error("GET /api/instagram/stories error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "خطای داخلی سرور هنگام دریافت Story ها.",
      },
      { status: 500 },
    );
  }
}
