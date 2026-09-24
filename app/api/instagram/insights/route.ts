import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;

const INSIGHT_METRICS = [
  "views",
  "total_interactions",
  "follows_and_unfollows",
] as const;

type InstagramInsightMetricName = (typeof INSIGHT_METRICS)[number];

type InstagramInsightMetric = {
  name?: string;
  total_value?: {
    value?: number | { follows?: number; unfollows?: number };
    breakdowns?: Array<{
      dimension_keys?: string[];
      results?: Array<{
        dimension_values?: string[];
        value?: number;
      }>;
    }>;
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
  followers_count?: number;
};

function getErrorMessage(data: InstagramInsightsResponse) {
  return data.error?.message || "Instagram Insights request failed";
}

async function fetchInstagram<T>(
  url: string,
): Promise<{ response: Response; data: T }> {
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

function getSnapshotDate(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function getMetricNumber(
  data: InstagramInsightsResponse,
  name: InstagramInsightMetricName,
) {
  const metric = data.data?.find((item) => item.name === name);
  const value = metric?.total_value?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getFollowValues(data: InstagramInsightsResponse) {
  const metric = data.data?.find(
    (item) => item.name === "follows_and_unfollows",
  );

  const breakdowns = metric?.total_value?.breakdowns ?? [];

  let follows: number | null = null;
  let unfollows: number | null = null;

  for (const breakdown of breakdowns) {
    const dimension = breakdown.dimension_keys?.[0];
    if (dimension !== "follow_type") continue;

    for (const result of breakdown.results ?? []) {
      const key = result.dimension_values?.[0]?.toUpperCase();
      const value = result.value;

      if (typeof value !== "number" || !Number.isFinite(value)) continue;

      if (key === "FOLLOWER") follows = value;
      if (key === "NON_FOLLOWER") unfollows = value;
    }
  }

  const directValue = metric?.total_value?.value;
  if (directValue && typeof directValue === "object") {
    if (follows == null && typeof directValue.follows === "number") {
      follows = directValue.follows;
    }
    if (unfollows == null && typeof directValue.unfollows === "number") {
      unfollows = directValue.unfollows;
    }
  }

  return { follows, unfollows };
}

function getDayKeys(from: Date, to: Date) {
  const days: string[] = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

async function fetchDailyInsight(
  igUserId: string,
  accessToken: string,
  dayKey: string,
) {
  const start = new Date(dayKey + "T00:00:00.000Z");
  const end = new Date(dayKey + "T23:59:59.999Z");

  const baseUrl = new URL(
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${igUserId}/insights`,
  );

  baseUrl.searchParams.set("metric", "views,total_interactions");
  baseUrl.searchParams.set("period", "day");
  baseUrl.searchParams.set("metric_type", "total_value");
  baseUrl.searchParams.set("since", String(Math.floor(start.getTime() / 1000)));
  baseUrl.searchParams.set("until", String(Math.floor(end.getTime() / 1000)));
  baseUrl.searchParams.set("access_token", accessToken);

  const baseResult =
    await fetchInstagram<InstagramInsightsResponse>(baseUrl.toString());

  if (!baseResult.response.ok || !baseResult.data.data) {
    throw new Error(
      `Meta daily insights failed for ${dayKey}: ${getErrorMessage(
        baseResult.data,
      )}`,
    );
  }

  let follows: number | null = null;
  let unfollows: number | null = null;

  // follows_and_unfollows is a breakdown metric. It must be requested
  // separately with breakdown=follow_type. If Meta does not expose this
  // metric for the account (for example, accounts below the follower
  // threshold), views/interactions must still be stored for that day.
  try {
    const followUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${igUserId}/insights`,
    );

    followUrl.searchParams.set("metric", "follows_and_unfollows");
    followUrl.searchParams.set("period", "day");
    followUrl.searchParams.set("metric_type", "total_value");
    followUrl.searchParams.set("breakdown", "follow_type");
    followUrl.searchParams.set("since", String(Math.floor(start.getTime() / 1000)));
    followUrl.searchParams.set("until", String(Math.floor(end.getTime() / 1000)));
    followUrl.searchParams.set("access_token", accessToken);

    const followResult =
      await fetchInstagram<InstagramInsightsResponse>(followUrl.toString());

    if (followResult.response.ok && followResult.data.data) {
      ({ follows, unfollows } = getFollowValues(followResult.data));
    }
  } catch {
    // Follow metrics are optional for the daily snapshot. Keep the base
    // metrics even when Meta does not expose follows/unfollows.
  }

  return {
    snapshotDate: start,
    views: getMetricNumber(baseResult.data, "views"),
    totalInteractions: getMetricNumber(
      baseResult.data,
      "total_interactions",
    ),
    follows,
    unfollows,
  };
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
      },
    });

    if (!instagramAccount) {
      return NextResponse.json(
        { error: "هیچ حساب Instagram متصل نیست" },
        { status: 404 },
      );
    }

    const accessToken = await getValidInstagramAccessToken(instagramAccount.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "توکن معتبر Instagram برای این حساب پیدا نشد" },
        { status: 401 },
      );
    }

    const validAccessToken: string = accessToken;
    const igUserId: string = instagramAccount.igUserId;

    const now = new Date();
    const today = getSnapshotDate(now);

    let from = new Date(today);
    let to = new Date(today);

    if (
      requestedFrom &&
      requestedTo &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedTo)
    ) {
      const requestedStart = new Date(requestedFrom + "T00:00:00.000Z");
      const requestedEnd = new Date(requestedTo + "T00:00:00.000Z");

      if (
        !Number.isNaN(requestedStart.getTime()) &&
        !Number.isNaN(requestedEnd.getTime()) &&
        requestedStart <= requestedEnd
      ) {
        from = requestedStart;
        to = requestedEnd;
      }
    } else {
      from.setUTCDate(from.getUTCDate() - 29);
    }

    const dayKeys = getDayKeys(from, to);
    const MAX_SYNC_DAYS = 90;

    if (dayKeys.length > MAX_SYNC_DAYS) {
      return NextResponse.json(
        {
          error:
            "Meta برای تاریخچه Insights حداکثر ۹۰ روز اخیر را در این مسیر قابل دریافت می‌کند.",
        },
        { status: 400 },
      );
    }

    const existingSnapshots = await prisma.instagramInsightSnapshot.findMany({
      where: {
        instagramAccountId: instagramAccount.id,
        snapshotDate: {
          gte: from,
          lte: new Date(to.getTime() + 86400000 - 1),
        },
      },
      select: {
        snapshotDate: true,
        views: true,
        totalInteractions: true,
        follows: true,
        unfollows: true,
      },
    });

    const existingByDay = new Map(
      existingSnapshots.map((snapshot) => [
        snapshot.snapshotDate.toISOString().slice(0, 10),
        snapshot,
      ]),
    );

    const daysToSync = dayKeys.filter((day) => {
      const existing = existingByDay.get(day);
      // Views/interactions are the base daily series. Follows/unfollows are
      // optional because Meta may omit that metric for smaller accounts.
      return (
        !existing ||
        existing.views == null ||
        existing.totalInteractions == null
      );
    });

    const synced = [];
    const syncErrors: Array<{ day: string; error: string }> = [];

    // Meta exposes views/interactions as regular account metrics and
    // follows_and_unfollows as a separate follow_type breakdown. Request the
    // daily window explicitly so one unavailable optional metric cannot break
    // the continuous base series.
    for (let index = 0; index < daysToSync.length; index += 3) {
      const batch = daysToSync.slice(index, index + 3);

      const results = await Promise.all(
        batch.map(async (day) => {
          try {
            return {
              day,
              result: await fetchDailyInsight(
                igUserId,
                validAccessToken,
                day,
              ),
            };
          } catch (error) {
            return {
              day,
              error:
                error instanceof Error
                  ? error.message
                  : "خطای نامشخص در دریافت داده Meta",
            };
          }
        }),
      );

      for (const item of results) {
        if ("error" in item) {
          syncErrors.push({
            day: item.day,
            error: item.error ?? "خطای نامشخص در دریافت داده Meta",
          });
        } else {
          synced.push(item.result);
        }
      }
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

    for (const item of synced) {
      const isToday = item.snapshotDate.getTime() === today.getTime();

      await prisma.instagramInsightSnapshot.upsert({
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
    }

    const snapshots = await prisma.instagramInsightSnapshot.findMany({
      where: {
        instagramAccountId: instagramAccount.id,
        snapshotDate: {
          gte: from,
          lte: new Date(to.getTime() + 86400000 - 1),
        },
      },
      orderBy: { snapshotDate: "asc" },
      select: {
        id: true,
        snapshotDate: true,
        views: true,
        totalInteractions: true,
        follows: true,
        unfollows: true,
        followerCount: true,
      },
    });

    console.info("[Instagram Insights] Daily snapshot sync:", {
      accountId: instagramAccount.id,
      requestedFrom: from.toISOString().slice(0, 10),
      requestedTo: to.toISOString().slice(0, 10),
      requestedDays: dayKeys.length,
      existingDays: existingSnapshots.length,
      syncedDays: synced.length,
      errors: syncErrors,
      snapshotsReturned: snapshots.length,
    });

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
      sync: {
        requestedDays: dayKeys.length,
        syncedDays: synced.length,
        errors: syncErrors,
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
      { status: 500 },
    );
  }
}
