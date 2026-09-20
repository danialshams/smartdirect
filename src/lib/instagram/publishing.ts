import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { InstagramApiError, instagramApiRequest } from "@/lib/instagram/client";
import { getStorageProvider } from "@/lib/storage/provider";

type ContainerResponse = { id?: string; status_code?: string; status?: string };
type PublishResponse = { id?: string };
type MediaItem = { type: "IMAGE" | "VIDEO"; publicUrl: string; sortOrder: number };
type UserTag = { username: string; x?: number; y?: number };

function normalizeUserTags(value: unknown): UserTag[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is UserTag =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).username === "string" &&
        String((item as Record<string, unknown>).username).trim().length > 0,
    )
    .map((tag) => ({
      username: tag.username.replace(/^@/, "").trim(),
      ...(typeof tag.x === "number" ? { x: tag.x } : {}),
      ...(typeof tag.y === "number" ? { y: tag.y } : {}),
    }));
}

async function createImageContainer(
  igUserId: string,
  token: string,
  media: MediaItem,
  caption?: string | null,
  carousel = false,
  tags: UserTag[] = [],
  tenantId?: string,
  rateLimitAccountId?: string,
  rateLimitOperation: "PUBLISH_MEDIA" | "PUBLISH_REEL" | "PUBLISH_CAROUSEL" | "PUBLISH_STORY" = "PUBLISH_MEDIA",
) {
  const body: Record<string, unknown> = { image_url: media.publicUrl };
  if (caption && !carousel) body.caption = caption;
  if (carousel) body.is_carousel_item = true;
  if (!carousel && tags.length) body.user_tags = JSON.stringify(tags);

  const data = await instagramApiRequest<ContainerResponse>(`/${igUserId}/media`, {
    method: "POST",
    accessToken: token,
    body,
    timeoutMs: 30_000,
    rateLimit: { instagramAccountId: rateLimitAccountId ?? igUserId, operation: rateLimitOperation, ...(tenantId ? { tenantId } : {}) },
  });

  if (!data.id) throw new Error("ساخت Instagram image container ناموفق بود.");
  return data.id;
}

async function createReelContainer(
  igUserId: string,
  token: string,
  media: MediaItem,
  caption?: string | null,
  tags: UserTag[] = [],
  tenantId?: string,
  rateLimitAccountId?: string,
) {
  const body: Record<string, unknown> = {
    media_type: "REELS",
    video_url: media.publicUrl,
  };
  if (caption) body.caption = caption;
  if (tags.length) body.user_tags = JSON.stringify(tags);

  const data = await instagramApiRequest<ContainerResponse>(`/${igUserId}/media`, {
    method: "POST",
    accessToken: token,
    body,
    timeoutMs: 30_000,
    rateLimit: { instagramAccountId: rateLimitAccountId ?? igUserId, operation: "PUBLISH_REEL", ...(tenantId ? { tenantId } : {}) },
  });

  if (!data.id) throw new Error("ساخت Instagram Reel container ناموفق بود.");
  return data.id;
}

async function createStoryContainer(igUserId: string, token: string, media: MediaItem, tenantId?: string, rateLimitAccountId?: string) {
  const body: Record<string, unknown> = {
    media_type: "STORIES",
    ...(media.type === "IMAGE"
      ? { image_url: media.publicUrl }
      : { video_url: media.publicUrl }),
  };

  const data = await instagramApiRequest<ContainerResponse>(`/${igUserId}/media`, {
    method: "POST",
    accessToken: token,
    body,
    timeoutMs: 30_000,
    rateLimit: { instagramAccountId: rateLimitAccountId ?? igUserId, operation: "PUBLISH_STORY", ...(tenantId ? { tenantId } : {}) },
  });

  if (!data.id) throw new Error("ساخت Instagram Story container ناموفق بود.");
  return data.id;
}

async function createCarouselContainer(
  igUserId: string,
  token: string,
  children: string[],
  caption?: string | null,
  tenantId?: string,
  rateLimitAccountId?: string,
) {
  const body: Record<string, unknown> = {
    media_type: "CAROUSEL",
    children: children.join(","),
  };
  if (caption) body.caption = caption;

  const data = await instagramApiRequest<ContainerResponse>(`/${igUserId}/media`, {
    method: "POST",
    accessToken: token,
    body,
    timeoutMs: 30_000,
    rateLimit: { instagramAccountId: rateLimitAccountId ?? igUserId, operation: "PUBLISH_CAROUSEL", ...(tenantId ? { tenantId } : {}) },
  });

  if (!data.id) throw new Error("ساخت Instagram Carousel ناموفق بود.");
  return data.id;
}

