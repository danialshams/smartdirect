import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_TITLE_LENGTH = 20;
const MAX_PAYLOAD_LENGTH = 1000;

async function getOwnedQuickReply({
  automationId,
  messageId,
  quickReplyId,
  userId,
}: {
  automationId: string;
  messageId: string;
  quickReplyId: string;
  userId: string;
}) {
  return prisma.quickReply.findFirst({
    where: {
      id: quickReplyId,

      automationMessageId: messageId,

      automationMessage: {
        automationId,

        automation: {
          instagramAccount: {
            userId,
          },
        },
      },
    },
  });
}

/**
 * PATCH
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      messageId: string;
      quickReplyId: string;
    }>;
  },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "احراز هویت انجام نشده است",
        },
        { status: 401 },
      );
    }

    const { id, messageId, quickReplyId } = await params;

    const quickReply = await getOwnedQuickReply({
      automationId: id,
      messageId,
      quickReplyId,
      userId: session.user.id,
    });

    if (!quickReply) {
      return NextResponse.json(
        {
          success: false,
          error: "Quick Reply پیدا نشد",
        },
        { status: 404 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "اطلاعات Quick Reply نامعتبر است",
        },
        { status: 400 },
      );
    }

    const data: {
      title?: string;
      payload?: string;
      replyText?: string | null;
      nextMessageId?: string | null;
    } = {};

    /**
     * TITLE
     */
    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";

      if (!title) {
        return NextResponse.json(
          {
            success: false,
            error: "عنوان Quick Reply نمی‌تواند خالی باشد",
          },
          { status: 400 },
        );
      }

      if (title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            error: `عنوان Quick Reply حداکثر ${MAX_TITLE_LENGTH} کاراکتر می‌تواند باشد`,
          },
          { status: 400 },
        );
      }

      data.title = title;
    }

    /**
     * PAYLOAD
     */
    if (body.payload !== undefined) {
      const payload =
        typeof body.payload === "string" ? body.payload.trim() : "";

      if (!payload) {
        return NextResponse.json(
          {
            success: false,
            error: "payload نمی‌تواند خالی باشد",
          },
          { status: 400 },
        );
      }

      if (payload.length > MAX_PAYLOAD_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            error: `payload حداکثر ${MAX_PAYLOAD_LENGTH} کاراکتر می‌تواند باشد`,
          },
          { status: 400 },
        );
      }

      /**
       * بررسی payload تکراری
       */
      const duplicate = await prisma.quickReply.findFirst({
        where: {
          payload,

          id: {
            not: quickReplyId,
          },

          automationMessage: {
            automationId: id,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: "این payload قبلاً در همین Automation استفاده شده است",
          },
          { status: 409 },
        );
      }

      data.payload = payload;
    }

    /**
     * REPLY TEXT
     */
    if (body.replyText !== undefined) {
      data.replyText =
        body.replyText === null
          ? null
          : typeof body.replyText === "string"
            ? body.replyText.trim() || null
            : null;
    }

    /**
     * NEXT MESSAGE
     */
    if (body.nextMessageId !== undefined) {
      const nextMessageId = body.nextMessageId
        ? String(body.nextMessageId).trim() || null
        : null;

      if (nextMessageId === messageId) {
        return NextResponse.json(
          {
            success: false,
            error: "Quick Reply نمی‌تواند به پیام فعلی متصل شود",
          },
          { status: 400 },
        );
      }

      if (nextMessageId) {
        const nextMessage = await prisma.automationMessage.findFirst({
          where: {
            id: nextMessageId,

            automationId: id,
          },
        });

        if (!nextMessage) {
          return NextResponse.json(
            {
              success: false,
              error: "پیام مقصد متعلق به این Automation نیست",
            },
            { status: 400 },
          );
        }
      }

      data.nextMessageId = nextMessageId;
    }

    const updated = await prisma.quickReply.update({
      where: {
        id: quickReplyId,
      },

      data,

      include: {
        nextMessage: {
          select: {
            id: true,
            messageType: true,
            text: true,
            mediaUrl: true,
            mediaId: true,
            showcaseId: true,
            formId: true,
            order: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Quick Reply با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (error) {
    console.error("PATCH quick reply error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "ویرایش Quick Reply ناموفق بود",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      messageId: string;
      quickReplyId: string;
    }>;
  },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "احراز هویت انجام نشده است",
        },
        { status: 401 },
      );
    }

    const { id, messageId, quickReplyId } = await params;

    const quickReply = await getOwnedQuickReply({
      automationId: id,
      messageId,
      quickReplyId,
      userId: session.user.id,
    });

    if (!quickReply) {
      return NextResponse.json(
        {
          success: false,
          error: "Quick Reply پیدا نشد",
        },
        { status: 404 },
      );
    }

    await prisma.quickReply.delete({
      where: {
        id: quickReplyId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Quick Reply با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("DELETE quick reply error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "حذف Quick Reply ناموفق بود",
      },
      { status: 500 },
    );
  }
}
