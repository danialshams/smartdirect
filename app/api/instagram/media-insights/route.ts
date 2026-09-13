import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;

type InstagramMedia = {
  id?: string;
  media_type?: string;
  media_product_type?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

type InstagramMediaResponse = {
  id?: string;
  media_type?: string;
  media_product_type?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type InstagramMediaInsight = {
  name?: string;
  period?: string;
  values?: Array<{
    value?: number;
    end_time?: string;
  }>;
};

type InstagramMediaInsightsResponse = {
  data?: InstagramMediaInsight[];

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type MetricName =
  | "views"
  | "reach"
  | "likes"
  | "comments"
  | "saved"
  | "shares"
  | "total_interactions";

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
      throw new Error("Instagram returned an invalid JSON response");
    }

    return {
      response,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getLatestMetricValue(
  metrics: InstagramMediaInsight[],
  name: MetricName,
): number | null {
  const metric = metrics.find((item) => item.name === name);

  if (!metric?.values?.length) {
    return null;
  }

  const value = metric.values[metric.values.length - 1]?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMetricName(name: string | undefined): MetricName | null {
  if (
    name === "views" ||
    name === "reach" ||
    name === "likes" ||
    name === "comments" ||
    name === "saved" ||
    name === "shares" ||
    name === "total_interactions"
  ) {
    return name;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // =========================================================
    // 1. Authentication
    // =========================================================

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

    // =========================================================
    // 2. Parameters
    // =========================================================

    const { searchParams } = new URL(request.url);

    const mediaId = searchParams.get("mediaId");

    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          message: "mediaId الزامی است.",
        },
        {
          status: 400,
        },
      );
    }

    // =========================================================
    // 3. Find Connected Instagram Account
    // =========================================================

    const account = await prisma.instagramAccount.findFirst({
      where: {
        ...(instagramAccountId
          ? {
              id: instagramAccountId,
            }
          : {}),
        userId: session.user.id,
        isConnected: true,
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
          message: "اکانت Instagram پیدا نشد.",
        },
        {
          status: 404,
        },
      );
    }

    // =========================================================
    // 4. Access Token
    // =========================================================

    const accessToken = await getValidInstagramAccessToken(account.id);

    // =========================================================
    // 5. Verify Media Belongs To This Account
    // =========================================================

    const mediaUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${mediaId}`,
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

    mediaUrl.searchParams.set("access_token", accessToken);

    const { response: mediaResponse, data: mediaData } =
      await fetchInstagram<InstagramMediaResponse>(mediaUrl.toString());

    if (!mediaResponse.ok || !mediaData.id) {
      console.error("[Instagram Media Insights] Media lookup failed:", {
        status: mediaResponse.status,
        mediaId,
        accountId: account.id,
        error: mediaData.error,
      });

      return NextResponse.json(
        {
          success: false,
          message: mediaData.error?.message || "Media پیدا نشد.",
          meta: mediaData.error ?? null,
        },
        {
          status: mediaResponse.status || 502,
        },
      );
    }

    // =========================================================
    // 6. Media Insights
    // =========================================================

    const insightsUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${mediaId}/insights`,
    );

    const requestedMetrics: MetricName[] = [
      "views",
      "reach",
      "likes",
      "comments",
      "saved",
      "shares",
      "total_interactions",
    ];

    insightsUrl.searchParams.set("metric", requestedMetrics.join(","));

    insightsUrl.searchParams.set("access_token", accessToken);

    const { response: insightsResponse, data: insightsData } =
      await fetchInstagram<InstagramMediaInsightsResponse>(
        insightsUrl.toString(),
      );

    if (!insightsResponse.ok || !insightsData.data) {
      console.error("[Instagram Media Insights] Insights request failed:", {
        status: insightsResponse.status,
        mediaId,
        accountId: account.id,
        mediaType: mediaData.media_type,
        mediaProductType: mediaData.media_product_type,
        error: insightsData.error,
      });

      return NextResponse.json(
        {
          success: false,
          message:
            insightsData.error?.message ||
            "دریافت Insights این محتوا ناموفق بود.",
          meta: insightsData.error ?? null,
        },
        {
          status: insightsResponse.status || 502,
        },
      );
    }

    // =========================================================
    // 7. Normalize Metrics
    // =========================================================

    const rawMetrics = insightsData.data;

    const metrics: Record<MetricName, number | null> = {
      views: null,
      reach: null,
      likes: null,
      comments: null,
      saved: null,
      shares: null,
      total_interactions: null,
    };

    for (const metric of rawMetrics) {
      const normalizedName = normalizeMetricName(metric.name);

      if (!normalizedName) {
        continue;
      }

      metrics[normalizedName] = getLatestMetricValue(
        rawMetrics,
        normalizedName,
      );
    }

    // =========================================================
    // 8. Calculate Engagement Rate
    // =========================================================

    let engagementRate: number | null = null;

    const totalInteractions = metrics.total_interactions;

    const reach = metrics.reach;

    if (
      typeof totalInteractions === "number" &&
      typeof reach === "number" &&
      reach > 0
    ) {
      engagementRate = Number(((totalInteractions / reach) * 100).toFixed(2));
    }

    // =========================================================
    // 9. Response
    // =========================================================

    return NextResponse.json({
      success: true,

      account: {
        id: account.id,
        igUserId: account.igUserId,
        username: account.igUsername,
      },

      media: {
        id: mediaData.id,
        type: mediaData.media_type ?? null,
        productType: mediaData.media_product_type ?? null,
        caption: mediaData.caption ?? null,
        mediaUrl: mediaData.media_url ?? null,
        thumbnailUrl: mediaData.thumbnail_url ?? null,
        permalink: mediaData.permalink ?? null,
        timestamp: mediaData.timestamp ?? null,
      },

      insights: {
        views: metrics.views,
        reach: metrics.reach,
        likes: metrics.likes,
        comments: metrics.comments,
        saved: metrics.saved,
        shares: metrics.shares,
        totalInteractions: metrics.total_interactions,
        engagementRate,
      },
    });
  } catch (error) {
    console.error("GET /api/instagram/media-insights error:", error);

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