async function containerStatus(id: string, token: string, instagramAccountId: string, tenantId?: string, operation: "PUBLISH_MEDIA" | "PUBLISH_REEL" | "PUBLISH_CAROUSEL" | "PUBLISH_STORY" = "PUBLISH_MEDIA") {
  const data = await instagramApiRequest<ContainerResponse>(`/${id}`, {
    accessToken: token,
    params: { fields: "status_code,status" },
    timeoutMs: 30_000,
    rateLimit: { instagramAccountId, operation, ...(tenantId ? { tenantId } : {}) },
  });

  return {
    statusCode: data.status_code ?? null,
    status: data.status ?? null,
  };
}

async function waitReady(
  id: string,
  token: string,
  instagramAccountId: string,
  tenantId?: string,
  delayMs = 3000,
  maxAttempts = 20,
  operation: "PUBLISH_MEDIA" | "PUBLISH_REEL" | "PUBLISH_CAROUSEL" | "PUBLISH_STORY" = "PUBLISH_MEDIA",
) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const status = await containerStatus(id, token, instagramAccountId, tenantId, operation);
    const code = String(status.statusCode ?? "").toUpperCase();

    if (code === "FINISHED") {
      // Meta can report FINISHED a moment before media_publish becomes ready.
      // Keep a short stabilization window before the final publish call.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram container failed with status: ${code}`);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Instagram container در زمان مجاز آماده نشد.");
}

