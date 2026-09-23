import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;

const INSIGHT_METRICS = [
  "reach",
  "views",
  "accounts_engaged",
  "total_interactions",
  "follows_and_unfollows",
  "profile_links_taps",
] as const;

type InsightMetricName = (typeof INSIGHT_METRICS)[number];

type InstagramInsightMetric = {
  name?: string;
  period?: string;
  values?: Array<{
    value?: number | { follows?: number; unfollows?: number };
    end_time?: string;
  }>;
};

type InstagramInsightsResponse = {
  data?: InstagramInsightMetric[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type InstagramProfileResponse = {
  id?: string;
  user_id?: string;
  username?: string;
  followers_count?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

function getErrorMessage(data: InstagramInsightsResponse): string {
  return data.error?.message || "Instagram Insights request failed";
}

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

function getMetricValue(
  metrics: InstagramInsightMetric[],
  name: InsightMetricName,
): number | null {
  const metric = metrics.find((item) => item.name === name);
  const value = metric?.values?.[metric.values.length - 1]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getFollowMetrics(metrics: InstagramInsightMetric[]) {
  const metric = metrics.find((item) => item.name === "follows_and_unfollows");
  const value = metric?.values?.[metric.values.length - 1]?.value;

  if (typeof value === "object" && value) {
    return {
      follows: typeof value.follows === "number" ? value.follows : null,
      unfollows: typeof value.unfollows === "number" ? value.unfollows : null,
    };
  }

  return { follows: null, unfollows: null };
}

function getSnapshotDate(): Date {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "ابتدا وارد حساب کاربری شوید",
        },
        {
          status: 401,
        },
      );
    }

    const instagramAccount = await prisma.instagramAccount.findFirst({
      where: {
        userId: session.user.id,
        isConnected: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        igUserId: true,
        igUsername: true,
        tokenExpiresAt: true,
      },
    });

    if (!instagramAccount) {
      return NextResponse.json(
        {
          error: "هیچ حساب Instagram متصل نیست",
        },
        {
          status: 404,
        },
      );
    }

    const accessToken = await getValidInstagramAccessToken(instagramAccount.id);

    const insightsUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${instagramAccount.igUserId}/insights`,
    );

    insightsUrl.searchParams.set("metric", INSIGHT_METRICS.join(","));

    insightsUrl.searchParams.set("period", "day");
    insightsUrl.searchParams.set("metric_type", "total_value");

    insightsUrl.searchParams.set("access_token", accessToken);

    const { response: insightsResponse, data: insightsData } =
      await fetchInstagram<InstagramInsightsResponse>(insightsUrl.toString());

    if (!insightsResponse.ok || !insightsData.data) {
      console.error("[Instagram Insights] Meta request failed:", {
        status: insightsResponse.status,
        accountId: instagramAccount.id,
        igUserId: instagramAccount.igUserId,
        error: insightsData.error,
      });

      return NextResponse.json(
        {
          error: getErrorMessage(insightsData),
          meta: insightsData.error ?? null,
        },
        {
          status: insightsResponse.status || 502,
        },
      );
    }

    const metrics = insightsData.data;

    const values = {
      reach: getMetricValue(metrics, "reach"),
      views: getMetricValue(metrics, "views"),
      accountsEngaged: getMetricValue(metrics, "accounts_engaged"),
      totalInteractions: getMetricValue(metrics, "total_interactions"),
    };

    let followerCount: number | null = null;

    const profileUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me`,
    );

    profileUrl.searchParams.set(
      "fields",
      "id,user_id,username,followers_count",
    );

    profileUrl.searchParams.set("access_token", accessToken);

    try {
      const { response: profileResponse, data: profileData } =
        await fetchInstagram<InstagramProfileResponse>(profileUrl.toString());

      if (
        profileResponse.ok &&
        typeof profileData.followers_count === "number"
      ) {
        followerCount = profileData.followers_count;
      }
    } catch (error) {
      console.warn("[Instagram Insights] Profile followers request failed:", {
        accountId: instagramAccount.id,
        error,
      });
    }

    const snapshotDate = getSnapshotDate();

    const snapshot = await prisma.instagramInsightSnapshot.upsert({
      where: {
        instagramAccountId_snapshotDate: {
          instagramAccountId: instagramAccount.id,
          snapshotDate,
        },
      },
      create: {
        instagramAccountId: instagramAccount.id,
        snapshotDate,
        reach: values.reach,
        views: values.views,
        accountsEngaged: values.accountsEngaged,
        totalInteractions: values.totalInteractions,
        followerCount,
      },
      update: {
        reach: values.reach,
        views: values.views,
        accountsEngaged: values.accountsEngaged,
        totalInteractions: values.totalInteractions,
        followerCount,
      },
    });

    return NextResponse.json({
      success: true,

      account: {
        id: instagramAccount.id,
        igUserId: instagramAccount.igUserId,
        username: instagramAccount.igUsername,
      },

      metrics: values,

      snapshot: {
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
      },
    });
  } catch (error) {
    console.error("[Instagram Insights] Unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "خطا در دریافت Instagram Insights",
      },
      {
        status: 500,
      },
    );
  }
}
