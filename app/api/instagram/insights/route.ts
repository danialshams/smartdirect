import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;

const CORE_INSIGHT_METRICS = ["views", "total_interactions"] as const;
const ADVANCED_INSIGHT_METRICS = ["follows_and_unfollows"] as const;

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
};

type InstagramInsightsResponse = {
  data?: InstagramInsightMetric[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type InstagramProfileResponse = {
  followers_count?: number;
};

function getErrorMessage(data: InstagramInsightsResponse) {
  return data.error?.message || "Instagram Insights request failed";
}

async function fetchInstagram<T>(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    const text = await response.text();
    let data = {} as T;

    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new Error("Instagram returned an invalid JSON response");
    }

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllInstagramInsightPages(url: string) {
  const allMetrics: InstagramInsightMetric[] = [];
  let nextUrl: string | null = url;
  let pageCount = 0;

  while (nextUrl && pageCount < 20) {
    const { response, data } =
      await fetchInstagram<InstagramInsightsResponse>(nextUrl);

    if (!response.ok || !data.data) {
      return {
        response,
        data,
        metrics: allMetrics,
        pageCount,
      };
    }

    allMetrics.push(...data.data);
    nextUrl = data.paging?.next ?? null;
    pageCount += 1;
  }

  return {
    response: { ok: true, status: 200 } as Response,
    data: { data: allMetrics } as InstagramInsightsResponse,
    metrics: allMetrics,
    pageCount,
  };
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSnapshotDate(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function getMetricSeries(
  metrics: InstagramInsightMetric[],
  name: InsightMetricName,
) {
  const metric = metrics.find((item) => item.name === name);

  return (metric?.values ?? [])
    .map((item) => {
      const value = item.value;
      const endTime = parseDate(item.end_time);

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !endTime
      ) {
        return null;
      }

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
      if (!item.value || typeof item.value !== "object") return null;

      const endTime = parseDate(item.end_time);
      if (!endTime) return null;

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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "ابتدا وارد حساب کاربری شوید" },
        { status: 401 },
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
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        igUserId: true,
        igUsername: true,
        tokenExpiresAt: true,
      },
    });

    if (!instagramAccount) {
      return NextResponse.json(
        { error: "هیچ حساب Instagram متصل نیست" },
        { status: 404 },
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
      const since = new Date(`${requestedFrom}T00:00:00.000Z`);
      if (!Number.isNaN(since.getTime())) {
        insightsUrl.searchParams.set(
          "since",
          String(Math.floor(since.getTime() / 1000)),
        );
      }
    }

    if (requestedTo && /^\d{4}-\d{2}-\d{2}$/.test(requestedTo)) {
      const until = new Date(`${requestedTo}T23:59:59.999Z`);
      if (!Number.isNaN(until.getTime())) {
        insightsUrl.searchParams.set(
          "until",
          String(Math.floor(until.getTime() / 1000)),
        );
      }
    }

    insightsUrl.searchParams.set("access_token", accessToken);

    const insightsResult = await fetchAllInstagramInsightPages(
      insightsUrl.toString(),
    );
    const insightsResponse = insightsResult.response;
    const insightsData = insightsResult.data;
    const insightsMetrics = insightsResult.metrics;

    console.info("[Instagram Insights] Core time-series sync:", {
      accountId: instagramAccount.id,
      requestedFrom,
      requestedTo,
      pages: insightsResult.pageCount,
      metrics: insightsMetrics.map((metric) => ({
        name: metric.name,
        period: metric.period,
        values: metric.values?.length ?? 0,
      })),
    });

    if (!insightsResponse.ok || !insightsData.data) {
      console.error("[Instagram Insights] Meta request failed:", {
        status: insightsResponse.status,
        accountId: instagramAccount.id,
        error: insightsData.error,
      });

      return NextResponse.json(
        {
          error: getErrorMessage(insightsData),
          meta: insightsData.error ?? null,
        },
        { status: insightsResponse.status || 502 },
      );
    }

    let followMetrics: InstagramInsightMetric[] = [];

    try {
      const advancedUrl = new URL(insightsUrl.toString());
      advancedUrl.searchParams.set(
        "metric",
        ADVANCED_INSIGHT_METRICS.join(","),
      );

      const advancedResult = await fetchAllInstagramInsightPages(
        advancedUrl.toString(),
      );

      if (advancedResult.response.ok && advancedResult.data.data) {
        followMetrics = advancedResult.metrics;
      } else {
        console.warn("[Instagram Insights] Advanced metrics unavailable:", {
          status: response.status,
          accountId: instagramAccount.id,
          error: data.error,
        });
      }
    } catch (error) {
      console.warn("[Instagram Insights] Advanced metrics request failed:", {
        accountId: instagramAccount.id,
        error,
      });
    }

    const viewSeries = getMetricSeries(insightsMetrics, "views");
    const interactionSeries = getMetricSeries(
      insightsMetrics,
      "total_interactions",
    );
    const followSeries = getFollowSeries(followMetrics);

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

    const ensureSeriesDay = (date: Date) => {
      const snapshotDate = getSnapshotDate(date);
      const key = snapshotDate.toISOString();

      if (!seriesByDate.has(key)) {
        seriesByDate.set(key, {
          snapshotDate,
          views: null,
          totalInteractions: null,
          follows: null,
          unfollows: null,
        });
      }

      return seriesByDate.get(key)!;
    };

    for (const item of viewSeries) {
      ensureSeriesDay(item.endTime).views = item.value;
    }

    for (const item of interactionSeries) {
      ensureSeriesDay(item.endTime).totalInteractions = item.value;
    }

    for (const item of followSeries) {
      const day = ensureSeriesDay(item.endTime);
      day.follows = item.follows;
      day.unfollows = item.unfollows;
    }

    let followerCount: number | null = null;

    try {
      const profileUrl = new URL(
        `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me`,
      );
      profileUrl.searchParams.set("fields", "followers_count");
      profileUrl.searchParams.set("access_token", accessToken);

      const { response, data } =
        await fetchInstagram<InstagramProfileResponse>(
          profileUrl.toString(),
        );

      if (response.ok && typeof data.followers_count === "number") {
        followerCount = data.followers_count;
      }
    } catch (error) {
      console.warn("[Instagram Insights] Profile request failed:", {
        accountId: instagramAccount.id,
        error,
      });
    }

    const snapshots = [];

    for (const item of Array.from(seriesByDate.values()).sort(
      (a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime(),
    )) {
      const isToday =
        item.snapshotDate.getTime() === getSnapshotDate(new Date()).getTime();

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
          followerCount: isToday ? followerCount : null,
        },
        update: {
          ...(item.views !== null ? { views: item.views } : {}),
          ...(item.totalInteractions !== null
            ? { totalInteractions: item.totalInteractions }
            : {}),
          ...(item.follows !== null ? { follows: item.follows } : {}),
          ...(item.unfollows !== null ? { unfollows: item.unfollows } : {}),
          ...(isToday && followerCount !== null ? { followerCount } : {}),
        },
      });

      snapshots.push(snapshot);
    }

    const latest = snapshots[snapshots.length - 1] ?? null;

    return NextResponse.json({
      success: true,
      account: {
        id: instagramAccount.id,
        igUserId: instagramAccount.igUserId,
        username: instagramAccount.igUsername,
      },
      metrics: {
        views: latest?.views ?? null,
        totalInteractions: latest?.totalInteractions ?? null,
        follows: latest?.follows ?? null,
        unfollows: latest?.unfollows ?? null,
      },
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
      })),
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
      { status: 500 },
    );
  }
}
