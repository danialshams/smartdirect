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

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);

    const instagramAccountId =
      searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "instagramAccountId الزامی است.",
        },
        { status: 400 },
      );
    }

    const account =
      await prisma.instagramAccount.findFirst({
        where: {
          id: instagramAccountId,
          userId: session.user.id,
        },
      });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت Instagram متعلق به شما نیست.",
        },
        { status: 403 },
      );
    }

    const automations =
      await prisma.automation.findMany({
        where: {
          instagramAccountId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return NextResponse.json({
      success: true,
      data: automations,
    });
  } catch (error) {
    console.error(
      "GET /api/automations error:",
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

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    const instagramAccountId =
      String(body.instagramAccountId ?? "").trim();

    const mediaId =
      body.mediaId
        ? String(body.mediaId).trim()
        : null;

    const keyword = normalizeKeyword(
      String(body.keyword ?? ""),
    );

    const commentReplyText =
      body.commentReplyText
        ? String(body.commentReplyText).trim()
        : null;

    const replyText =
      body.replyText
        ? String(body.replyText).trim()
        : null;

    const likeComment =
      Boolean(body.likeComment);

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت Instagram را انتخاب کنید.",
        },
        { status: 400 },
      );
    }

    if (!keyword) {
      return NextResponse.json(
        {
          success: false,
          message: "کلمه کلیدی را وارد کنید.",
        },
        { status: 400 },
      );
    }

    if (
      !commentReplyText &&
      !replyText &&
      !likeComment
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "حداقل یک Action انتخاب کنید.",
        },
        { status: 400 },
      );
    }

    const account =
      await prisma.instagramAccount.findFirst({
        where: {
          id: instagramAccountId,
          userId: session.user.id,
        },
      });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت Instagram متعلق به شما نیست.",
        },
        { status: 403 },
      );
    }

    const duplicate =
      await prisma.automation.findUnique({
        where: {
          instagramAccountId_keyword: {
            instagramAccountId,
            keyword,
          },
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "برای این کلمه کلیدی قبلاً یک Automation ساخته شده است.",
        },
        { status: 409 },
      );
    }

    const automation =
      await prisma.automation.create({
        data: {
          instagramAccountId,
          mediaId,
          keyword,
          commentReplyText,
          replyText,
          likeComment,
          isActive: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        data: automation,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/automations error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "ساخت Automation ناموفق بود.",
      },
      { status: 500 },
    );
  }
}