async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
  tenantId?: string,
  rateLimitAccountId?: string,
  operation: "PUBLISH_MEDIA" | "PUBLISH_REEL" | "PUBLISH_CAROUSEL" | "PUBLISH_STORY" = "PUBLISH_MEDIA",
) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const data = await instagramApiRequest<PublishResponse>(
        `/${igUserId}/media_publish`,
        {
          method: "POST",
          accessToken: token,
          body: { creation_id: containerId },
          timeoutMs: 30_000,
          rateLimit: { instagramAccountId: rateLimitAccountId ?? igUserId, operation, ...(tenantId ? { tenantId } : {}) },
        },
      );

      if (!data.id) throw new Error("انتشار محتوا در Instagram ناموفق بود.");
      return data.id;
    } catch (error) {
      // 9007 / 2207027 means the container is still settling and has not
      // become publishable yet. Retrying this specific POST is safe because
      // Meta has explicitly rejected the publish before creating the media.
      if (
        !(error instanceof InstagramApiError) ||
        error.details?.code !== 9007 ||
        error.details?.error_subcode !== 2207027 ||
        attempt >= maxAttempts
      ) {
        throw error;
      }

      const delayMs = [1500, 3000, 5000][attempt - 1] ?? 5000;
      console.warn("[Instagram API] media_publish not ready; retrying", {
        containerId,
        attempt,
        delayMs,
        errorCode: error.details?.code,
        errorSubcode: error.details?.error_subcode,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Instagram media_publish failed after retries.");
}

async function cleanupPublishedMedia(
  items: Array<{ id: string; storageKey: string; deletedAt: Date | null }>,
) {
  const storage = getStorageProvider();

  for (const item of items) {
    if (item.deletedAt || item.storageKey.startsWith("test:")) continue;

    try {
      await storage.delete(item.storageKey);
      await prisma.instagramPublishMedia.update({
        where: { id: item.id },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      console.error("Failed to delete published Instagram media:", {
        mediaId: item.id,
        storageKey: item.storageKey,
        error,
      });
    }
  }
}

function splitTriggerKeywords(value: string | null) {
  if (!value) return [];

  return value
    .split(/[\n,،;؛]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

async function createConditionalAutomation(
  instagramAccountId: string,
  triggerType: "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD",
  keywords: string | null,
  response: string | null,
  instagramMediaId: string,
) {
  const normalizedKeywords = splitTriggerKeywords(keywords);
  const normalizedResponse = response?.trim();

  if (!normalizedKeywords.length || !normalizedResponse) return;

  const keyword = normalizedKeywords.join(",");
  const existing = await prisma.automation.findFirst({
    where: {
      instagramAccountId,
      triggerType,
      keyword,
      mediaId: instagramMediaId,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const automation = await prisma.automation.create({
    data: {
      instagramAccountId,
      triggerType,
      keyword,
      mediaId: instagramMediaId,
      sendDm: true,
      replyText: normalizedResponse,
      isActive: true,
    },
    select: { id: true },
  });

  return automation.id;
}

async function bindConditionalAutomations(
  job: {
    commentAutomationId: string | null;
    storyReplyAutomationId: string | null;
    commentTriggerKeywords: string | null;
    commentTriggerResponse: string | null;
    storyReplyTriggerKeywords: string | null;
    storyReplyTriggerResponse: string | null;
    instagramAccountId: string;
    type: string;
  },
  instagramMediaId: string,
) {
  if (job.commentAutomationId && job.type !== "STORY") {
    await prisma.automation.updateMany({
      where: {
        id: job.commentAutomationId,
        instagramAccountId: job.instagramAccountId,
        triggerType: "COMMENT_KEYWORD",
      },
      data: { mediaId: instagramMediaId },
    });
  }

  if (job.storyReplyAutomationId && job.type === "STORY") {
    await prisma.automation.updateMany({
      where: {
        id: job.storyReplyAutomationId,
        instagramAccountId: job.instagramAccountId,
        triggerType: "STORY_REPLY_KEYWORD",
      },
      data: { mediaId: instagramMediaId },
    });
  }

  if (!job.commentAutomationId && job.type !== "STORY") {
    await createConditionalAutomation(
      job.instagramAccountId,
      "COMMENT_KEYWORD",
      job.commentTriggerKeywords,
      job.commentTriggerResponse,
      instagramMediaId,
    );
  }

  if (!job.storyReplyAutomationId && job.type === "STORY") {
    await createConditionalAutomation(
      job.instagramAccountId,
      "STORY_REPLY_KEYWORD",
      job.storyReplyTriggerKeywords,
      job.storyReplyTriggerResponse,
      instagramMediaId,
    );
  }
}

export async function publishInstagramJob(jobId: string) {
  const job = await prisma.instagramPublishJob.findUnique({
    where: { id: jobId },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      instagramAccount: true,
    },
  });

  if (!job) throw new Error("Publishing job پیدا نشد.");
  if (!job.instagramAccount.isConnected) {
    throw new Error("اکانت Instagram متصل نیست.");
  }
  if (!job.media.length) {
    throw new Error("هیچ Media برای انتشار وجود ندارد.");
  }

  const media: MediaItem[] = job.media.map((item) => {
    if (!item.publicUrl) {
      throw new Error(`فایل ${item.fileName ?? item.id} URL عمومی ندارد.`);
    }

    return {
      type: item.type,
      publicUrl: item.publicUrl,
      sortOrder: item.sortOrder,
    };
  });

  const tags = normalizeUserTags(job.userTags);
  const token = await getValidInstagramAccessToken(job.instagramAccountId);
  const tenantId = job.instagramAccount.userId;

  await prisma.instagramPublishJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", lastAttemptAt: new Date() },
  });

  try {
    let containerId: string;

    if (job.type === "STORY") {
      if (
        media.length !== 1 ||
        !["IMAGE", "VIDEO"].includes(media[0].type)
      ) {
        throw new Error("Story باید دقیقاً یک تصویر یا ویدیو داشته باشد.");
      }

      containerId = await createStoryContainer(
        job.instagramAccount.igUserId,
        token,
        media[0],
        tenantId,
        job.instagramAccountId,
      );
    } else if (job.type === "POST") {
      if (media.length !== 1 || media[0].type !== "IMAGE") {
        throw new Error("POST باید دقیقاً یک تصویر داشته باشد.");
      }

      containerId = await createImageContainer(
        job.instagramAccount.igUserId,
        token,
        media[0],
        job.caption,
        false,
        tags,
        tenantId,
        job.instagramAccountId,
      );
    } else if (job.type === "REEL") {
      if (media.length !== 1 || media[0].type !== "VIDEO") {
        throw new Error("Reel باید دقیقاً یک ویدیو داشته باشد.");
      }

      containerId = await createReelContainer(
        job.instagramAccount.igUserId,
        token,
        media[0],
        job.caption,
        tags,
        tenantId,
        job.instagramAccountId,
      );
    } else {
      if (
        media.length < 2 ||
        media.length > 10 ||
        media.some((item) => item.type !== "IMAGE")
      ) {
        throw new Error("Carousel باید بین ۲ تا ۱۰ تصویر داشته باشد.");
      }

      const children: string[] = [];

      for (const item of media) {
        const childId = await createImageContainer(
          job.instagramAccount.igUserId,
          token,
          item,
          null,
          true,
          undefined,
          tenantId,
          job.instagramAccountId,
          "PUBLISH_CAROUSEL",
        );

        await waitReady(childId, token, job.instagramAccountId, tenantId, 3000, 20, "PUBLISH_CAROUSEL");
        children.push(childId);
      }

      containerId = await createCarouselContainer(
        job.instagramAccount.igUserId,
        token,
        children,
        job.caption,
        tenantId,
        job.instagramAccountId,
      );
    }

    await prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHING",
        instagramContainerId: containerId,
      },
    });

    const publishOperation = job.type === "REEL" ? "PUBLISH_REEL" : job.type === "CAROUSEL" ? "PUBLISH_CAROUSEL" : job.type === "STORY" ? "PUBLISH_STORY" : "PUBLISH_MEDIA";
    await waitReady(containerId, token, job.instagramAccountId, tenantId, 3000, 20, publishOperation);

    const instagramMediaId = await publishContainer(
      job.instagramAccount.igUserId,
      token,
      containerId,
      tenantId,
      job.instagramAccountId,
      publishOperation,
    );

    await bindConditionalAutomations(job, instagramMediaId);

    const updatedJob = await prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        instagramMediaId,
        errorMessage: null,
      },
      include: { media: true },
    });

    await cleanupPublishedMedia(updatedJob.media);

    return updatedJob;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instagram publishing failed.";

    await prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        retryCount: { increment: 1 },
      },
    });

    throw error;
  }
}
