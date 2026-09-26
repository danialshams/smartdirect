import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { start } from "workflow/api";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleInstagramPublish } from "@/lib/instagram/scheduled-publishing-workflow";
import { enqueueInstagramPublishing } from "@/lib/instagram/publishing-queue";
import { processPublishingQueueJob } from "@/lib/instagram/publishing-workflow";
import { proxyInstagramMediaUrl } from "@/lib/instagram/media-proxy";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";
const INSTAGRAM_API_VERSION = "v26.0";
const userTagSchema = z.object({ username: z.string().trim().min(1).max(30).regex(/^@?[A-Za-z0-9._]+$/) });
const createSchema = z.object({
  instagramAccountId: z.string().min(1),
  type: z.enum(["POST", "CAROUSEL", "REEL", "STORY"]),
  caption: z.string().max(2200).optional().nullable(),
  userTags: z.array(userTagSchema).max(10).optional().default([]),
  scheduledAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().max(200).optional().nullable(),
  commentAutomationId: z.string().min(1).optional().nullable(),
  storyReplyAutomationId: z.string().min(1).optional().nullable(),
  commentTriggerKeywords: z.string().trim().max(1000).optional().nullable(),
  commentTriggerResponse: z.string().trim().max(2000).optional().nullable(),
  storyReplyTriggerKeywords: z.string().trim().max(1000).optional().nullable(),
  storyReplyTriggerResponse: z.string().trim().max(2000).optional().nullable(),
  media: z.array(z.object({ type: z.enum(["IMAGE", "VIDEO"]), storageKey: z.string().min(1), publicUrl: z.string().url().optional().nullable(), fileName: z.string().max(255).optional().nullable(), mimeType: z.string().max(100).optional().nullable(), fileSize: z.number().int().positive().optional().nullable(), sortOrder: z.number().int().min(0) })).min(1).max(10),
});

