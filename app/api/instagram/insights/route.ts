import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;

const CORE_INSIGHT_METRICS = [
  "views",
  "total_interactions",
] as const;

const ADVANCED_INSIGHT_METRICS = [
  "follows_and_unfollows",
] as const;

type InsightMetricName =
  | (typeof CORE_INSIGHT_METRICS)[number]
  | (typeof ADVANCED_INSIGHT_METRICS)[number];

type InstagramInsightMetric = {
  name?: string;
  period?: string;
  values?: Array<{
    value?: number | { follows?: number; unfollows?: number };
    end_time?: string;
  }>;
  total_value?: {
    value?: number | { follows?: number; unfollows?: number };
  };
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

function getMetricSeries(
  metrics: InstagramInsightMetric[],
  name: InsightMetricName,
) {
  const metric = metrics.find((item) => item.name === name);
  return (metric?.values ?? [])
    .map((item) => {
      const value = item.value;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !item.end_time
      ) {
        return null;
      }

      const endTime = new Date(item.end_time);
      if (Number.isNaN(endTime.getTime())) return null;

      return { value, endTime };
    })
    .filter(
      (item): item is { value: number; endTime: Date } => item !== null,
    );
}

function getFollowSeries(metrics: InstagramInsightMetric[]) {
  const metric = metrics.find((item) => item.name === "follows_and_unfollows");
  return (metric?.values ?? [])
    .map((item) => {
      if (!item.end_time || !item.value || typeof item.value !== "object") {
        return null;
      }

      const endTime = new Date(item.end_time);
      if (Number.isNaN(endTime.getTime())) return null;

      return {
        follows:
          typeof item.value.follows === "number" &&
          Number.isFinite(item.value.follows)
            ? item.value.follows
            : null,
        unfollows:
          typeof item.value.unfollows === "number" &&
          Number.isFinite(item.value.unfollows)
            ? item.value.unfollows
            : null,
        endTime,
      };
    })
    .filter(
      (
        item,
      ): item is {
        follows: number | null;
        unfollows: number | null;
        endTime: Date;
      } => item !== null,
    );
}

