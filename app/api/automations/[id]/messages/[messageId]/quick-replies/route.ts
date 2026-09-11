import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ======================================================
// GET
// ======================================================

export async function GET(
  _request: NextRequest,
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
    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "احراز هویت انجام نشده است.",
        },
        { status: 401 },
      );
    }

    const { id, messageId } = await params;

    // --------------------------------------------------
    // CHECK MESSAGE
    // --------------------------------------------------

    const message =
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

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message: "پیام پیدا نشد.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // GET QUICK REPLIES
    // --------------------------------------------------

    const quickReplies =
      await prisma.quickReply.findMany({
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
              text: true,
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
    console.error(
      "GET quick replies error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "خطای داخلی سرور.",
      },
      { status: 500 },
    );
  }
}

// ======================================================
// POST
// ======================================================

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
    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "احراز هویت انجام نشده است.",
        },
        { status: 401 },
      );
    }

    const { id, messageId } = await params;

    // --------------------------------------------------
    // CHECK MESSAGE OWNERSHIP
    // --------------------------------------------------

    const message =
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

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message: "پیام پیدا نشد.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // BODY
    // --------------------------------------------------

    const body = await request.json();

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const payload =
      typeof body.payload === "string"
        ? body.payload.trim()
        : "";

    const replyText =
      body.replyText !== undefined &&
      body.replyText !== null
        ? String(body.replyText).trim()
        : null;

    const nextMessageId =
      body.nextMessageId
        ? String(body.nextMessageId).trim()
        : null;

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "عنوان Quick Reply الزامی است.",
        },
        { status: 400 },
      );
    }

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          message: "payload الزامی است.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // CHECK NEXT MESSAGE
    // --------------------------------------------------

    if (nextMessageId) {
      const nextMessage =
        await prisma.automationMessage.findFirst({
          where: {
            id: nextMessageId,

            automationId: id,
          },
        });

      if (!nextMessage) {
        return NextResponse.json(
          {
            success: false,
            message:
              "پیام مقصد متعلق به این Automation نیست.",
          },
          { status: 400 },
        );
      }

      // جلوگیری از اینکه یک Quick Reply
      // به خودش اشاره کند
      if (nextMessageId === messageId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Quick Reply نمی‌تواند به همان پیام خودش متصل شود.",
          },
          { status: 400 },
        );
      }
    }

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const quickReply =
      await prisma.quickReply.create({
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
              text: true,
              order: true,
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Quick Reply با موفقیت ساخته شد.",
        data: quickReply,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST quick reply error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ساخت Quick Reply ناموفق بود.",
      },
      { status: 500 },
    );
  }
}