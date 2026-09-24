import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_DAYS = 730;
const INSTAGRAM_API_VERSION = "v26.0";

function normalizeDays(value: string | null) {
    const parsed = Number(value || 30);
    if (!Number.isFinite(parsed)) return 30;
    return Math.min(Math.max(Math.floor(parsed), 1), MAX_DAYS);
}

function normalizeDate(value: string | null) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + "T00:00:00.000Z");
    return Number.isNaN(date.getTime()) ? null : date;
}

async function getProfilePicture(accessToken: string) {
    if (!accessToken) return null;

    try {
        const url = new URL(`https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me`);
        url.searchParams.set("fields", "profile_picture_url");
        url.searchParams.set("access_token", accessToken);

        const response = await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) return null;

        const data = (await response.json()) as {
            profile_picture_url?: string;
        };

        return data.profile_picture_url || null;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "ابتدا وارد حساب کاربری شوید." },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");
        const requestedFrom = normalizeDate(searchParams.get("from"));
        const requestedTo = normalizeDate(searchParams.get("to"));
        const days = normalizeDays(searchParams.get("days"));

        const account = await prisma.instagramAccount.findFirst({
            where: {
                userId: session.user.id,
                ...(accountId ? { id: accountId } : { isConnected: true }),
            },
            orderBy: accountId ? undefined : { updatedAt: "desc" },
            select: {
                id: true,
                igUserId: true,
                igUsername: true,
                accessToken: true,
                isConnected: true,
            },
        });

        if (!account) {
            return NextResponse.json(
                { success: false, error: "اکانت Instagram متصل پیدا نشد." },
                { status: 404 },
            );
        }

        const now = new Date();
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);

        let from = new Date(today);
        let to = now;

        if (requestedFrom && requestedTo && requestedFrom <= requestedTo) {
            const requestedDays =
                Math.floor(
                    (requestedTo.getTime() - requestedFrom.getTime()) /
                        86400000,
                ) + 1;

            if (requestedDays > MAX_DAYS) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "بازه انتخابی حداکثر می‌تواند ۲ سال باشد.",
                    },
                    { status: 400 },
                );
            }

            from = requestedFrom;
            to = new Date(requestedTo);
            to.setUTCHours(23, 59, 59, 999);
        } else {
            from.setUTCDate(from.getUTCDate() - (days - 1));
        }

        const snapshots = await prisma.instagramInsightSnapshot.findMany({
            where: {
                instagramAccountId: account.id,
                snapshotDate: { gte: from, lte: to },
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

        const totals = snapshots.reduce(
            (result, snapshot) => {
                result.views += snapshot.views ?? 0;
                result.totalInteractions += snapshot.totalInteractions ?? 0;

                if (snapshot.follows != null) result.follows += snapshot.follows;
                if (snapshot.unfollows != null) result.unfollows += snapshot.unfollows;

                result.followsAvailable ||= snapshot.follows != null;
                result.unfollowsAvailable ||= snapshot.unfollows != null;

                return result;
            },
            {
                views: 0,
                totalInteractions: 0,
                follows: 0,
                unfollows: 0,
                followsAvailable: false,
                unfollowsAvailable: false,
            },
        );

        const latestSnapshot = snapshots[snapshots.length - 1] ?? null;
        const firstSnapshot = snapshots[0] ?? null;
        const followerCount = latestSnapshot?.followerCount ?? 0;
        const firstFollowerCount = firstSnapshot?.followerCount ?? 0;
        const followerGrowth = followerCount - firstFollowerCount;

        return NextResponse.json({
            success: true,
            account: {
                id: account.id,
                igUserId: account.igUserId,
                username: account.igUsername,
                isConnected: account.isConnected,
            },
            period: {
                days:
                    requestedFrom && requestedTo
                        ? Math.floor(
                              (to.getTime() - from.getTime()) / 86400000,
                          ) + 1
                        : days,
                from,
                to,
            },
            summary: {
                views: totals.views,
                totalInteractions: totals.totalInteractions,
                follows: totals.followsAvailable ? totals.follows : null,
                unfollows: totals.unfollowsAvailable ? totals.unfollows : null,
                followerCount,
                followerGrowth,
            },
            latest: latestSnapshot,
            snapshots,
        });
    } catch (error) {
        console.error("[Instagram Insight History]", error);

        return NextResponse.json(
            { success: false, error: "خطا در دریافت تاریخچه Instagram Insights." },
            { status: 500 },
        );
    }
}
