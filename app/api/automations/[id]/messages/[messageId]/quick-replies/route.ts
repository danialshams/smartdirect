import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

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

    const nextMessageId = null;
    const destinationType = ["TEXT", "FORM", "SHOWCASE", "IMAGE", "VIDEO", "AUDIO"].includes(body.destinationType) ? body.destinationType : null;
    const destinationText = normalizeString(body.destinationText) || null;
    const destinationFormId = normalizeString(body.destinationFormId) || null;
    const destinationShowcaseId = normalizeString(body.destinationShowcaseId) || null;
    const destinationMediaUrl = normalizeString(body.destinationMediaUrl) || null;
    const destinationMediaId = normalizeString(body.destinationMediaId) || null;
    const destinationQuestion = normalizeString(body.destinationQuestion) || null;
    const destinationQuickReplies = Array.isArray(body.destinationQuickReplies) ? body.destinationQuickReplies : [];

    if (!destinationType) return NextResponse.json({ success: false, error: "نوع مقصد پاسخ الزامی است" }, { status: 400 });
    if (destinationType === "TEXT" && !destinationText) return NextResponse.json({ success: false, error: "متن مقصد الزامی است" }, { status: 400 });
    if (destinationType === "FORM" && (!destinationQuestion || destinationQuickReplies.length === 0)) return NextResponse.json({ success: false, error: "سؤال و حداقل یک جواب برای فرم مقصد الزامی است" }, { status: 400 });
    if (destinationType === "SHOWCASE" && !destinationShowcaseId) return NextResponse.json({ success: false, error: "ویترین مقصد الزامی است" }, { status: 400 });
    if (["IMAGE", "VIDEO", "AUDIO"].includes(destinationType) && !destinationMediaUrl && !destinationMediaId) return NextResponse.json({ success: false, error: "فایل مقصد الزامی است" }, { status: 400 });

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

    const quickReply = await prisma.quickReply.create({
      data: {
        automationMessageId: messageId,

        title,

        payload,

        replyText: JSON.stringify({
          type: destinationType,
          text: destinationText,
          formId: destinationFormId,
          showcaseId: destinationShowcaseId,
          mediaUrl: destinationMediaUrl,
          mediaId: destinationMediaId,
          question: destinationQuestion,
          quickReplies: destinationQuickReplies,
        }),

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

    await invalidateAutomationCache(id);
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
