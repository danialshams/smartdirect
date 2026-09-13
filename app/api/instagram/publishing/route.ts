import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  instagramAccountId: z.string().min(1),
  type: z.enum(["POST", "CAROUSEL", "REEL"]),
  caption: z.string().max(2200).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().max(200).optional().nullable(),

  media: z
    .array(
      z.object({
        type: z.enum(["IMAGE", "VIDEO"]),
        storageKey: z.string().min(1),
        publicUrl: z.string().url().optional().nullable(),
        fileName: z.string().max(255).optional().nullable(),
        mimeType: z.string().max(100).optional().nullable(),
        fileSize: z.number().int().positive().optional().nullable(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(10),
});

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

    const accountId = searchParams.get("instagramAccountId");

    const status = searchParams.get("status");

    const jobs = await prisma.instagramPublishJob.findMany({
      where: {
        userId: session.user.id,
        ...(accountId
          ? {
              instagramAccountId: accountId,
            }
          : {}),
        ...(status
          ? {
              status: status as never,
            }
          : {}),
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
            igUsername: true,
            igUserId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error("GET /api/instagram/publishing error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "دریافت لیست Publishing ناموفق بود.",
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

    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "اطلاعات ارسال‌شده معتبر نیست.",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: data.instagramAccountId,
        userId: session.user.id,
        isConnected: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "اکانت Instagram پیدا نشد یا متصل نیست.",
        },
        { status: 404 },
      );
    }

    if (
      data.type === "POST" &&
      (data.media.length !== 1 || data.media[0].type !== "IMAGE")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "POST باید دقیقاً یک تصویر داشته باشد.",
        },
        { status: 400 },
      );
    }

    if (
      data.type === "REEL" &&
      (data.media.length !== 1 || data.media[0].type !== "VIDEO")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "REEL باید دقیقاً یک ویدیو داشته باشد.",
        },
        { status: 400 },
      );
    }

    if (
      data.type === "CAROUSEL" &&
      (data.media.length < 2 ||
        data.media.length > 10 ||
        data.media.some((item) => item.type !== "IMAGE"))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Carousel باید بین ۲ تا ۱۰ تصویر داشته باشد.",
        },
        { status: 400 },
      );
    }

    if (data.idempotencyKey) {
      const existing = await prisma.instagramPublishJob.findUnique({
        where: {
          idempotencyKey: data.idempotencyKey,
        },
        include: {
          media: true,
        },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          data: existing,
          existing: true,
        });
      }
    }

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;

    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "تاریخ زمان‌بندی معتبر نیست.",
        },
        { status: 400 },
      );
    }

    const isScheduled = scheduledAt && scheduledAt.getTime() > Date.now();

    const job = await prisma.instagramPublishJob.create({
      data: {
        userId: session.user.id,
        instagramAccountId: account.id,
        type: data.type,
        status: isScheduled ? "SCHEDULED" : "DRAFT",
        caption: data.caption ?? null,
        scheduledAt,
        idempotencyKey: data.idempotencyKey ?? null,

        media: {
          create: data.media.map((item) => ({
            type: item.type,
            storageKey: item.storageKey,
            publicUrl: item.publicUrl ?? null,
            fileName: item.fileName ?? null,
            mimeType: item.mimeType ?? null,
            fileSize: item.fileSize ?? null,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        media: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: job,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/instagram/publishing error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "ساخت Publishing Job ناموفق بود.",
      },
      { status: 500 },
    );
  }
}
