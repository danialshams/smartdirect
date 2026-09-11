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
 * GET /api/automations/[id]/messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const automation = await prisma.automation.findFirst({
      where: {
        id,
        instagramAccount: {
          userId: session.user.id,
        },
      },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation پیدا نشد" },
        { status: 404 }
      );
    }

    const messages = await prisma.automationMessage.findMany({
      where: {
        automationId: id,
      },
      orderBy: {
        order: "asc",
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

    return NextResponse.json(messages);
  } catch (error) {
    console.error(
      "GET /api/automations/[id]/messages error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در دریافت پیام‌ها" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations/[id]/messages
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const automation = await prisma.automation.findFirst({
      where: {
        id,
        instagramAccount: {
          userId: session.user.id,
        },
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
      messageType = "TEXT",
      text,
      mediaUrl,
      mediaId,
      showcaseId,
      formId,
      order,
    } = body;

    /**
     * بررسی Message Type
     */
    if (!isValidMessageType(messageType)) {
      return NextResponse.json(
        { error: "نوع پیام نامعتبر است" },
        { status: 400 }
      );
    }

    /**
     * TEXT
     */
    if (messageType === "TEXT") {
      if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json(
          { error: "برای پیام متنی، text الزامی است" },
          { status: 400 }
        );
      }
    }

    /**
     * Media
     */
    if (
      ["IMAGE", "VIDEO", "AUDIO"].includes(messageType) &&
      !mediaUrl &&
      !mediaId
    ) {
      return NextResponse.json(
        {
          error:
            "برای پیام رسانه‌ای باید mediaUrl یا mediaId ارسال شود",
        },
        { status: 400 }
      );
    }

    /**
     * Showcase
     */
    if (messageType === "SHOWCASE") {
      if (!showcaseId) {
        return NextResponse.json(
          { error: "برای پیام SHOWCASE، showcaseId الزامی است" },
          { status: 400 }
        );
      }

      const showcase = await prisma.showcase.findFirst({
        where: {
          id: showcaseId,
          userId: session.user.id,
          instagramAccountId: automation.instagramAccountId,
        },
      });

      if (!showcase) {
        return NextResponse.json(
          { error: "ویترین پیدا نشد یا متعلق به این اکانت نیست" },
          { status: 404 }
        );
      }
    }

    /**
     * Form
     */
    if (messageType === "FORM") {
      if (!formId) {
        return NextResponse.json(
          { error: "برای پیام FORM، formId الزامی است" },
          { status: 400 }
        );
      }

      const form = await prisma.form.findFirst({
        where: {
          id: formId,
          userId: session.user.id,
          instagramAccountId: automation.instagramAccountId,
        },
      });

      if (!form) {
        return NextResponse.json(
          { error: "فرم پیدا نشد یا متعلق به این اکانت نیست" },
          { status: 404 }
        );
      }
    }

    /**
     * پیدا کردن Order
     */
    let messageOrder: number;

    if (typeof order === "number" && Number.isInteger(order)) {
      messageOrder = order;
    } else {
      const lastMessage = await prisma.automationMessage.findFirst({
        where: {
          automationId: id,
        },
        orderBy: {
          order: "desc",
        },
      });

      messageOrder = lastMessage ? lastMessage.order + 1 : 0;
    }

    /**
     * ساخت Message
     */
    const message = await prisma.automationMessage.create({
      data: {
        automationId: id,
        messageType,
        text:
          typeof text === "string" && text.trim()
            ? text.trim()
            : null,
        mediaUrl:
          typeof mediaUrl === "string" && mediaUrl.trim()
            ? mediaUrl.trim()
            : null,
        mediaId:
          typeof mediaId === "string" && mediaId.trim()
            ? mediaId.trim()
            : null,
        showcaseId:
          messageType === "SHOWCASE" ? showcaseId : null,
        formId: messageType === "FORM" ? formId : null,
        order: messageOrder,
      },
      include: {
        quickReplies: true,
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

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/automations/[id]/messages error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در ساخت پیام" },
      { status: 500 }
    );
  }
}