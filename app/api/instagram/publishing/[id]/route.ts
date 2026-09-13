import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: Context) {
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

    const job = await prisma.instagramPublishJob.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        media: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        instagramAccount: {
          select: {
            id: true,
            igUserId: true,
            igUsername: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "Publishing Job پیدا نشد.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("GET /api/instagram/publishing/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "دریافت Job ناموفق بود.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
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

    const job = await prisma.instagramPublishJob.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "Publishing Job پیدا نشد.",
        },
        { status: 404 },
      );
    }

    if (job.status === "PUBLISHED") {
      return NextResponse.json(
        {
          success: false,
          message: "Job منتشرشده قابل حذف نیست.",
        },
        { status: 409 },
      );
    }

    await prisma.instagramPublishJob.update({
      where: {
        id,
      },
      data: {
        status: "CANCELLED",
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/instagram/publishing/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "لغو Job ناموفق بود.",
      },
      { status: 500 },
    );
  }
}
