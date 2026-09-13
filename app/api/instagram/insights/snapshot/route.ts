import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  getInstagramAccountInsights,
  getInstagramProfile,
} from "@/lib/instagram/api";

export const dynamic = "force-dynamic";

function getMetric(
  data: Array<{
    name: string;
    values?: Array<{
      value: number;
    }>;
  }>,
  name: string,
) {
  const metric = data.find((item) => item.name === name);

  if (!metric) {
    return 0;
  }

  return (
    metric.values?.reduce((sum, item) => sum + Number(item.value || 0), 0) ?? 0
  );
}

export async function POST() {
  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      return NextResponse.json(
        {
          error: "CRON_SECRET تنظیم نشده است",
        },
        { status: 500 },
      );
    }

    const accounts = await prisma.instagramAccount.findMany({
      where: {
        isConnected: true,
      },
    });

    let success = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        const [profile, insights] = await Promise.all([
          getInstagramProfile(account.accessToken),

          getInstagramAccountInsights(account.igUserId, account.accessToken, 1),
        ]);

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const data = insights.data ?? [];

        await prisma.instagramInsightSnapshot.upsert({
          where: {
            instagramAccountId_snapshotDate: {
              instagramAccountId: account.id,

              snapshotDate: today,
            },
          },

          update: {
            reach: getMetric(data, "reach"),

            views: getMetric(data, "views"),

            accountsEngaged: getMetric(data, "accounts_engaged"),

            totalInteractions: getMetric(data, "total_interactions"),

            profileViews: getMetric(data, "profile_views"),

            followerCount: Number(profile.followers_count ?? 0),
          },

          create: {
            instagramAccountId: account.id,

            snapshotDate: today,

            reach: getMetric(data, "reach"),

            views: getMetric(data, "views"),

            accountsEngaged: getMetric(data, "accounts_engaged"),

            totalInteractions: getMetric(data, "total_interactions"),

            profileViews: getMetric(data, "profile_views"),

            followerCount: Number(profile.followers_count ?? 0),
          },
        });

        success++;
      } catch (error) {
        failed++;

        console.error("[Instagram Snapshot] Account failed:", {
          accountId: account.id,
          error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: accounts.length,
      processed: success,
      failed,
    });
  } catch (error) {
    console.error("[Instagram Snapshot] Fatal error:", error);

    return NextResponse.json(
      {
        error: "خطا در ذخیره Instagram Insights",
      },
      { status: 500 },
    );
  }
}
