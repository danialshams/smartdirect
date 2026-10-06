import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { cleanupInstagramPublishStorage } from "@/lib/instagram/publishing-media-cleanup";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";

type Story = { id?: string };

type StoriesResponse = {
  data?: Story[];
  error?: { message?: string };
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function fetchActiveStories(account: { id: string; igUserId: string }) {
  const accessToken = await getValidInstagramAccessToken(account.id);
  const url = new URL(`https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${account.igUserId}/stories`);
  url.searchParams.set("fields", "id,timestamp");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const result = (await response.json()) as StoriesResponse;

  if (!response.ok) {
    throw new Error(result.error?.message || "Instagram Stories request failed.");
  }

  return new Set((result.data ?? []).map((story) => String(story.id || "")).filter(Boolean));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.instagramAccount.findMany({
    where: { isConnected: true },
    select: { id: true, igUserId: true, igUsername: true },
  });

  const results: Array<{ accountId: string; username: string; deleted: number; success: boolean; error?: string }> = [];
  let publishedMediaDeleted = 0;
  let publishedMediaFailed = 0;

  const storageCleanup = await cleanupInstagramPublishStorage();
  const publishedMediaDeleted = storageCleanup.mediaDeleted;
  const publishedMediaFailed = storageCleanup.mediaFailed;

  for (const account of accounts) {
    try {
      const activeStoryIds = await fetchActiveStories(account);
      const candidates = await prisma.automation.findMany({
        where: {
          instagramAccountId: account.id,
          triggerType: "STORY_REPLY_KEYWORD",
          mediaId: { not: null },
        },
        select: { id: true, mediaId: true },
      });

      const expiredIds = candidates
        .filter((automation) => automation.mediaId && !activeStoryIds.has(automation.mediaId))
        .map((automation) => automation.id);

      if (expiredIds.length) {
        await prisma.automation.deleteMany({ where: { id: { in: expiredIds } } });
      }

      results.push({
        accountId: account.id,
        username: account.igUsername,
        deleted: expiredIds.length,
        success: true,
      });
    } catch (error) {
      results.push({
        accountId: account.id,
        username: account.igUsername,
        deleted: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: accounts.length,
    successful: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    deleted: results.reduce((sum, item) => sum + item.deleted, 0),
    publishedMediaDeleted,
    publishedMediaFailed,
    orphanedStorageDeleted: storageCleanup.orphanedDeleted,
    orphanedStorageFailed: storageCleanup.orphanedFailed,
    results,
  });
}