async function enrichPublishedMedia(job: { instagramMediaId: string | null; instagramAccountId: string; media: Array<Record<string, unknown>> }) {
  if (!job.instagramMediaId) return job.media;
  try {
    const token = await getValidInstagramAccessToken(job.instagramAccountId);
    const url = new URL(`https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${job.instagramMediaId}`);
    url.searchParams.set("fields", "id,media_type,media_url,thumbnail_url,permalink,timestamp");
    url.searchParams.set("access_token", token);
    const response = await fetch(url.toString(), { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) return job.media;
    const mediaUrl = typeof result.media_url === "string" ? proxyInstagramMediaUrl(result.media_url) : null;
    const thumbnailUrl = typeof result.thumbnail_url === "string" ? proxyInstagramMediaUrl(result.thumbnail_url) : mediaUrl;
    if (!mediaUrl && !thumbnailUrl) return job.media;
    return [{ ...(job.media[0] ?? {}), publicUrl: mediaUrl ?? thumbnailUrl, instagramMediaUrl: mediaUrl, thumbnailUrl }];
  } catch (error) {
    console.warn("Failed to enrich published media:", error);
    return job.media;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("instagramAccountId");
    const status = searchParams.get("status");
    const jobs = await prisma.instagramPublishJob.findMany({
      where: { userId: session.user.id, ...(accountId ? { instagramAccountId: accountId } : {}), ...(status ? { status: status as never } : {}) },
      include: { media: { orderBy: { sortOrder: "asc" } }, instagramAccount: { select: { id: true, igUsername: true, igUserId: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    const data = await Promise.all(jobs.map(async (job) => ({ ...job, media: job.status === "PUBLISHED" ? await enrichPublishedMedia(job) : job.media })));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/instagram/publishing error:", error);
    return NextResponse.json({ success: false, message: "دریافت لیست Publishing ناموفق بود." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "اطلاعات ارسال‌شده معتبر نیست.", errors: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    const hasCommentTrigger = Boolean(data.commentTriggerKeywords?.trim() || data.commentTriggerResponse?.trim());
    const hasStoryTrigger = Boolean(data.storyReplyTriggerKeywords?.trim() || data.storyReplyTriggerResponse?.trim());
    if (hasCommentTrigger && data.type === "STORY") return NextResponse.json({ success: false, message: "شرط کامنت برای Story قابل استفاده نیست." }, { status: 400 });
    if (hasStoryTrigger && data.type !== "STORY") return NextResponse.json({ success: false, message: "شرط Reply استوری فقط برای Story قابل استفاده است." }, { status: 400 });
    if (hasCommentTrigger && (!data.commentTriggerKeywords?.trim() || !data.commentTriggerResponse?.trim())) return NextResponse.json({ success: false, message: "برای شرط کامنت، کلمات کلیدی و پاسخ الزامی است." }, { status: 400 });
    if (hasStoryTrigger && (!data.storyReplyTriggerKeywords?.trim() || !data.storyReplyTriggerResponse?.trim())) return NextResponse.json({ success: false, message: "برای شرط Reply استوری، کلمات کلیدی و پاسخ الزامی است." }, { status: 400 });
    if (hasCommentTrigger && data.commentAutomationId) return NextResponse.json({ success: false, message: "همزمان انتخاب Automation کامنت و شرط سفارشی کامنت مجاز نیست." }, { status: 400 });
    if (hasStoryTrigger && data.storyReplyAutomationId) return NextResponse.json({ success: false, message: "همزمان انتخاب Automation استوری و شرط سفارشی Reply مجاز نیست." }, { status: 400 });
    const normalizedUserTags = data.userTags.map((tag) => ({ username: tag.username.replace(/^@/, "") }));
    if (normalizedUserTags.length && data.type === "STORY") return NextResponse.json({ success: false, message: "Tag کردن با این روش برای Story فعال نیست." }, { status: 400 });
    if (normalizedUserTags.length && data.type === "CAROUSEL") return NextResponse.json({ success: false, message: "Tag کردن در Carousel فعلاً در پنل انتشار فعال نیست." }, { status: 400 });

    const account = await prisma.instagramAccount.findFirst({ where: { id: data.instagramAccountId, userId: session.user.id, isConnected: true } });
    if (!account) return NextResponse.json({ success: false, message: "اکانت Instagram پیدا نشد یا متصل نیست." }, { status: 404 });

    if (data.commentAutomationId) {
      const automation = await prisma.automation.findFirst({ where: { id: data.commentAutomationId, instagramAccountId: account.id, triggerType: "COMMENT_KEYWORD", isActive: true }, select: { id: true } });
      if (!automation) return NextResponse.json({ success: false, message: "Automation شرط کامنت معتبر نیست یا به این اکانت تعلق ندارد." }, { status: 400 });
      if (data.type === "STORY") return NextResponse.json({ success: false, message: "شرط کامنت برای Story قابل استفاده نیست." }, { status: 400 });
    }
    if (data.storyReplyAutomationId) {
      const automation = await prisma.automation.findFirst({ where: { id: data.storyReplyAutomationId, instagramAccountId: account.id, triggerType: "STORY_REPLY_KEYWORD", isActive: true }, select: { id: true } });
      if (!automation) return NextResponse.json({ success: false, message: "Automation شرط Reply استوری معتبر نیست یا به این اکانت تعلق ندارد." }, { status: 400 });
      if (data.type !== "STORY") return NextResponse.json({ success: false, message: "شرط Reply استوری فقط برای Story قابل استفاده است." }, { status: 400 });
    }

    if (data.type === "POST" && (data.media.length !== 1 || data.media[0].type !== "IMAGE")) return NextResponse.json({ success: false, message: "POST باید دقیقاً یک تصویر داشته باشد." }, { status: 400 });
    if (data.type === "REEL" && (data.media.length !== 1 || data.media[0].type !== "VIDEO")) return NextResponse.json({ success: false, message: "REEL باید دقیقاً یک ویدیو داشته باشد." }, { status: 400 });
    if (data.type === "STORY" && (data.media.length !== 1 || !["IMAGE", "VIDEO"].includes(data.media[0].type))) return NextResponse.json({ success: false, message: "Story باید دقیقاً یک تصویر یا ویدیو داشته باشد." }, { status: 400 });
    if (data.type === "CAROUSEL" && (data.media.length < 2 || data.media.length > 10 || data.media.some((item) => item.type !== "IMAGE"))) return NextResponse.json({ success: false, message: "Carousel باید بین ۲ تا ۱۰ تصویر داشته باشد." }, { status: 400 });

    if (data.idempotencyKey) {
      const existing = await prisma.instagramPublishJob.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { media: true } });
      if (existing) return NextResponse.json({ success: true, data: existing, existing: true });
    }

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ success: false, message: "تاریخ زمان‌بندی معتبر نیست." }, { status: 400 });
    if (scheduledAt) {
      const conflict = await prisma.instagramPublishJob.findFirst({ where: { instagramAccountId: account.id, scheduledAt, status: { not: "CANCELLED" } }, select: { id: true, type: true } });
      if (conflict) return NextResponse.json({ success: false, message: "برای این اکانت در همین تاریخ و ساعت یک محتوای زمان‌بندی‌شده وجود دارد. زمان دیگری انتخاب کنید.", conflictJobId: conflict.id }, { status: 409 });
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
          ...(normalizedUserTags.length ? { userTags: normalizedUserTags } : {}),
          commentAutomationId: data.commentAutomationId ?? null,
          storyReplyAutomationId: data.storyReplyAutomationId ?? null,
          commentTriggerKeywords: data.commentTriggerKeywords?.trim() || null,
          commentTriggerResponse: data.commentTriggerResponse?.trim() || null,
          storyReplyTriggerKeywords: data.storyReplyTriggerKeywords?.trim() || null,
          storyReplyTriggerResponse: data.storyReplyTriggerResponse?.trim() || null,
          scheduledAt,
          idempotencyKey: data.idempotencyKey ?? null,
          media: { create: data.media.map((item) => ({ type: item.type, storageKey: item.storageKey, publicUrl: item.publicUrl ?? null, fileName: item.fileName ?? null, mimeType: item.mimeType ?? null, fileSize: item.fileSize ?? null, sortOrder: item.sortOrder })) },
        },
        include: { media: { orderBy: { sortOrder: "asc" } } },
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ success: false, message: "این اکانت در همین تاریخ و ساعت از قبل یک محتوای زمان‌بندی‌شده دارد. زمان دیگری انتخاب کنید." }, { status: 409 });
      throw error;
    }

    let workflowRunId: string | null = null;
    let queueJobId: string | null = null;
    if (isScheduled && scheduledAt) {
      try {
        const workflowRun = await start(scheduleInstagramPublish, [job.id, scheduledAt.toISOString()]);
        workflowRunId = workflowRun.runId;
      } catch (error) {
        await prisma.instagramPublishJob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? `شروع Workflow ناموفق بود: ${error.message}` : "شروع Workflow ناموفق بود.", retryCount: { increment: 1 } } });
        throw error;
      }
    } else {
      try {
        const queued = await enqueueInstagramPublishing(job.id, { maxAttempts: 4 });
        queueJobId = queued.job.id;
        const workflowRun = await start(processPublishingQueueJob, [queued.job.id]);
        workflowRunId = workflowRun.runId;
      } catch (error) {
        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage:
              error instanceof Error
                ? `Queue شدن Publishing ناموفق بود: ${error.message}`
                : "Queue شدن Publishing ناموفق بود.",
            retryCount: { increment: 1 },
          },
        });
        throw error;
      }
    }
    return NextResponse.json({ success: true, data: job, workflowRunId, queueJobId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/instagram/publishing error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "ساخت Publishing Job ناموفق بود." }, { status: 500 });
  }
}
