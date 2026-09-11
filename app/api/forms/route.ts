import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/forms?instagramAccountId=...
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

    const forms = await prisma.form.findMany({
      where,
      include: {
        fields: {
          orderBy: {
            order: "asc",
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(forms);
  } catch (error) {
    console.error("GET /api/forms error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت فرم‌ها" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms
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
        { error: "عنوان فرم الزامی است" },
        { status: 400 }
      );
    }

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

    const form = await prisma.form.create({
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
        fields: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    console.error("POST /api/forms error:", error);

    return NextResponse.json(
      { error: "خطا در ساخت فرم" },
      { status: 500 }
    );
  }
}