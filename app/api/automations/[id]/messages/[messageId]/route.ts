import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

/**
 * GET /api/automations/[id]/messages/[messageId]
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
  }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
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
      include: {
        quickReplies: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            nextMessage: true,
          },
        },
        showcase: {
          include: {
            items: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
        form: {
          include: {
            fields: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "پیام پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error(
      "GET /api/automations/[id]/messages/[messageId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در دریافت پیام" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automations/[id]/messages/[messageId]
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
  }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { id, messageId } = await params;

    const existingMessage =
      await prisma.automationMessage.findFirst({
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
        { error: "پیام پیدا نشد" },
        { status: 404 }
      );
    }

    const automation = await prisma.automation.findUnique({
      where: {
        id,
      },
      select: {
        instagramAccountId: true,
      },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation پیدا نشد" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      messageType,
      text,
      mediaUrl,
      mediaId,
      showcaseId,
      formId,
      order,
    } = body;

    const nextMessageType =
      messageType !== undefined
        ? messageType
        : existingMessage.messageType;

    if (!isValidMessageType(nextMessageType)) {
      return NextResponse.json(
        { error: "نوع پیام نامعتبر است" },
        { status: 400 }
      );
    }

    /**
     * مقدارهای نهایی
     */
    const nextText =
      text !== undefined
        ? typeof text === "string" && text.trim()
          ? text.trim()
          : null
        : existingMessage.text;

    const nextMediaUrl =
      mediaUrl !== undefined
        ? typeof mediaUrl === "string" && mediaUrl.trim()
          ? mediaUrl.trim()
          : null
        : existingMessage.mediaUrl;

    const nextMediaId =
      mediaId !== undefined
        ? typeof mediaId === "string" && mediaId.trim()
          ? mediaId.trim()
          : null
        : existingMessage.mediaId;

    const nextShowcaseId =
      nextMessageType === "SHOWCASE"
        ? showcaseId !== undefined
          ? showcaseId || null
          : existingMessage.showcaseId
        : null;

    const nextFormId =
      nextMessageType === "FORM"
        ? formId !== undefined
          ? formId || null
          : existingMessage.formId
        : null;

    /**
     * TEXT validation
     */
    if (nextMessageType === "TEXT" && !nextText) {
      return NextResponse.json(
        { error: "برای پیام متنی، text الزامی است" },
        { status: 400 }
      );
    }

    /**
     * Media validation
     */
    if (
      ["IMAGE", "VIDEO", "AUDIO"].includes(nextMessageType) &&
      !nextMediaUrl &&
      !nextMediaId
    ) {
      return NextResponse.json(
        {
          error:
            "برای پیام رسانه‌ای باید mediaUrl یا mediaId وجود داشته باشد",
        },
        { status: 400 }
      );
    }

    /**
     * Showcase validation
     */
    if (nextMessageType === "SHOWCASE") {
      if (!nextShowcaseId) {
        return NextResponse.json(
          {
            error:
              "برای پیام SHOWCASE، showcaseId الزامی است",
          },
          { status: 400 }
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
            error:
              "ویترین پیدا نشد یا متعلق به این اکانت نیست",
          },
          { status: 404 }
        );
      }
    }

    /**
     * Form validation
     */
    if (nextMessageType === "FORM") {
      if (!nextFormId) {
        return NextResponse.json(
          {
            error: "برای پیام FORM، formId الزامی است",
          },
          { status: 400 }
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
            error:
              "فرم پیدا نشد یا متعلق به این اکانت نیست",
          },
          { status: 404 }
        );
      }
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
        text: nextText,
        mediaUrl: nextMediaUrl,
        mediaId: nextMediaId,
        showcaseId: nextShowcaseId,
        formId: nextFormId,
        ...(order !== undefined &&
        typeof order === "number" &&
        Number.isInteger(order)
          ? { order }
          : {}),
      },
      include: {
        quickReplies: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            nextMessage: true,
          },
        },
        showcase: {
          include: {
            items: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
        form: {
          include: {
            fields: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error(
      "PATCH /api/automations/[id]/messages/[messageId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در ویرایش پیام" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automations/[id]/messages/[messageId]
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
  }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
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
        { error: "پیام پیدا نشد" },
        { status: 404 }
      );
    }

    await prisma.automationMessage.delete({
      where: {
        id: messageId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "پیام با موفقیت حذف شد",
    });
  } catch (error) {
    console.error(
      "DELETE /api/automations/[id]/messages/[messageId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در حذف پیام" },
      { status: 500 }
    );
  }
}