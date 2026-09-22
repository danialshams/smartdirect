import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replyToInstagramComment } from "@/lib/instagram/api";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "احراز هویت انجام نشده است." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      instagramAccountId?: string;
      commentId?: string;
      message?: string;
    };

    const instagramAccountId = body.instagramAccountId?.trim();
    const commentId = body.commentId?.trim();
    const message = body.message?.trim();

    if (!instagramAccountId || !commentId || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "instagramAccountId، commentId و message الزامی هستند.",
        },
        { status: 400 },
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          message: "متن پاسخ نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.",
        },
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
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, message: "اکانت Instagram پیدا نشد." },
        { status: 404 },
      );
    }

    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        userId: session.user.id,
      },
      select: {
        id: true,
        igCommentId: true,
        replied: true,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, message: "کامنت پیدا نشد." },
        { status: 404 },
      );
    }

    if (comment.replied) {
      return NextResponse.json(
        { success: false, message: "این کامنت قبلاً پاسخ داده شده است." },
        { status: 409 },
      );
    }

    const accessToken = await getValidInstagramAccessToken(account.id);

    const response = await replyToInstagramComment(
      comment.igCommentId,
      accessToken,
      message,
    );

    await prisma.comment.update({
      where: {
        id: comment.id,
      },
      data: {
        replied: true,
        replyText: message,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        commentId: comment.id,
        instagramReplyId: response.id ?? null,
        replyText: message,
      },
    });
  } catch (error) {
    console.error("POST /api/instagram/comments/reply error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "ارسال پاسخ کامنت ناموفق بود.",
      },
      { status: 500 },
    );
  }
}
