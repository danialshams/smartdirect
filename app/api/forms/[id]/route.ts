import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/forms/[id]
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

    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        fields: {
          orderBy: {
            order: "asc",
          },
        },
        submissions: {
          orderBy: {
            createdAt: "desc",
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
            fields: true,
            submissions: true,
            messages: true,
          },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: "فرم پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(form);
  } catch (error) {
    console.error("GET /api/forms/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت فرم" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/forms/[id]
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

    const existingForm = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingForm) {
      return NextResponse.json(
        { error: "فرم پیدا نشد" },
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

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return NextResponse.json(
        { error: "عنوان فرم معتبر نیست" },
        { status: 400 }
      );
    }

    if (
      instagramAccountId !== undefined &&
      instagramAccountId !== existingForm.instagramAccountId
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

    const form = await prisma.form.update({
      where: {
        id,
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

        ...(isActive !== undefined
          ? {
              isActive: Boolean(isActive),
            }
          : {}),

        ...(instagramAccountId !== undefined
          ? {
              instagramAccountId,
            }
          : {}),
      },
      include: {
        fields: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return NextResponse.json(form);
  } catch (error) {
    console.error("PATCH /api/forms/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در ویرایش فرم" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/[id]
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

    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: "فرم پیدا نشد" },
        { status: 404 }
      );
    }

    await prisma.form.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "فرم با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("DELETE /api/forms/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در حذف فرم" },
      { status: 500 }
    );
  }
}