import { NextRequest, NextResponse } from "next/server";

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
  "profile_views",
] as const;

type InsightMetricName = (typeof INSIGHT_METRICS)[number];

type InstagramInsightMetric = {
  name?: string;

  values?: Array<{
    value?: number;
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
  followers_count?: number;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

async function fetchInstagram<T>(url: string) {
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
      throw new Error("Instagram returned invalid JSON.");
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
) {
  const metric = metrics.find((item) => item.name === name);

  if (!metric?.values?.length) {
    return null;
  }

  const value = metric.values[metric.values.length - 1]?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getSnapshotDate() {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    // -----------------------------------------------------
    // Security
    // -----------------------------------------------------

    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    // -----------------------------------------------------
    // Accounts
    // -----------------------------------------------------

    const accounts = await prisma.instagramAccount.findMany({
      where: {
        isConnected: true,
      },

      select: {
        id: true,
        igUserId: true,
        igUsername: true,
      },
    });

    const results: Array<{
      accountId: string;
      username: string | null;
      success: boolean;
      snapshotId?: string;
      error?: string;
    }> = [];

    // -----------------------------------------------------
    // Process accounts
    // -----------------------------------------------------

    for (const account of accounts) {
      try {
        const accessToken = await getValidInstagramAccessToken(account.id);

        // ---------------------------------------------
        // Insights
        // ---------------------------------------------

        const insightsUrl = new URL(
          `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${account.igUserId}/insights`,
        );

        insightsUrl.searchParams.set("metric", INSIGHT_METRICS.join(","));

        insightsUrl.searchParams.set("period", "day");

        insightsUrl.searchParams.set("access_token", accessToken);

        const { response: insightsResponse, data: insightsData } =
          await fetchInstagram<InstagramInsightsResponse>(
            insightsUrl.toString(),
          );

        if (!insightsResponse.ok || !insightsData.data) {
          throw new Error(
            insightsData.error?.message || "Instagram Insights request failed.",
          );
        }

        const metrics = insightsData.data;

        const values = {
          reach: getMetricValue(metrics, "reach"),

          views: getMetricValue(metrics, "views"),

          accountsEngaged: getMetricValue(metrics, "accounts_engaged"),

          totalInteractions: getMetricValue(metrics, "total_interactions"),

          profileViews: getMetricValue(metrics, "profile_views"),
        };

        // ---------------------------------------------
        // Followers
        // ---------------------------------------------

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
            await fetchInstagram<InstagramProfileResponse>(
              profileUrl.toString(),
            );

          if (
            profileResponse.ok &&
            typeof profileData.followers_count === "number"
          ) {
            followerCount = profileData.followers_count;
          }
        } catch (error) {
          console.warn("[Instagram Cron] Followers request failed:", {
            accountId: account.id,
            error,
          });
        }

        // ---------------------------------------------
        // Snapshot
        // ---------------------------------------------

        const snapshotDate = getSnapshotDate();

        const snapshot = await prisma.instagramInsightSnapshot.upsert({
          where: {
            instagramAccountId_snapshotDate: {
              instagramAccountId: account.id,

              snapshotDate,
            },
          },

          create: {
            instagramAccountId: account.id,

            snapshotDate,

            reach: values.reach,

            views: values.views,

            accountsEngaged: values.accountsEngaged,

            totalInteractions: values.totalInteractions,

            profileViews: values.profileViews,

            followerCount,
          },

          update: {
            reach: values.reach,

            views: values.views,

            accountsEngaged: values.accountsEngaged,

            totalInteractions: values.totalInteractions,

            profileViews: values.profileViews,

            followerCount,
          },
        });

        results.push({
          accountId: account.id,

          username: account.igUsername,

          success: true,

          snapshotId: snapshot.id,
        });
      } catch (error) {
        console.error("[Instagram Cron] Account failed:", {
          accountId: account.id,
          username: account.igUsername,
          error,
        });

        results.push({
          accountId: account.id,

          username: account.igUsername,

          success: false,

          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,

      processed: accounts.length,

      successful: results.filter((item) => item.success).length,

      failed: results.filter((item) => !item.success).length,

      results,
    });
  } catch (error) {
    console.error("[Instagram Insights Cron] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron failed",
      },
      {
        status: 500,
      },
    );
  }
}
