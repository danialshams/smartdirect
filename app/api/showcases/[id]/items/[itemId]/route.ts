import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/showcases/[id]/items/[itemId]
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      itemId: string;
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

    const { id, itemId } = await params;

    const item = await prisma.showcaseItem.findFirst({
      where: {
        id: itemId,
        showcaseId: id,
        showcase: {
          userId: session.user.id,
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "آیتم پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error(
      "GET /api/showcases/[id]/items/[itemId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در دریافت آیتم" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/showcases/[id]/items/[itemId]
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      itemId: string;
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

    const { id, itemId } = await params;

    const existingItem =
      await prisma.showcaseItem.findFirst({
        where: {
          id: itemId,
          showcaseId: id,
          showcase: {
            userId: session.user.id,
          },
        },
      });

    if (!existingItem) {
      return NextResponse.json(
        { error: "آیتم پیدا نشد" },
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
      isActive,
    } = body;

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return NextResponse.json(
        { error: "عنوان آیتم معتبر نیست" },
        { status: 400 }
      );
    }

    const item = await prisma.showcaseItem.update({
      where: {
        id: itemId,
      },
      data: {
        ...(title !== undefined
          ? {
              title: title.trim(),
            }
          : {}),

        ...(description !== undefined
          ? {
              description:
                typeof description === "string" &&
                description.trim()
                  ? description.trim()
                  : null,
            }
          : {}),

        ...(imageUrl !== undefined
          ? {
              imageUrl:
                typeof imageUrl === "string" &&
                imageUrl.trim()
                  ? imageUrl.trim()
                  : null,
            }
          : {}),

        ...(price !== undefined
          ? {
              price:
                price === null || price === ""
                  ? null
                  : price,
            }
          : {}),

        ...(originalPrice !== undefined
          ? {
              originalPrice:
                originalPrice === null ||
                originalPrice === ""
                  ? null
                  : originalPrice,
            }
          : {}),

        ...(linkUrl !== undefined
          ? {
              linkUrl:
                typeof linkUrl === "string" &&
                linkUrl.trim()
                  ? linkUrl.trim()
                  : null,
            }
          : {}),

        ...(buttonText !== undefined
          ? {
              buttonText:
                typeof buttonText === "string" &&
                buttonText.trim()
                  ? buttonText.trim()
                  : null,
            }
          : {}),

        ...(order !== undefined &&
        typeof order === "number" &&
        Number.isInteger(order)
          ? { order }
          : {}),

        ...(isActive !== undefined
          ? {
              isActive: Boolean(isActive),
            }
          : {}),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error(
      "PATCH /api/showcases/[id]/items/[itemId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در ویرایش آیتم" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/showcases/[id]/items/[itemId]
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      itemId: string;
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

    const { id, itemId } = await params;

    const item = await prisma.showcaseItem.findFirst({
      where: {
        id: itemId,
        showcaseId: id,
        showcase: {
          userId: session.user.id,
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "آیتم پیدا نشد" },
        { status: 404 }
      );
    }

    await prisma.showcaseItem.delete({
      where: {
        id: itemId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "آیتم با موفقیت حذف شد",
    });
  } catch (error) {
    console.error(
      "DELETE /api/showcases/[id]/items/[itemId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در حذف آیتم" },
      { status: 500 }
    );
  }
}