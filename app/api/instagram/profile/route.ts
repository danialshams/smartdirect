import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxyInstagramMediaUrl } from "@/lib/instagram/media-proxy";
import { getCachedInstagramProfile } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 10000;

type InstagramProfile = {
    user_id?: string;
    id?: string;
    username?: string;
    name?: string;
    biography?: string;
    website?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    account_type?: string;
};

type InstagramErrorResponse = {
    error?: {
        message?: string;
    };
};

async function fetchProfile(accessToken: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const url = new URL(
            `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me`,
        );

        url.searchParams.set(
            "fields",
            [
                "user_id",
                "id",
                "username",
                "name",
                "biography",
                "website",
                "profile_picture_url",
                "followers_count",
                "follows_count",
                "media_count",
                "account_type",
            ].join(","),
        );
        url.searchParams.set("access_token", accessToken);

        const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
        });

        const data = (await response.json()) as
            | InstagramProfile
            | InstagramErrorResponse;

        if (!response.ok) {
            const message =
                "error" in data
                    ? data.error?.message
                    : undefined;

            throw new Error(message || "خطا در دریافت اطلاعات پروفایل اینستاگرام.");
        }

        return data as InstagramProfile;
    } finally {
        clearTimeout(timeout);
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

        const accountId = request.nextUrl.searchParams.get("accountId");

        const account = accountId
            ? await prisma.instagramAccount.findFirst({
                  where: {
                      id: accountId,
                      userId: session.user.id,
                      isConnected: true,
                  },
                  select: {
                      id: true,
                      igUserId: true,
                      igUsername: true,
                      accessToken: true,
                      createdAt: true,
                  },
              })
            : await prisma.instagramAccount.findFirst({
                  where: {
                      userId: session.user.id,
                      isConnected: true,
                  },
                  orderBy: { updatedAt: "desc" },
                  select: {
                      id: true,
                      igUserId: true,
                      igUsername: true,
                      accessToken: true,
                      createdAt: true,
                  },
              });

        if (!account) {
            return NextResponse.json(
                { success: false, error: "اکانت متصل اینستاگرامی پیدا نشد." },
                { status: 404 },
            );
        }

        const profile = await getCachedInstagramProfile(account.id);\n\n        if (!profile) {\n            return NextResponse.json(\n                { success: false, error: "اطلاعات پروفایل Instagram در دسترس نیست." },\n                { status: 502 },\n            );\n        }

        return NextResponse.json({
            success: true,
            profile: {
                accountId: account.id,
                igUserId: profile.user_id || profile.id || account.igUserId,
                username: profile.username || account.igUsername,
                name: profile.name || null,
                biography: profile.biography || null,
                website: profile.website || null,
                profilePictureUrl: proxyInstagramMediaUrl(
                    profile.profile_picture_url,
                ),
                followersCount: profile.followers_count ?? null,
                followsCount: profile.follows_count ?? null,
                mediaCount: profile.media_count ?? null,
                accountType: profile.account_type || null,
                connectedAt: account.createdAt,
            },
        });
    } catch (error) {
        console.error("[Instagram Profile]", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "خطا در دریافت پروفایل اینستاگرام.",
            },
            { status: 500 },
        );
    }
}
