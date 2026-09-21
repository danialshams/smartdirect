import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

const validMessageTypes = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "SHOWCASE",
  "FORM",
] as const;

type MessageType = (typeof validMessageTypes)[number];

function isValidMessageType(value: unknown): value is MessageType {
  return (
    typeof value === "string" &&
    validMessageTypes.includes(value as MessageType)
  );
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

const messageInclude = {
  quickReplies: {
    orderBy: {
      createdAt: "asc" as const,
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
  },

  showcase: {
    include: {
      items: {
        where: {
          isActive: true,
        },

        orderBy: {
          order: "asc" as const,
        },
      },
    },
  },

  form: {
    include: {
      fields: {
        orderBy: {
          order: "asc" as const,
        },
      },
    },
  },
};

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

    const message = await prisma.automationMessage.findFirst({
      where: {
        id: messageId,

        automationId: id,

        automation: {
          instagramAccount: {
            userId: session.user.id,
          },
        },
      },

      include: messageInclude,
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

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("GET message error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در دریافت پیام",
      },
      { status: 500 },
    );
  }
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

    const existingMessage = await prisma.automationMessage.findFirst({
      where: {
        id: messageId,

        automationId: id,

        automation: {
          instagramAccount: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!existingMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "پیام پیدا نشد",
        },
        { status: 404 },
      );
    }

    const automation = await prisma.automation.findFirst({
      where: {
        id,

        instagramAccount: {
          userId: session.user.id,
        },
      },

      select: {
        id: true,
        instagramAccountId: true,
      },
    });

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation پیدا نشد",
        },
        { status: 404 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "اطلاعات پیام نامعتبر است",
        },
        { status: 400 },
      );
    }

    const { messageType, text, mediaUrl, mediaId, showcaseId, formId, order } =
      body;

    const nextMessageType =
      messageType !== undefined ? messageType : existingMessage.messageType;

    if (!isValidMessageType(nextMessageType)) {
      return NextResponse.json(
        {
          success: false,
          error: "نوع پیام نامعتبر است",
        },
        { status: 400 },
      );
    }

    const nextText =
      text !== undefined ? normalizeOptionalString(text) : existingMessage.text;

    const nextMediaUrl =
      mediaUrl !== undefined
        ? normalizeOptionalString(mediaUrl)
        : existingMessage.mediaUrl;

    const nextMediaId =
      mediaId !== undefined
        ? normalizeOptionalString(mediaId)
        : existingMessage.mediaId;

    const nextShowcaseId =
      nextMessageType === "SHOWCASE"
        ? showcaseId !== undefined
          ? normalizeOptionalString(showcaseId)
          : existingMessage.showcaseId
        : null;

    const nextFormId =
      nextMessageType === "FORM"
        ? formId !== undefined
          ? normalizeOptionalString(formId)
          : existingMessage.formId
        : null;

    /**
     * TEXT
     */
    if (nextMessageType === "TEXT" && !nextText) {
      return NextResponse.json(
        {
          success: false,
          error: "برای پیام متنی، text الزامی است",
        },
        { status: 400 },
      );
    }

    /**
     * Media
     */
    if (
      ["IMAGE", "VIDEO", "AUDIO"].includes(nextMessageType) &&
      !nextMediaUrl &&
      !nextMediaId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "برای پیام رسانه‌ای باید mediaUrl یا mediaId وجود داشته باشد",
        },
        { status: 400 },
      );
    }

    /**
     * Showcase
     */
    if (nextMessageType === "SHOWCASE") {
      if (!nextShowcaseId) {
        return NextResponse.json(
          {
            success: false,
            error: "برای پیام SHOWCASE، showcaseId الزامی است",
          },
          { status: 400 },
        );
      }

      const showcase = await prisma.showcase.findFirst({
        where: {
          id: nextShowcaseId,

          userId: session.user.id,

          instagramAccountId: automation.instagramAccountId,
        },
      });

      if (!showcase) {
        return NextResponse.json(
          {
            success: false,
            error: "ویترین پیدا نشد یا متعلق به این اکانت نیست",
          },
          { status: 404 },
        );
      }
    }

    /**
     * Form
     */
    if (nextMessageType === "FORM") {
      if (!nextFormId) {
        return NextResponse.json(
          {
            success: false,
            error: "برای پیام FORM، formId الزامی است",
          },
          { status: 400 },
        );
      }

      const form = await prisma.form.findFirst({
        where: {
          id: nextFormId,

          userId: session.user.id,

          instagramAccountId: automation.instagramAccountId,
        },
      });

      if (!form) {
        return NextResponse.json(
          {
            success: false,
            error: "فرم پیدا نشد یا متعلق به این اکانت نیست",
          },
          { status: 404 },
        );
      }
    }

    /**
     * Order
     */
    let nextOrder = existingMessage.order;

    if (order !== undefined) {
      if (typeof order !== "number" || !Number.isInteger(order) || order < 0) {
        return NextResponse.json(
          {
            success: false,
            error: "order باید یک عدد صحیح صفر یا بزرگ‌تر باشد",
          },
          { status: 400 },
        );
      }

      nextOrder = order;
    }

    /**
     * Update
     */
    const message = await prisma.automationMessage.update({
      where: {
        id: messageId,
      },

      data: {
        messageType: nextMessageType,

        text: nextMessageType === "TEXT" ? nextText : nextText,

        mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(nextMessageType)
          ? nextMediaUrl
          : null,

        mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(nextMessageType)
          ? nextMediaId
          : null,

        showcaseId: nextShowcaseId,

        formId: nextFormId,

        order: nextOrder,
      },

      include: messageInclude,
    });

    await invalidateAutomationCache(automation.instagramAccountId);

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("PATCH message error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در ویرایش پیام",
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

    const message = await prisma.automationMessage.findFirst({
      where: {
        id: messageId,

        automationId: id,

        automation: {
          instagramAccount: {
            userId: session.user.id,
          },
        },
      },
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

    await prisma.automationMessage.delete({
      where: {
        id: messageId,
      },
    });

    await invalidateAutomationCache(message.automationId);
    return NextResponse.json({
      success: true,
      message: "پیام با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("DELETE message error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در حذف پیام",
      },
      { status: 500 },
    );
  }
}
