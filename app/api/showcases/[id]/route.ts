import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/showcases/[id]
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
      include: {
        items: {
          orderBy: {
            order: "asc",
          },
        },
        messages: {
          select: {
            id: true,
            automationId: true,
            messageType: true,
            order: true,
          },
        },
        _count: {
          select: {
            items: true,
            messages: true,
          },
        },
      },
    });

    if (!showcase) {
      return NextResponse.json(
        { error: "ویترین پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(showcase);
  } catch (error) {
    console.error("GET /api/showcases/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت ویترین" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/showcases/[id]
 */
export async function PATCH(
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

    const existingShowcase =
      await prisma.showcase.findFirst({
        where: {
          id,
          userId: session.user.id,
        },
      });

    if (!existingShowcase) {
      return NextResponse.json(
        { error: "ویترین پیدا نشد" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      isActive,
      instagramAccountId,
    } = body;

    /**
     * اگر اکانت اینستاگرام تغییر کند،
     * باید متعلق به همین User باشد.
     */
    if (
      instagramAccountId !== undefined &&
      instagramAccountId !==
        existingShowcase.instagramAccountId
    ) {
      const instagramAccount =
        await prisma.instagramAccount.findFirst({
          where: {
            id: instagramAccountId,
            userId: session.user.id,
          },
        });

      if (!instagramAccount) {
        return NextResponse.json(
          {
            error:
              "اکانت اینستاگرام جدید متعلق به این کاربر نیست",
          },
          { status: 403 }
        );
      }
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return NextResponse.json(
        { error: "عنوان ویترین معتبر نیست" },
        { status: 400 }
      );
    }

    const showcase = await prisma.showcase.update({
      where: {
        id,
      },
      data: {
        ...(title !== undefined
          ? { title: title.trim() }
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

        ...(isActive !== undefined
          ? { isActive: Boolean(isActive) }
          : {}),

        ...(instagramAccountId !== undefined
          ? { instagramAccountId }
          : {}),
      },
      include: {
        items: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return NextResponse.json(showcase);
  } catch (error) {
    console.error("PATCH /api/showcases/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در ویرایش ویترین" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/showcases/[id]
 */
export async function DELETE(
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

    /**
     * پیام‌هایی که از Showcase استفاده می‌کنند
     * به دلیل onDelete: SetNull مشکلی ندارند.
     *
     * آیتم‌ها هم به دلیل Cascade حذف می‌شوند.
     */
    await prisma.showcase.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "ویترین با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("DELETE /api/showcases/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در حذف ویترین" },
      { status: 500 }
    );
  }
}