import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxyInstagramAccountProfileUrl } from "@/lib/instagram/media-proxy";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 10000;

type ProfileResponse = {
    profile_picture_url?: string;
    username?: string;
    error?: unknown;
};

async function getProfilePicture(accessToken: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const url = new URL(
            `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me`,
        );

        url.searchParams.set("fields", "id,user_id,username,profile_picture_url");
        url.searchParams.set("access_token", accessToken);

        const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) return null;

        const data = (await response.json()) as ProfileResponse;
        return data.profile_picture_url || null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "ابتدا وارد حساب کاربری شوید." },
                { status: 401 },
            );
        }

        const accounts = await prisma.instagramAccount.findMany({
            where: { userId: session.user.id },
            orderBy: [{ isConnected: "desc" }, { updatedAt: "desc" }],
            select: {
                id: true,
                igUserId: true,
                igUsername: true,
                accessToken: true,
                isConnected: true,
            },
        });

        const result = await Promise.all(
            accounts.map(async (account) => ({
                id: account.id,
                igUserId: account.igUserId,
                igUsername: account.igUsername,
                username: account.igUsername,
                isConnected: account.isConnected,
                profilePictureUrl: account.isConnected
                    ? await getProfilePicture(account.accessToken)
                    : null,
            })),
        );

        return NextResponse.json({
            success: true,
            accounts: result,
        });
    } catch (error) {
        console.error("[Instagram Accounts]", error);

        return NextResponse.json(
            { success: false, error: "خطا در دریافت اکانت‌های Instagram." },
            { status: 500 },
        );
    }
}
