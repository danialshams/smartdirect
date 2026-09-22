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
import { proxyInstagramMediaUrl } from "@/lib/instagram/media-proxy";

export const dynamic = "force-dynamic";

const MEDIA_LIMIT = 20;
const COMMENTS_LIMIT = 50;
const COMMENT_BATCH_SIZE = 4;

async function syncMediaComments(
  userId: string,
  mediaId: string,
  comments: InstagramMediaComment[],
  accessToken: string,
) {
  for (const comment of comments) {
    if (!comment.id || !comment.text) continue;

    let username = comment.username;

    // With Instagram Login, the comments edge can omit the username.
    // Fetch the individual comment as a fallback so the UI does not
    // display the generic "instagram-user" label when Meta provides
    // the commenter identity on the comment object.
    if (!username) {
      try {
        const commentDetails = await getInstagramComment(
          comment.id,
          accessToken,
        );

        username =
          commentDetails.username ??
          commentDetails.from?.username ??
          undefined;
      } catch (error) {
        console.warn(
          "[Unanswered Comments] Comment username lookup failed:",
          {
            commentId: comment.id,
            error,
          },
        );
      }
    }

    await prisma.comment.upsert({
      where: {
        igCommentId: comment.id,
      },
      create: {
        userId,
        igMediaId: mediaId,
        igCommentId: comment.id,
        text: comment.text,
        username: username ?? "instagram-user",
        createdAt: comment.timestamp
          ? new Date(comment.timestamp)
          : undefined,
      },
      update: {
        text: comment.text,
        ...(username ? { username } : {}),
      },
    });
  }
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

    const media = mediaResult.data ?? [];
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
              commentsResult.data ?? [],
              accessToken,
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

    const storedComments = await prisma.comment.findMany({
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

    await Promise.all(
      storedComments.map(async (comment) => {
        try {
          const metaComment = await getInstagramComment(
            comment.igCommentId,
            accessToken,
          );
          const scopedUserId = metaComment.from?.id;

          if (!scopedUserId) return;

          const profile = await getInstagramUserProfile(
            scopedUserId,
            accessToken,
          );

          if (profile.profile_pic) {
            commentProfilePictures.set(comment.id, profile.profile_pic);
          }
        } catch {
          // A commenter profile picture is optional in Meta's API.
        }
      }),
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
