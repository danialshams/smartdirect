import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/showcases/[id]/items
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
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

    const { id } = await params;

    const showcase = await prisma.showcase.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!showcase) {
      return NextResponse.json(
        { error: "ویترین پیدا نشد" },
        { status: 404 }
      );
    }

    const items = await prisma.showcaseItem.findMany({
      where: {
        showcaseId: id,
      },
      orderBy: {
        order: "asc",
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error(
      "GET /api/showcases/[id]/items error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در دریافت آیتم‌های ویترین" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/showcases/[id]/items
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
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

    const { id } = await params;

    const showcase = await prisma.showcase.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!showcase) {
      return NextResponse.json(
        { error: "ویترین پیدا نشد" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      imageUrl,
      price,
      originalPrice,
      linkUrl,
      buttonText,
      order,
      isActive = true,
    } = body;

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "عنوان آیتم الزامی است" },
        { status: 400 }
      );
    }

    /**
     * پیدا کردن Order
     */
    let itemOrder: number;

    if (
      typeof order === "number" &&
      Number.isInteger(order)
    ) {
      itemOrder = order;
    } else {
      const lastItem =
        await prisma.showcaseItem.findFirst({
          where: {
            showcaseId: id,
          },
          orderBy: {
            order: "desc",
          },
        });

      itemOrder = lastItem ? lastItem.order + 1 : 0;
    }

    const item = await prisma.showcaseItem.create({
      data: {
        showcaseId: id,
        title: title.trim(),

        description:
          typeof description === "string" &&
          description.trim()
            ? description.trim()
            : null,

        imageUrl:
          typeof imageUrl === "string" &&
          imageUrl.trim()
            ? imageUrl.trim()
            : null,

        price:
          price !== undefined &&
          price !== null &&
          price !== ""
            ? price
            : null,

        originalPrice:
          originalPrice !== undefined &&
          originalPrice !== null &&
          originalPrice !== ""
            ? originalPrice
            : null,

        linkUrl:
          typeof linkUrl === "string" &&
          linkUrl.trim()
            ? linkUrl.trim()
            : null,

        buttonText:
          typeof buttonText === "string" &&
          buttonText.trim()
            ? buttonText.trim()
            : null,

        order: itemOrder,
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/showcases/[id]/items error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در ساخت آیتم ویترین" },
      { status: 500 }
    );
  }
}