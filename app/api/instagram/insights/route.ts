import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
  getInstagramAccountInsights,
  getInstagramMedia,
  getInstagramMediaInsights,
  getInstagramProfile,
} from "@/lib/instagram/api";

export const dynamic = "force-dynamic";

function getMetricTotal(
  metric:
    | {
        name: string;
        values?: Array<{
          value: number;
        }>;
        total_value?: {
          value?: number;
        };
      }
    | undefined,
) {
  if (!metric) {
    return 0;
  }

  if (typeof metric.total_value?.value === "number") {
    return metric.total_value.value;
  }

  return (
    metric.values?.reduce((sum, item) => sum + Number(item.value || 0), 0) ?? 0
  );
}

function getMetric(
  data: Array<{
    name: string;
    values?: Array<{
      value: number;
    }>;
    total_value?: {
      value?: number;
    };
  }>,
  name: string,
) {
  return getMetricTotal(data.find((item) => item.name === name));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "ابتدا وارد حساب کاربری شوید",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get("accountId");

    const daysParam = Number(searchParams.get("days") || 7);

    const days = [7, 14, 28].includes(daysParam) ? daysParam : 7;

    const account = await prisma.instagramAccount.findFirst({
      where: {
        userId: session.user.id,

        ...(accountId
          ? {
              id: accountId,
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "اکانت اینستاگرام متصل پیدا نشد",
        },
        { status: 404 },
      );
    }

    if (!account.isConnected) {
      return NextResponse.json(
        {
          error: "اکانت اینستاگرام متصل نیست",
        },
        { status: 400 },
      );
    }

    if (
      account.tokenExpiresAt &&
      account.tokenExpiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "توکن اینستاگرام منقضی شده است. لطفاً اکانت را دوباره متصل کنید.",
          code: "TOKEN_EXPIRED",
        },
        { status: 401 },
      );
    }

    const [profile, insights, media] = await Promise.all([
      getInstagramProfile(account.accessToken),

      getInstagramAccountInsights(account.igUserId, account.accessToken, days),

      getInstagramMedia(account.igUserId, account.accessToken, 25),
    ]);

    const metrics = insights.data ?? [];

    const summary = {
      reach: getMetric(metrics, "reach"),

      views: getMetric(metrics, "views"),

      accountsEngaged: getMetric(metrics, "accounts_engaged"),

      totalInteractions: getMetric(metrics, "total_interactions"),

      profileViews: getMetric(metrics, "profile_views"),

      followerCount: Number(profile.followers_count ?? 0),
    };

    const mediaWithInsights = await Promise.all(
      (media.data ?? []).map(async (item) => {
        try {
          const result = await getInstagramMediaInsights(
            item.id,
            account.accessToken,
          );

          return {
            ...item,
            insights: result.data ?? [],
          };
        } catch (error) {
          console.error("[Instagram Insights] Media insight failed:", {
            mediaId: item.id,
            error,
          });

          return {
            ...item,
            insights: [],
          };
        }
      }),
    );

    return NextResponse.json({
      account: {
        id: account.id,
        igUserId: account.igUserId,
        username: profile.username || account.igUsername,
        followers: Number(profile.followers_count ?? 0),
        following: Number(profile.follows_count ?? 0),
        mediaCount: Number(profile.media_count ?? 0),
      },

      period: {
        days,
      },

      summary,

      insights: metrics,

      media: mediaWithInsights,
    });
  } catch (error) {
    console.error("[Instagram Insights] Error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "خطا در دریافت Insights اینستاگرام",
      },
      { status: 500 },
    );
  }
}
