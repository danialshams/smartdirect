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
                createdAt: true,
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

        const twoYearsAgo = new Date(today);
        twoYearsAgo.setUTCDate(twoYearsAgo.getUTCDate() - (MAX_DAYS - 1));
        const firstSnapshot = await prisma.instagramInsightSnapshot.findFirst({
            where: { instagramAccountId: account.id },
            orderBy: { snapshotDate: "asc" },
            select: { snapshotDate: true },
        });
        // Instagram's actual creation date is not exposed by this API. Use the first
        // stored insight as the earliest selectable date, not account.createdAt.
        const firstAvailableDate = firstSnapshot ? new Date(firstSnapshot.snapshotDate) : twoYearsAgo;
        firstAvailableDate.setUTCHours(0, 0, 0, 0);
        const analyticsStartDate = firstAvailableDate > twoYearsAgo ? firstAvailableDate : twoYearsAgo;

        let from = new Date(today);
        let to = now;

        if ((searchParams.has("from") || searchParams.has("to")) && (!requestedFrom || !requestedTo || requestedFrom > requestedTo)) {
            return NextResponse.json({ success: false, error: "تاریخ شروع و پایان را درست انتخاب کن." }, { status: 400 });
        }

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
            if (from < analyticsStartDate) {
                return NextResponse.json({ success: false, error: "تاریخ شروع قبل از اولین تاریخ قابل‌دسترسی برای این پیج است." }, { status: 400 });
            }
            if (to > now) {
                return NextResponse.json({ success: false, error: "تاریخ پایان نمی‌تواند از امروز جلوتر باشد." }, { status: 400 });
            }
        } else {
            from.setUTCDate(from.getUTCDate() - (days - 1));
        }

        if (from < analyticsStartDate) {
            from = new Date(analyticsStartDate);
        }

        if (to < from) {
            return NextResponse.json({
                success: true,
                account: {
                    id: account.id,
                    igUserId: account.igUserId,
                    username: account.igUsername,
                    isConnected: account.isConnected,
                    analyticsStartDate,
                },
                period: {
                    days: 0,
                    from: analyticsStartDate,
                    to: analyticsStartDate,
                },
                summary: {
                    views: 0,
                    totalInteractions: 0,
                    follows: null,
                    unfollows: null,
                    followerCount: 0,
                    followerGrowth: 0,
                },
                latest: null,
                snapshots: [],
            });
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
                reach: true,
                views: true,
                accountsEngaged: true,
                totalInteractions: true,
                profileViews: true,
                follows: true,
                unfollows: true,
                followerCount: true,
            },
        });

        const totals = snapshots.reduce(
            (result, snapshot) => {
                result.reach += snapshot.reach ?? 0;
                result.views += snapshot.views ?? 0;
                result.accountsEngaged += snapshot.accountsEngaged ?? 0;
                result.profileViews += snapshot.profileViews ?? 0;
                result.totalInteractions += snapshot.totalInteractions ?? 0;

                if (snapshot.follows != null) result.follows += snapshot.follows;
                if (snapshot.unfollows != null) result.unfollows += snapshot.unfollows;

                result.followsAvailable ||= snapshot.follows != null;
                result.unfollowsAvailable ||= snapshot.unfollows != null;

                return result;
            },
            {
                reach: 0,
                views: 0,
                accountsEngaged: 0,
                profileViews: 0,
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
                analyticsStartDate,
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
                reach: totals.reach,
                views: totals.views,
                accountsEngaged: totals.accountsEngaged,
                profileViews: totals.profileViews,
                engagementRate: totals.reach > 0 ? (totals.totalInteractions / totals.reach) * 100 : null,
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
