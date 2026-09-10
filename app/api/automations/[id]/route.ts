import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getOwnedAutomation(
  automationId: string,
  userId: string,
) {
  return prisma.automation.findFirst({
    where: {
      id: automationId,
      instagramAccount: {
        userId,
      },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
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

    const { id } = await context.params;

    const automation = await getOwnedAutomation(
      id,
      session.user.id,
    );

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          message: "اتوماسیون پیدا نشد.",
        },
        { status: 404 },
      );
    }

    const body = await request.json();

    const data: {
      keyword?: string;
      commentReplyText?: string;
      replyText?: string;
      isActive?: boolean;
    } = {};

    if (typeof body.keyword === "string") {
      const keyword = body.keyword.trim();

      if (!keyword) {
        return NextResponse.json(
          {
            success: false,
            message: "کلمه فعال‌کننده نمی‌تواند خالی باشد.",
          },
          { status: 400 },
        );
      }

      if (keyword !== automation.keyword) {
        const duplicate = await prisma.automation.findUnique({
          where: {
            instagramAccountId_keyword: {
              instagramAccountId:
                automation.instagramAccountId,
              keyword,
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicate && duplicate.id !== automation.id) {
          return NextResponse.json(
            {
              success: false,
              message:
                "این کلمه قبلاً برای این پیج استفاده شده است.",
            },
            { status: 409 },
          );
        }
      }

      data.keyword = keyword;
    }

    if (typeof body.commentReplyText === "string") {
      const value = body.commentReplyText.trim();

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message: "متن پاسخ کامنت نمی‌تواند خالی باشد.",
          },
          { status: 400 },
        );
      }

      data.commentReplyText = value;
    }

    if (typeof body.replyText === "string") {
      const value = body.replyText.trim();

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message: "متن دایرکت نمی‌تواند خالی باشد.",
          },
          { status: 400 },
        );
      }

      data.replyText = value;
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updatedAutomation = await prisma.automation.update({
      where: {
        id: automation.id,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      data: updatedAutomation,
    });
  } catch (error) {
    console.error("PATCH /api/automations/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "ویرایش اتوماسیون با خطا مواجه شد.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
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

    const { id } = await context.params;

    const automation = await getOwnedAutomation(
      id,
      session.user.id,
    );

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          message: "اتوماسیون پیدا نشد.",
        },
        { status: 404 },
      );
    }

    await prisma.automation.delete({
      where: {
        id: automation.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "اتوماسیون حذف شد.",
    });
  } catch (error) {
    console.error("DELETE /api/automations/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حذف اتوماسیون با خطا مواجه شد.",
      },
      { status: 500 },
    );
  }
}