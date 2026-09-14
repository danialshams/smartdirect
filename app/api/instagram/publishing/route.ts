import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { start } from "workflow/api";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleInstagramPublish } from "@/lib/instagram/scheduled-publishing-workflow";

export const dynamic = "force-dynamic";

const userTagSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^@?[A-Za-z0-9._]+$/, "نام کاربری Instagram معتبر نیست."),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
});

const createSchema = z.object({
  instagramAccountId: z.string().min(1),
  type: z.enum(["POST", "CAROUSEL", "REEL", "STORY"]),
  caption: z.string().max(2200).optional().nullable(),
  userTags: z.array(userTagSchema).max(10).optional().default([]),
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
    if (!session?.user?.id)
      return NextResponse.json(
        { success: false, message: "احراز هویت انجام نشده است." },
        { status: 401 },
      );

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("instagramAccountId");
    const status = searchParams.get("status");

    const jobs = await prisma.instagramPublishJob.findMany({
      where: {
        userId: session.user.id,
        ...(accountId ? { instagramAccountId: accountId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
        instagramAccount: {
          select: { id: true, igUsername: true, igUserId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    console.error("GET /api/instagram/publishing error:", error);
    return NextResponse.json(
      { success: false, message: "دریافت لیست Publishing ناموفق بود." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json(
        { success: false, message: "احراز هویت انجام نشده است." },
        { status: 401 },
      );

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          success: false,
          message: "اطلاعات ارسال‌شده معتبر نیست.",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );

    const data = parsed.data;
    const normalizedUserTags = data.userTags.map((tag) => ({
      username: tag.username.replace(/^@/, ""),
      ...(tag.x !== undefined ? { x: tag.x } : {}),
      ...(tag.y !== undefined ? { y: tag.y } : {}),
    }));

    if (normalizedUserTags.length && data.type === "STORY") {
      return NextResponse.json(
        {
          success: false,
          message: "Tag کردن با این روش برای Story فعال نیست.",
        },
        { status: 400 },
      );
    }

    if (normalizedUserTags.length && data.type === "CAROUSEL") {
      return NextResponse.json(
        {
          success: false,
          message: "Tag کردن در Carousel فعلاً در پنل انتشار فعال نیست.",
        },
        { status: 400 },
      );
    }

    if (
      data.type === "POST" &&
      normalizedUserTags.some(
        (tag) => tag.x === undefined || tag.y === undefined,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "برای Tag در پست، موقعیت X و Y هر تگ الزامی است.",
        },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: data.instagramAccountId,
        userId: session.user.id,
        isConnected: true,
      },
    });

    if (!account)
      return NextResponse.json(
        { success: false, message: "اکانت Instagram پیدا نشد یا متصل نیست." },
        { status: 404 },
      );

    if (
      data.type === "POST" &&
      (data.media.length !== 1 || data.media[0].type !== "IMAGE")
    ) {
      return NextResponse.json(
        { success: false, message: "POST باید دقیقاً یک تصویر داشته باشد." },
        { status: 400 },
      );
    }

    if (
      data.type === "REEL" &&
      (data.media.length !== 1 || data.media[0].type !== "VIDEO")
    ) {
      return NextResponse.json(
        { success: false, message: "REEL باید دقیقاً یک ویدیو داشته باشد." },
        { status: 400 },
      );
    }

    if (
      data.type === "STORY" &&
      (data.media.length !== 1 ||
        !["IMAGE", "VIDEO"].includes(data.media[0].type))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Story باید دقیقاً یک تصویر یا ویدیو داشته باشد.",
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
        where: { idempotencyKey: data.idempotencyKey },
        include: { media: true },
      });
      if (existing)
        return NextResponse.json({
          success: true,
          data: existing,
          existing: true,
        });
    }

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { success: false, message: "تاریخ زمان‌بندی معتبر نیست." },
        { status: 400 },
      );
    }

    if (scheduledAt) {
      const conflict = await prisma.instagramPublishJob.findFirst({
        where: {
          instagramAccountId: account.id,
          scheduledAt,
          status: { not: "CANCELLED" },
        },
        select: { id: true, type: true },
      });
      if (conflict) {
        return NextResponse.json(
          {
            success: false,
            message: `برای این اکانت در همین تاریخ و ساعت یک ${conflict.type === "POST" ? "پست" : conflict.type === "REEL" ? "Reel" : conflict.type === "CAROUSEL" ? "Carousel" : "Story"} زمان‌بندی شده است. زمان دیگری انتخاب کنید.`,
            conflictJobId: conflict.id,
          },
          { status: 409 },
        );
      }
    }

    const isScheduled = !!scheduledAt && scheduledAt.getTime() > Date.now();

    let job;
    try {
      job = await prisma.instagramPublishJob.create({
        data: {
          userId: session.user.id,
          instagramAccountId: account.id,
          type: data.type,
          status: isScheduled ? "SCHEDULED" : "DRAFT",
          caption: data.caption ?? null,
          ...(normalizedUserTags.length
            ? { userTags: normalizedUserTags }
            : {}),
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
        include: { media: { orderBy: { sortOrder: "asc" } } },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "این اکانت در همین تاریخ و ساعت از قبل یک محتوای زمان‌بندی‌شده دارد. زمان دیگری انتخاب کنید.",
          },
          { status: 409 },
        );
      }
      throw error;
    }

    let workflowRunId: string | null = null;
    if (isScheduled && scheduledAt) {
      try {
        const workflowRun = await start(scheduleInstagramPublish, [
          job.id,
          scheduledAt.toISOString(),
        ]);
        workflowRunId = workflowRun.runId;
      } catch (error) {
        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage:
              error instanceof Error
                ? `شروع Workflow ناموفق بود: ${error.message}`
                : "شروع Workflow ناموفق بود.",
            retryCount: { increment: 1 },
          },
        });
        throw error;
      }
    }

    return NextResponse.json(
      { success: true, data: job, workflowRunId },
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
