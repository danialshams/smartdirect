import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_DAYS = 365;

function normalizeDays(value: string | null) {
    const parsed = Number(value || 30);

    if (!Number.isFinite(parsed)) {
        return 30;
    }

    return Math.min(Math.max(Math.floor(parsed), 1), MAX_DAYS);
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "ابتدا وارد حساب کاربری شوید.",
                },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");
        const days = normalizeDays(searchParams.get("days"));

        const account = await prisma.instagramAccount.findFirst({
            where: {
                userId: session.user.id,
                ...(accountId
                    ? { id: accountId }
                    : { isConnected: true }),
            },
            orderBy: accountId ? undefined : { updatedAt: "desc" },
            select: {
                id: true,
                igUserId: true,
                igUsername: true,
                isConnected: true,
            },
        });

        if (!account) {
            return NextResponse.json(
                {
                    success: false,
                    error: "اکانت Instagram متصل پیدا نشد.",
                },
                { status: 404 },
            );
        }

        const now = new Date();
        const from = new Date(now);
        from.setUTCDate(from.getUTCDate() - (days - 1));
        from.setUTCHours(0, 0, 0, 0);

        const snapshots = await prisma.instagramInsightSnapshot.findMany({
            where: {
                instagramAccountId: account.id,
                snapshotDate: { gte: from },
            },
            orderBy: { snapshotDate: "asc" },
            select: {
                id: true,
                snapshotDate: true,
                reach: true,
                views: true,
                accountsEngaged: true,
                totalInteractions: true,
                profileViews: true,
                followerCount: true,
            },
        });

        const totals = snapshots.reduce(
            (result, snapshot) => {
                result.reach += snapshot.reach ?? 0;
                result.views += snapshot.views ?? 0;
                result.accountsEngaged += snapshot.accountsEngaged ?? 0;
                result.totalInteractions += snapshot.totalInteractions ?? 0;
                result.profileViews += snapshot.profileViews ?? 0;
                return result;
            },
            {
                reach: 0,
                views: 0,
                accountsEngaged: 0,
                totalInteractions: 0,
                profileViews: 0,
            },
        );

        const latestSnapshot = snapshots[snapshots.length - 1] ?? null;
        const firstSnapshot = snapshots[0] ?? null;
        const followerCount = latestSnapshot?.followerCount ?? 0;
        const firstFollowerCount = firstSnapshot?.followerCount ?? 0;
        const followerGrowth = followerCount - firstFollowerCount;

        const engagementRate =
            totals.reach > 0
                ? Number(((totals.totalInteractions / totals.reach) * 100).toFixed(2))
                : null;

        return NextResponse.json({
            success: true,
            account: {
                id: account.id,
                igUserId: account.igUserId,
                username: account.igUsername,
                isConnected: account.isConnected,
            },
            period: {
                days,
                from,
                to: now,
            },
            summary: {
                reach: totals.reach,
                views: totals.views,
                accountsEngaged: totals.accountsEngaged,
                totalInteractions: totals.totalInteractions,
                profileViews: totals.profileViews,
                followerCount,
                followerGrowth,
                engagementRate,
            },
            latest: latestSnapshot,
            snapshots,
        });
    } catch (error) {
        console.error("[Instagram Insight History]", error);

        return NextResponse.json(
            {
                success: false,
                error: "خطا در دریافت تاریخچه Instagram Insights.",
            },
            { status: 500 },
        );
    }
}
