import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ======================================================
// PATCH
// ======================================================

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

    const {
      id,
      messageId,
      quickReplyId,
    } = await params;

    // --------------------------------------------------
    // CHECK QUICK REPLY OWNERSHIP
    // --------------------------------------------------

    const quickReply =
      await prisma.quickReply.findFirst({
        where: {
          id: quickReplyId,

          automationMessageId: messageId,

          automationMessage: {
            automationId: id,

            automation: {
              instagramAccount: {
                userId: session.user.id,
              },
            },
          },
        },
      });

    if (!quickReply) {
      return NextResponse.json(
        {
          success: false,
          message: "Quick Reply پیدا نشد.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // BODY
    // --------------------------------------------------

    const body = await request.json();

    const data: {
      title?: string;
      payload?: string;
      replyText?: string | null;
      nextMessageId?: string | null;
    } = {};

    // --------------------------------------------------
    // TITLE
    // --------------------------------------------------

    if (body.title !== undefined) {
      const title =
        typeof body.title === "string"
          ? body.title.trim()
          : "";

      if (!title) {
        return NextResponse.json(
          {
            success: false,
            message:
              "عنوان Quick Reply نمی‌تواند خالی باشد.",
          },
          { status: 400 },
        );
      }

      data.title = title;
    }

    // --------------------------------------------------
    // PAYLOAD
    // --------------------------------------------------

    if (body.payload !== undefined) {
      const payload =
        typeof body.payload === "string"
          ? body.payload.trim()
          : "";

      if (!payload) {
        return NextResponse.json(
          {
            success: false,
            message:
              "payload نمی‌تواند خالی باشد.",
          },
          { status: 400 },
        );
      }

      data.payload = payload;
    }

    // --------------------------------------------------
    // REPLY TEXT
    // --------------------------------------------------

    if (body.replyText !== undefined) {
      data.replyText =
        body.replyText
          ? String(body.replyText).trim()
          : null;
    }

    // --------------------------------------------------
    // NEXT MESSAGE
    // --------------------------------------------------

    if (
      body.nextMessageId !== undefined
    ) {
      const nextMessageId =
        body.nextMessageId
          ? String(
              body.nextMessageId,
            ).trim()
          : null;

      if (
        nextMessageId ===
        quickReply.automationMessageId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Quick Reply نمی‌تواند به پیام فعلی متصل شود.",
          },
          { status: 400 },
        );
      }

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
      }

      data.nextMessageId =
        nextMessageId;
    }

    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    const updated =
      await prisma.quickReply.update({
        where: {
          id: quickReplyId,
        },

        data,

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
      message:
        "Quick Reply با موفقیت ویرایش شد.",
      data: updated,
    });
  } catch (error) {
    console.error(
      "PATCH quick reply error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ویرایش Quick Reply ناموفق بود.",
      },
      { status: 500 },
    );
  }
}

// ======================================================
// DELETE
// ======================================================

export async function DELETE(
  _request: NextRequest,
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

    const {
      id,
      messageId,
      quickReplyId,
    } = await params;

    // --------------------------------------------------
    // CHECK OWNERSHIP
    // --------------------------------------------------

    const quickReply =
      await prisma.quickReply.findFirst({
        where: {
          id: quickReplyId,

          automationMessageId: messageId,

          automationMessage: {
            automationId: id,

            automation: {
              instagramAccount: {
                userId: session.user.id,
              },
            },
          },
        },
      });

    if (!quickReply) {
      return NextResponse.json(
        {
          success: false,
          message: "Quick Reply پیدا نشد.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // DELETE
    // --------------------------------------------------

    await prisma.quickReply.delete({
      where: {
        id: quickReplyId,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Quick Reply با موفقیت حذف شد.",
    });
  } catch (error) {
    console.error(
      "DELETE quick reply error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حذف Quick Reply ناموفق بود.",
      },
      { status: 500 },
    );
  }
}