function getSnapshotDate(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function getSnapshotDate(): Date {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const requestedAccountId = searchParams.get("accountId");
    const requestedFrom = searchParams.get("from");
    const requestedTo = searchParams.get("to");

    const instagramAccount = await prisma.instagramAccount.findFirst({
      where: {
        userId: session.user.id,
        isConnected: true,
        ...(requestedAccountId ? { id: requestedAccountId } : {}),
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

    insightsUrl.searchParams.set("metric", CORE_INSIGHT_METRICS.join(","));

    insightsUrl.searchParams.set("period", "day");
    insightsUrl.searchParams.set("metric_type", "time_series");

    if (requestedFrom && /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom)) {
      insightsUrl.searchParams.set(
        "since",
        String(Math.floor(new Date(requestedFrom + "T00:00:00.000Z").getTime() / 1000)),
      );
    }

    if (requestedTo && /^\d{4}-\d{2}-\d{2}$/.test(requestedTo)) {
      const until = new Date(requestedTo + "T23:59:59.999Z");
      insightsUrl.searchParams.set(
        "until",
        String(Math.floor(until.getTime() / 1000)),
      );
    }

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

    const followValues = { follows: null as number | null, unfollows: null as number | null };
    try {
      const advancedUrl = new URL(insightsUrl.toString());
      advancedUrl.searchParams.set(
        "metric",
        ADVANCED_INSIGHT_METRICS.join(","),
      );

      const {
        response: advancedResponse,
        data: advancedData,
      } = await fetchInstagram<InstagramInsightsResponse>(advancedUrl.toString());

      if (advancedResponse.ok && advancedData.data) {
        const parsedFollows = getFollowValues(advancedData.data);
        followValues.follows = parsedFollows.follows;
        followValues.unfollows = parsedFollows.unfollows;

      } else {
        console.warn("[Instagram Insights] Advanced metrics unavailable:", {
          status: advancedResponse.status,
          accountId: instagramAccount.id,
          error: advancedData.error,
        });
      }
    } catch (error) {
      console.warn("[Instagram Insights] Advanced metrics request failed:", {
        accountId: instagramAccount.id,
        error,
      });
    }

    const viewSeries = getMetricSeries(metrics, "views");
    const interactionSeries = getMetricSeries(metrics, "total_interactions");

    const followSeries = getFollowSeries(
      (await (async () => {
        const advancedUrl = new URL(insightsUrl.toString());
        advancedUrl.searchParams.set(
          "metric",
          ADVANCED_INSIGHT_METRICS.join(","),
        );

        const {
          response: advancedResponse,
          data: advancedData,
        } = await fetchInstagram<InstagramInsightsResponse>(
          advancedUrl.toString(),
        );

        return advancedResponse.ok && advancedData.data
          ? advancedData.data
          : [];
      })()),
    );

    const seriesByDate = new Map<
      string,
      {
        snapshotDate: Date;
        views: number | null;
        totalInteractions: number | null;
        follows: number | null;
        unfollows: number | null;
      }
    >();

    for (const item of viewSeries) {
      const date = getSnapshotDate(item.endTime);
      seriesByDate.set(date.toISOString(), {
        snapshotDate: date,
        views: item.value,
        totalInteractions: null,
        follows: null,
        unfollows: null,
      });
    }

    for (const item of interactionSeries) {
      const date = getSnapshotDate(item.endTime);
      const key = date.toISOString();
      const existing = seriesByDate.get(key) ?? {
        snapshotDate: date,
        views: null,
        totalInteractions: null,
        follows: null,
        unfollows: null,
      };
      existing.totalInteractions = item.value;
      seriesByDate.set(key, existing);
    }

    for (const item of followSeries) {
      const date = getSnapshotDate(item.endTime);
      const key = date.toISOString();
      const existing = seriesByDate.get(key) ?? {
        snapshotDate: date,
        views: null,
        totalInteractions: null,
        follows: null,
        unfollows: null,
      };
      existing.follows = item.follows;
      existing.unfo    const viewSeries = getMetricSeries(metrics, "views");
    const interactionSeries = getMetricSeries(metrics, "total_interactions");

    const followSeries = getFollowSeries(
      (await (async () => {
        const advancedUrl = new URL(insightsUrl.toString());
        advancedUrl.searchParams.set(
          "metric",
          ADVANCED_INSIGHT_METRICS.join(","),
        );

        const {
          response: advancedResponse,
          data: advancedData,
        } = await fetchInstagram<InstagramInsightsResponse>(
          advancedUrl.toString(),
        );

        return advancedResponse.ok && advancedData.data
          ? advancedData.data
          : [];
      })()),
    );

    const seriesByDate = new Map<
      string,
      {
        snapshotDate: Date;
        views: number | null;
        totalInteractions: number | null;
        follows: number | null;
        unfollows: number | null;
      }
    >();

    for (const item of viewSeries) {
      const date = getSnapshotDate(item.endTime);
      seriesByDate.set(date.toISOString(), {
        snapshotDate: date,
        views: item.value,
        totalInteractions: null,
        follows: null,
        unfollows: null,
      });
    }

    for (const item of interactionSeries) {
      const date = getSnapshotDate(item.endTime);
      const key = date.toISOString();
      const existing = seriesByDate.get(key) ?? {
        snapshotDate: date,
        views: null,
        totalInteractions: null,
        follows: null,
        unfollows: null,
      };
      existing.totalInteractions = item.value;
      seriesByDate.set(key, existing);
    }

    for (const item of followSeries) {
      const date = getSnapshotDate(item.endTime);
      const key = date.toISOString();
      const existing = seriesByDate.get(key) ?? {
        snapshotDate: date,
        views: null,
        totalInteractions: null,
        follows: null,
        unfollows: null,
      };
      existing.follows = item.follows;
      existing.unfollows = item.unfollows;
      seriesByDate.set(key, existing);
    }

    const todayKey = getSnapshotDate(new Date()).toISOString();
    const todaySnapshot = seriesByDate.get(todayKey);

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

    const snapshots = [];

    for (const item of Array.from(seriesByDate.values()).sort(
      (a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime(),
    )) {
      const snapshot = await prisma.instagramInsightSnapshot.upsert({
        where: {
          instagramAccountId_snapshotDate: {
            instagramAccountId: instagramAccount.id,
            snapshotDate: item.snapshotDate,
          },
        },
        create: {
          instagramAccountId: instagramAccount.id,
          snapshotDate: item.snapshotDate,
          views: item.views,
          totalInteractions: item.totalInteractions,
          follows: item.follows,
          unfollows: item.unfollows,
          followerCount:
            item.snapshotDate.getTime() === new Date(todayKey).getTime()
              ? followerCount
              : null,
        },
        update: {
          ...(item.views !== null ? { views: item.views } : {}),
          ...(item.totalInteractions !== null
            ? { totalInteractions: item.totalInteractions }
            : {}),
          ...(item.follows !== null ? { follows: item.follows } : {}),
          ...(item.unfollows !== null ? { unfollows: item.unfollows } : {}),
          ...(item.snapshotDate.getTime() === new Date(todayKey).getTime() &&
          followerCount !== null
            ? { followerCount }
            : {}),
        },
      });

      snapshots.push(snapshot);
    }

    return NextResponse.json({
      success: true,
      account: {
        id: instagramAccount.id,
        igUserId: instagramAccount.igUserId,
        username: instagramAccount.igUsername,
      },
      metrics: {
        views: todaySnapshot?.views ?? null,
        totalInteractions: todaySnapshot?.totalInteractions ?? null,
        follows: todaySnapshot?.follows ?? null,
        unfollows: todaySnapshot?.unfollows ?? null,
      },
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
      })),
    });
  }
  } catch (error) {
      console.warn("[Instagram Insights] Profile followers request failed:", {
        accountId: instagramAccount.id,
        error,
      });
    }

    const snapshots = [];

    for (const item of Array.from(seriesByDate.values()).sort(
      (a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime(),
    )) {
      const snapshot = await prisma.instagramInsightSnapshot.upsert({
        where: {
          instagramAccountId_snapshotDate: {
            instagramAccountId: instagramAccount.id,
            snapshotDate: item.snapshotDate,
          },
        },
        create: {
          instagramAccountId: instagramAccount.id,
          snapshotDate: item.snapshotDate,
          views: item.views,
          totalInteractions: item.totalInteractions,
          follows: item.follows,
          unfollows: item.unfollows,
          followerCount:
            item.snapshotDate.getTime() === new Date(todayKey).getTime()
              ? followerCount
              : null,
        },
        update: {
          ...(item.views !== null ? { views: item.views } : {}),
          ...(item.totalInteractions !== null
            ? { totalInteractions: item.totalInteractions }
            : {}),
          ...(item.follows !== null ? { follows: item.follows } : {}),
          ...(item.unfollows !== null ? { unfollows: item.unfollows } : {}),
          ...(item.snapshotDate.getTime() === new Date(todayKey).getTime() &&
          followerCount !== null
            ? { followerCount }
            : {}),
        },
      });

      snapshots.push(snapshot);
    }

    return NextResponse.json({
      success: true,
      account: {
        id: instagramAccount.id,
        igUserId: instagramAccount.igUserId,
        username: instagramAccount.igUsername,
      },
      metrics: {
        views: todaySnapshot?.views ?? null,
        totalInteractions: todaySnapshot?.totalInteractions ?? null,
        follows: todaySnapshot?.follows ?? null,
        unfollows: todaySnapshot?.unfollows ?? null,
      },
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
      })),
    });
  }

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
