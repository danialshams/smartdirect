import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "instagramAccountId الزامی است.",
        },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت اینستاگرام پیدا نشد.",
        },
        { status: 404 },
      );
    }

    const automations = await prisma.automation.findMany({
      where: {
        instagramAccountId: account.id,
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
    console.error("GET /api/automations error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "دریافت اتوماسیون‌ها با خطا مواجه شد.",
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
      typeof body.instagramAccountId === "string"
        ? body.instagramAccountId.trim()
        : "";

    const keyword =
      typeof body.keyword === "string"
        ? body.keyword.trim()
        : "";

    const commentReplyText =
      typeof body.commentReplyText === "string"
        ? body.commentReplyText.trim()
        : "";

    const replyText =
      typeof body.replyText === "string"
        ? body.replyText.trim()
        : "";

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت اینستاگرام را انتخاب کنید.",
        },
        { status: 400 },
      );
    }

    if (!keyword) {
      return NextResponse.json(
        {
          success: false,
          message: "کلمه یا عبارت فعال‌کننده را وارد کنید.",
        },
        { status: 400 },
      );
    }

    if (!commentReplyText) {
      return NextResponse.json(
        {
          success: false,
          message: "متن پاسخ کامنت را وارد کنید.",
        },
        { status: 400 },
      );
    }

    if (!replyText) {
      return NextResponse.json(
        {
          success: false,
          message: "متن دایرکت را وارد کنید.",
        },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت اینستاگرام پیدا نشد.",
        },
        { status: 404 },
      );
    }

    const existingAutomation = await prisma.automation.findUnique({
      where: {
        instagramAccountId_keyword: {
          instagramAccountId: account.id,
          keyword,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingAutomation) {
      return NextResponse.json(
        {
          success: false,
          message: "این کلمه قبلاً برای این پیج استفاده شده است.",
        },
        { status: 409 },
      );
    }

    const automation = await prisma.automation.create({
      data: {
        instagramAccountId: account.id,
        keyword,
        commentReplyText,
        replyText,
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
    console.error("POST /api/automations error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "ساخت اتوماسیون با خطا مواجه شد.",
      },
      { status: 500 },
    );
  }
}