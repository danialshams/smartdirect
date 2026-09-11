import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/showcases?instagramAccountId=...
 *
 * دریافت تمام ویترین‌های متعلق به کاربر
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const instagramAccountId =
      searchParams.get("instagramAccountId");

    const where: {
      userId: string;
      instagramAccountId?: string;
    } = {
      userId: session.user.id,
    };

    if (instagramAccountId) {
      where.instagramAccountId = instagramAccountId;
    }

    const showcases = await prisma.showcase.findMany({
      where,
      include: {
        items: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            items: true,
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(showcases);
  } catch (error) {
    console.error("GET /api/showcases error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت ویترین‌ها" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/showcases
 *
 * ساخت ویترین جدید
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      instagramAccountId,
      title,
      description,
      isActive = true,
    } = body;

    if (!instagramAccountId) {
      return NextResponse.json(
        { error: "instagramAccountId الزامی است" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "عنوان ویترین الزامی است" },
        { status: 400 }
      );
    }

    /**
     * بررسی مالکیت Instagram Account
     */
    const instagramAccount =
      await prisma.instagramAccount.findFirst({
        where: {
          id: instagramAccountId,
          userId: session.user.id,
        },
      });

    if (!instagramAccount) {
      return NextResponse.json(
        { error: "اکانت اینستاگرام پیدا نشد" },
        { status: 404 }
      );
    }

    /**
     * ساخت Showcase
     */
    const showcase = await prisma.showcase.create({
      data: {
        userId: session.user.id,
        instagramAccountId,
        title: title.trim(),
        description:
          typeof description === "string" &&
          description.trim()
            ? description.trim()
            : null,
        isActive: Boolean(isActive),
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(showcase, { status: 201 });
  } catch (error) {
    console.error("POST /api/showcases error:", error);

    return NextResponse.json(
      { error: "خطا در ساخت ویترین" },
      { status: 500 }
    );
  }
}