import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import {
  getInstagramMedia,
  getInstagramMediaComments,
  getInstagramComment,
  getInstagramUserProfile,
  type InstagramMediaComment,
} from "@/lib/instagram/api";
import {
  proxyInstagramMediaUrl,
  proxyInstagramParticipantProfileUrl,
  proxyInstagramAccountProfileUrl,
} from "@/lib/instagram/media-proxy";

export const dynamic = "force-dynamic";

const MEDIA_LIMIT = 20;
const COMMENTS_LIMIT = 50;
const COMMENT_BATCH_SIZE = 8;

async function syncMediaComments(
  userId: string,
  mediaId: string,
  comments: InstagramMediaComment[],
) {
  await Promise.all(
    comments
      .filter((comment) => Boolean(comment.id && comment.text))
      .map((comment) =>
        prisma.comment.upsert({
          where: { igCommentId: comment.id },
          create: {
            userId,
            igMediaId: mediaId,
            igCommentId: comment.id,
            text: comment.text,
            username: comment.username ?? comment.from?.username ?? "instagram-user",
            createdAt: comment.timestamp ? new Date(comment.timestamp) : undefined,
          },
          update: {
            text: comment.text,
            username: comment.username ?? comment.from?.username ?? undefined,
          },
        }),
      ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "احراز هویت انجام نشده است." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const instagramAccountId = searchParams.get("instagramAccountId");
    const requestedMediaId = searchParams.get("mediaId");

    if (!instagramAccountId) {
      return NextResponse.json(
        { success: false, message: "instagramAccountId الزامی است." },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
        isConnected: true,
      },
      select: {
        id: true,
        igUserId: true,
        igUsername: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, message: "اکانت Instagram پیدا نشد." },
        { status: 404 },
      );
    }

    const accessToken = await getValidInstagramAccessToken(account.id);
    const mediaResult = await getInstagramMedia(
      account.igUserId,
      accessToken,
      MEDIA_LIMIT,
    );

    const media = (mediaResult.data ?? []).filter(
      (item) => !requestedMediaId || item.id === requestedMediaId,
    );
    const syncedMediaIds: string[] = [];

    for (let index = 0; index < media.length; index += COMMENT_BATCH_SIZE) {
      const batch = media.slice(index, index + COMMENT_BATCH_SIZE);

      await Promise.all(
        batch.map(async (item) => {
          try {
            const commentsResult = await getInstagramMediaComments(
              item.id,
              accessToken,
              COMMENTS_LIMIT,
            );

            await syncMediaComments(
              session.user.id,
              item.id,
              (commentsResult.data ?? []).filter((comment) => {
                const ownById = comment.from?.id === account.igUserId;
                const ownByUsername =
                  comment.username?.toLowerCase() === account.igUsername.toLowerCase() ||
                  comment.from?.username?.toLowerCase() === account.igUsername.toLowerCase();
                return !ownById && !ownByUsername;
              }),
            );

            syncedMediaIds.push(item.id);
          } catch (error) {
            console.error(
              "[Unanswered Comments] Media comments sync failed:",
              {
                instagramAccountId: account.id,
                mediaId: item.id,
                error,
              },
            );
          }
        }),
      );
    }

    let storedComments = await prisma.comment.findMany({
      where: {
        userId: session.user.id,
        replied: false,
        igMediaId: { in: media.map((item) => item.id) },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const commentProfilePictures = new Map<string, string>();
    const ownCommentIds = new Set<string>();

    // Only inspect a small number of recent comments per media for profile
    // metadata. The previous implementation fetched Meta comment details and
    // user profiles for every stored unanswered comment, which made this
    // page unnecessarily slow as comment volume grew.
    const profileCandidates = new Map<string, typeof storedComments[number]>();
    for (const comment of storedComments) {
      const isOwnByUsername =
        comment.username.toLowerCase() === account.igUsername.toLowerCase();
      if (isOwnByUsername) {
        ownCommentIds.add(comment.id);
        continue;
      }

      const key = comment.igMediaId;
      const existing = [...profileCandidates.values()].filter(
        (candidate) => candidate.igMediaId === key,
      );
      if (existing.length < 3) {
        profileCandidates.set(comment.id, comment);
      }
    }

    await Promise.all(
      [...profileCandidates.values()].map(async (comment) => {
        try {
          const metaComment = await getInstagramComment(comment.igCommentId, accessToken);
          const scopedUserId = metaComment.from?.id;
          if (!scopedUserId) return;

          const ownById = scopedUserId === account.igUserId;
          const ownByUsername =
            metaComment.username?.toLowerCase() === account.igUsername.toLowerCase() ||
            metaComment.from?.username?.toLowerCase() === account.igUsername.toLowerCase();

          if (ownById || ownByUsername) {
            ownCommentIds.add(comment.id);
            return;
          }

          const profile = await getInstagramUserProfile(scopedUserId, accessToken);
          if (profile.profile_pic) {
            commentProfilePictures.set(
              comment.id,
              proxyInstagramParticipantProfileUrl(account.id, scopedUserId),
            );
          }
        } catch {
          // Profile metadata is optional and must never block the comments page.
        }
      }),
    );

    storedComments = storedComments.filter(
      (comment) => !ownCommentIds.has(comment.id),
    );

    const mediaById = new Map(
      media.map((item) => [
        item.id,
        {
          id: item.id,
          caption: item.caption ?? null,
          mediaType: item.media_type ?? null,
          mediaProductType: item.media_product_type ?? null,
          mediaUrl: proxyInstagramMediaUrl(item.media_url ?? null),
          thumbnailUrl: proxyInstagramMediaUrl(item.thumbnail_url ?? null),
          permalink: item.permalink ?? null,
          timestamp: item.timestamp ?? null,
        },
      ]),
    );

    const grouped = new Map<
      string,
      {
        media: NonNullable<ReturnType<typeof mediaById.get>>;
        comments: typeof storedComments;
      }
    >();

    for (const comment of storedComments) {
      const mediaItem = mediaById.get(comment.igMediaId);
      if (!mediaItem) continue;

      const existing = grouped.get(comment.igMediaId);

      if (existing) {
        existing.comments.push(comment);
      } else {
        grouped.set(comment.igMediaId, {
          media: mediaItem,
          comments: [comment],
        });
      }
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        username: account.igUsername,
      },
      posts: Array.from(grouped.values()).map((group) => ({
        ...group,
        comments: group.comments.map((comment) => ({
          ...comment,
          profilePictureUrl:
            commentProfilePictures.get(comment.id) ?? null,
        })),
      })),
      meta: {
        syncedMediaCount: syncedMediaIds.length,
        scannedMediaCount: media.length,
      },
    });
  } catch (error) {
    console.error("GET /api/instagram/unanswered-comments error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "دریافت کامنت‌های پاسخ داده نشده ناموفق بود.",
      },
      { status: 500 },
    );
  }
}
