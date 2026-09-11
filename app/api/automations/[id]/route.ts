import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalizeKeyword(value: string) {
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
    )
    .toLowerCase();
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
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

    const { id } = await params;
    const body = await request.json();

    const automation =
      await prisma.automation.findFirst({
        where: {
          id,
          instagramAccount: {
            userId: session.user.id,
          },
        },
      });

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          message: "Automation پیدا نشد.",
        },
        { status: 404 },
      );
    }

    const data: {
      mediaId?: string | null;
      keyword?: string;
      commentReplyText?: string | null;
      replyText?: string | null;
      likeComment?: boolean;
      isActive?: boolean;
    } = {};

    if (body.mediaId !== undefined) {
      data.mediaId = body.mediaId
        ? String(body.mediaId).trim()
        : null;
    }

    if (body.keyword !== undefined) {
      const keyword = normalizeKeyword(
        String(body.keyword),
      );

      if (!keyword) {
        return NextResponse.json(
          {
            success: false,
            message: "کلمه کلیدی نمی‌تواند خالی باشد.",
          },
          { status: 400 },
        );
      }

      data.keyword = keyword;
    }

    if (body.commentReplyText !== undefined) {
      data.commentReplyText =
        body.commentReplyText
          ? String(body.commentReplyText).trim()
          : null;
    }

    if (body.replyText !== undefined) {
      data.replyText =
        body.replyText
          ? String(body.replyText).trim()
          : null;
    }

    if (body.likeComment !== undefined) {
      data.likeComment =
        Boolean(body.likeComment);
    }

    if (body.isActive !== undefined) {
      data.isActive =
        Boolean(body.isActive);
    }

    const finalKeyword =
      data.keyword ?? automation.keyword;

    if (finalKeyword !== automation.keyword) {
      const duplicate =
        await prisma.automation.findFirst({
          where: {
            instagramAccountId:
              automation.instagramAccountId,
            keyword: finalKeyword,
            NOT: {
              id: automation.id,
            },
          },
        });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "این کلمه کلیدی قبلاً استفاده شده است.",
          },
          { status: 409 },
        );
      }
    }

    const updated =
      await prisma.automation.update({
        where: {
          id,
        },
        data,
      });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "PATCH /api/automations/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "ویرایش Automation ناموفق بود.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
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

    const { id } = await params;

    const automation =
      await prisma.automation.findFirst({
        where: {
          id,
          instagramAccount: {
            userId: session.user.id,
          },
        },
      });

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          message: "Automation پیدا نشد.",
        },
        { status: 404 },
      );
    }

    await prisma.automation.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/automations/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "حذف Automation ناموفق بود.",
      },
      { status: 500 },
    );
  }
}