import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_QUICK_REPLIES = 13;
const MAX_TITLE_LENGTH = 20;
const MAX_PAYLOAD_LENGTH = 1000;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function getOwnedMessage({
  automationId,
  messageId,
  userId,
}: {
  automationId: string;
  messageId: string;
  userId: string;
}) {
  return prisma.automationMessage.findFirst({
    where: {
      id: messageId,

      automationId,

      automation: {
        instagramAccount: {
          userId,
        },
      },
    },
  });
}

/**
 * GET
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      messageId: string;
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

    const { id, messageId } = await params;

    const message = await getOwnedMessage({
      automationId: id,
      messageId,
      userId: session.user.id,
    });

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "پیام پیدا نشد",
        },
        { status: 404 },
      );
    }

    const quickReplies = await prisma.quickReply.findMany({
      where: {
        automationMessageId: messageId,
      },

      orderBy: {
        createdAt: "asc",
      },

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
      data: quickReplies,
    });
  } catch (error) {
    console.error("GET quick replies error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطای داخلی سرور",
      },
      { status: 500 },
    );
  }
}

/**
 * POST
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      messageId: string;
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

    const { id, messageId } = await params;

    const message = await getOwnedMessage({
      automationId: id,
      messageId,
      userId: session.user.id,
    });

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "پیام پیدا نشد",
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

    const title = normalizeString(body.title);

    const payload = normalizeString(body.payload);

    const replyText =
      body.replyText !== undefined && body.replyText !== null
        ? normalizeString(body.replyText) || null
        : null;

    const nextMessageId = body.nextMessageId
      ? normalizeString(body.nextMessageId) || null
      : null;

    /**
     * Title
     */
    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "عنوان Quick Reply الزامی است",
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

    /**
     * Payload
     */
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: "payload الزامی است",
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
     * Maximum quick replies
     */
    const quickReplyCount = await prisma.quickReply.count({
      where: {
        automationMessageId: messageId,
      },
    });

    if (quickReplyCount >= MAX_QUICK_REPLIES) {
      return NextResponse.json(
        {
          success: false,
          error: `هر پیام حداکثر ${MAX_QUICK_REPLIES} Quick Reply می‌تواند داشته باشد`,
        },
        { status: 400 },
      );
    }

    /**
     * Duplicate payload
     *
     * payload باید در کل Automation یکتا باشد.
     */
    const duplicatePayload = await prisma.quickReply.findFirst({
      where: {
        payload,

        automationMessage: {
          automationId: id,
        },
      },
    });

    if (duplicatePayload) {
      return NextResponse.json(
        {
          success: false,
          error: "این payload قبلاً در همین Automation استفاده شده است",
        },
        { status: 409 },
      );
    }

    /**
     * Next message
     */
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

      if (nextMessageId === messageId) {
        return NextResponse.json(
          {
            success: false,
            error: "Quick Reply نمی‌تواند به همان پیام خودش متصل شود",
          },
          { status: 400 },
        );
      }
    }

    const quickReply = await prisma.quickReply.create({
      data: {
        automationMessageId: messageId,

        title,

        payload,

        replyText,

        nextMessageId,
      },

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

    return NextResponse.json(
      {
        success: true,
        message: "Quick Reply با موفقیت ساخته شد",
        data: quickReply,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST quick reply error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "ساخت Quick Reply ناموفق بود",
      },
      { status: 500 },
    );
  }
}
