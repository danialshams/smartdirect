import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;
const MEDIA_LIMIT = 30;

type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

type MetricItem = {
  name?: string;
  values?: Array<{
    value?: number;
    end_time?: string;
  }>;
};

type MediaInsights = {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
  engagementRate: number | null;
};

type InstagramApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

async function fetchInstagram<T>(url: string): Promise<{
  response: Response;
  data: T;
}> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const text = await response.text();

    let data = {} as T;

    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new Error("Instagram returned invalid JSON");
    }

    return {
      response,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function latestMetric(metrics: MetricItem[], name: string): number | null {
  const metric = metrics.find((item) => item.name === name);

  if (!metric?.values?.length) {
    return null;
  }

  const value = metric.values[metric.values.length - 1]?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getMediaInsights(
  media: MediaItem,
  accessToken: string,
): Promise<MediaInsights> {
  const empty: MediaInsights = {
    views: null,
    reach: null,
    likes: null,
    comments: null,
    saved: null,
    shares: null,
    totalInteractions: null,
    engagementRate: null,
  };

  if (!media.id) {
    return empty;
  }

  try {
    const url = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${media.id}/insights`,
    );

    url.searchParams.set(
      "metric",
      [
        "views",
        "reach",
        "likes",
        "comments",
        "saved",
        "shares",
        "total_interactions",
      ].join(","),
    );

    url.searchParams.set("access_token", accessToken);

    const { response, data } = await fetchInstagram<
      InstagramApiResponse<MetricItem[]>
    >(url.toString());

    if (!response.ok || !data.data) {
      console.error("[Content Analytics] Media insights failed:", {
        mediaId: media.id,
        status: response.status,
        error: data.error,
      });

      return empty;
    }

    const metrics = data.data;

    const result: MediaInsights = {
      views: latestMetric(metrics, "views"),
      reach: latestMetric(metrics, "reach"),
      likes: latestMetric(metrics, "likes"),
      comments: latestMetric(metrics, "comments"),
      saved: latestMetric(metrics, "saved"),
      shares: latestMetric(metrics, "shares"),
      totalInteractions: latestMetric(metrics, "total_interactions"),
      engagementRate: null,
    };

    if (
      typeof result.totalInteractions === "number" &&
      typeof result.reach === "number" &&
      result.reach > 0
    ) {
      result.engagementRate = Number(
        ((result.totalInteractions / result.reach) * 100).toFixed(2),
      );
    }

    return result;
  } catch (error) {
    console.error("[Content Analytics] Media insights exception:", {
      mediaId: media.id,
      error,
    });

    return empty;
  }
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  handler: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);

    const batchResults = await Promise.all(batch.map(handler));

    results.push(...batchResults);
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "ابتدا وارد حساب کاربری شوید.",
        },
        {
          status: 401,
        },
      );
    }

    const { searchParams } = new URL(request.url);

    const requestedAccountId = searchParams.get("instagramAccountId");

    const account = await prisma.instagramAccount.findFirst({
      where: {
        userId: session.user.id,
        isConnected: true,
        ...(requestedAccountId
          ? {
              id: requestedAccountId,
            }
          : {}),
      },
      select: {
        id: true,
        igUserId: true,
        igUsername: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت Instagram متصل پیدا نشد.",
        },
        {
          status: 404,
        },
      );
    }

    const accessToken = await getValidInstagramAccessToken(account.id);

    // ---------------------------------------------------------
    // Get media
    // ---------------------------------------------------------

    const mediaUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${account.igUserId}/media`,
    );

    mediaUrl.searchParams.set(
      "fields",
      [
        "id",
        "caption",
        "media_type",
        "media_product_type",
        "media_url",
        "thumbnail_url",
        "permalink",
        "timestamp",
      ].join(","),
    );

    mediaUrl.searchParams.set("limit", String(MEDIA_LIMIT));

    mediaUrl.searchParams.set("access_token", accessToken);

    const { response: mediaResponse, data: mediaResult } = await fetchInstagram<
      InstagramApiResponse<MediaItem[]>
    >(mediaUrl.toString());

    if (!mediaResponse.ok || !mediaResult.data) {
      console.error("[Content Analytics] Media request failed:", mediaResult);

      return NextResponse.json(
        {
          success: false,
          message:
            mediaResult.error?.message || "دریافت محتوای Instagram ناموفق بود.",
        },
        {
          status: mediaResponse.status || 502,
        },
      );
    }

    const media = mediaResult.data;

    // ---------------------------------------------------------
    // Get insights in controlled batches
    // ---------------------------------------------------------

    const content = await processInBatches(media, 5, async (item) => {
      const insights = await getMediaInsights(item, accessToken);

      return {
        id: item.id,
        type: item.media_type ?? null,
        productType: item.media_product_type ?? null,
        caption: item.caption ?? null,
        mediaUrl: item.media_url ?? null,
        thumbnailUrl: item.thumbnail_url ?? null,
        permalink: item.permalink ?? null,
        timestamp: item.timestamp ?? null,
        insights,
      };
    });

    const sortedContent = [...content].sort((a, b) => {
      const aValue = a.insights.totalInteractions ?? 0;

      const bValue = b.insights.totalInteractions ?? 0;

      return bValue - aValue;
    });

    const totalReach = content.reduce(
      (sum, item) => sum + (item.insights.reach ?? 0),
      0,
    );

    const totalViews = content.reduce(
      (sum, item) => sum + (item.insights.views ?? 0),
      0,
    );

    const totalLikes = content.reduce(
      (sum, item) => sum + (item.insights.likes ?? 0),
      0,
    );

    const totalComments = content.reduce(
      (sum, item) => sum + (item.insights.comments ?? 0),
      0,
    );

    const totalSaved = content.reduce(
      (sum, item) => sum + (item.insights.saved ?? 0),
      0,
    );

    const totalShares = content.reduce(
      (sum, item) => sum + (item.insights.shares ?? 0),
      0,
    );

    const totalInteractions = content.reduce(
      (sum, item) => sum + (item.insights.totalInteractions ?? 0),
      0,
    );

    const engagementRate =
      totalReach > 0
        ? Number(((totalInteractions / totalReach) * 100).toFixed(2))
        : null;

    return NextResponse.json({
      success: true,

      account: {
        id: account.id,
        igUserId: account.igUserId,
        username: account.igUsername,
      },

      summary: {
        contentCount: content.length,
        reach: totalReach,
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        saved: totalSaved,
        shares: totalShares,
        totalInteractions,
        engagementRate,
      },

      bestContent: sortedContent.slice(0, 5),

      content,
    });
  } catch (error) {
    console.error("GET /api/instagram/content-analytics error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "خطای داخلی سرور.",
      },
      {
        status: 500,
      },
    );
  }
}
