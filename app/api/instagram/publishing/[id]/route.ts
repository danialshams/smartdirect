import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { start } from "workflow/api";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage/provider";
import { proxyInstagramMediaUrl } from "@/lib/instagram/media-proxy";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { scheduleInstagramPublish } from "@/lib/instagram/scheduled-publishing-workflow";

export const dynamic = "force-dynamic";
const INSTAGRAM_API_VERSION = "v26.0";

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
    const mediaUrl = typeof result.media_url === "string" ? proxyInstagramMediaUrl(result.media_url, job.instagramAccountId) : null;
    const thumbnailUrl = typeof result.thumbnail_url === "string" ? proxyInstagramMediaUrl(result.thumbnail_url, job.instagramAccountId) : mediaUrl;
    if (!mediaUrl && !thumbnailUrl) return job.media;
    return [{ ...(job.media[0] ?? {}), publicUrl: mediaUrl ?? thumbnailUrl }];
  } catch (error) {
    console.warn("Failed to enrich publishing job media:", error);
    return job.media;
  }
}


type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: Context) {
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

    const includeMedia = request.nextUrl.searchParams.get("includeMedia") === "true";
    const data =
      job.status === "PUBLISHED" && includeMedia
        ? { ...job, media: await enrichPublishedMedia(job) }
        : job;

    return NextResponse.json({
      success: true,
      data,
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

const updateSchema = z.object({
  caption: z.string().max(2200).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });

    const { id } = await context.params;
    const job = await prisma.instagramPublishJob.findFirst({ where: { id, userId: session.user.id } });
    if (!job) return NextResponse.json({ success: false, message: "Publishing Job پیدا نشد." }, { status: 404 });
    if (job.status !== "SCHEDULED") return NextResponse.json({ success: false, message: "فقط محتوای زمان‌بندی‌شده قابل ویرایش است." }, { status: 409 });

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "اطلاعات ویرایش معتبر نیست." }, { status: 400 });

    const nextScheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    if (!nextScheduledAt || Number.isNaN(nextScheduledAt.getTime()) || nextScheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ success: false, message: "زمان انتشار باید در آینده باشد." }, { status: 400 });
    }
    if (nextScheduledAt.getTime() > Date.now() + 48 * 60 * 60 * 1000) {
      return NextResponse.json({ success: false, message: "زمان انتشار باید حداکثر تا ۴۸ ساعت آینده باشد." }, { status: 400 });
    }

    const conflict = await prisma.instagramPublishJob.findFirst({
      where: { instagramAccountId: job.instagramAccountId, scheduledAt: nextScheduledAt, status: { not: "CANCELLED" }, id: { not: job.id } },
      select: { id: true },
    });
    if (conflict) return NextResponse.json({ success: false, message: "برای این اکانت در همین تاریخ و ساعت یک محتوای زمان‌بندی‌شده وجود دارد." }, { status: 409 });

    const updated = await prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: { caption: parsed.data.caption?.trim() || null, scheduledAt: nextScheduledAt, errorMessage: null },
      include: { media: { orderBy: { sortOrder: "asc" } } },
    });

    await start(scheduleInstagramPublish, [updated.id, nextScheduledAt.toISOString()]);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/instagram/publishing/[id] error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "ویرایش Publishing Job ناموفق بود." }, { status: 500 });
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
      return NextResponse.json({ success: false, message: "محتوای منتشرشده از داخل SmartDirect حذف نمی‌شود." }, { status: 409 });
    }

    if (job.status !== "SCHEDULED" && job.status !== "DRAFT" && job.status !== "FAILED") {
      return NextResponse.json({ success: false, message: "این محتوا در وضعیت فعلی قابل لغو نیست." }, { status: 409 });
    }

    const media = await prisma.instagramPublishMedia.findMany({
      where: { publishJobId: job.id, deletedAt: null },
      select: { id: true, storageKey: true },
    });

    await prisma.instagramPublishJob.update({ where: { id }, data: { status: "CANCELLED" } });

    const storage = getStorageProvider();
    let cleanupPending = false;
    for (const item of media) {
      try {
        if (!item.storageKey.startsWith("test:")) await storage.delete(item.storageKey);
        await prisma.instagramPublishMedia.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
      } catch (error) {
        cleanupPending = true;
        console.error("Scheduled publishing media cleanup failed:", { mediaId: item.id, error });
      }
    }

    return NextResponse.json({
      success: true,
      cleanupPending,
      message: cleanupPending
        ? "محتوا لغو شد؛ حذف یک یا چند فایل نیاز به تلاش مجدد دارد."
        : "محتوای زمان‌بندی‌شده لغو و فایل‌های آن حذف شد.",
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
