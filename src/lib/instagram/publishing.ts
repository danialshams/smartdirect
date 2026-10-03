import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { InstagramApiError, instagramApiRequest } from "@/lib/instagram/client";
import { getStorageProvider } from "@/lib/storage/provider";
import { invalidateAutomationCache } from "@/lib/cache/instagram";
import {
  claimPublishingExecution,
  completePublishingExecution,
  failPublishingExecution,
} from "@/lib/idempotency/publishing";

type ContainerResponse = { id?: string; status_code?: string; status?: string };
type PublishResponse = { id?: string };
type MediaItem = { type: "IMAGE" | "VIDEO"; publicUrl: string; sortOrder: number };
type UserTag = { username: string; x?: number; y?: number };

type PublishingQuotaResponse = {
  data?: Array<{ quota_usage?: number; config?: { quota_total?: number; quota_duration?: number } }>;
};

async function checkPublishingQuota(igUserId: string, token: string, instagramAccountId: string, tenantId: string) {
  try {
    const response = await instagramApiRequest<PublishingQuotaResponse>(
      `/${igUserId}/content_publishing_limit`,
      {
        accessToken: token,
        params: { fields: "quota_usage,config{quota_total,quota_duration}" },
        timeoutMs: 10_000,
        maxRetries: 1,
        rateLimit: { instagramAccountId, tenantId, operation: "PUBLISH_QUOTA_READ" },
      },
    );
    const quota = response.data?.[0];
    const usage = Number(quota?.quota_usage);
    const total = Number(quota?.config?.quota_total);
    if (Number.isFinite(usage) && Number.isFinite(total) && total > 0 && usage >= total) {
      throw new Error(`Instagram publishing quota reached (${usage}/${total}).`);
    }
    return { usage: Number.isFinite(usage) ? usage : null, total: Number.isFinite(total) ? total : null };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Instagram publishing quota reached")) throw error;
    console.warn("[Instagram Publishing] quota preflight unavailable; Meta remains authoritative.", {
      instagramAccountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function normalizeUserTags(value: unknown): UserTag[] {
  const rawTags: unknown[] = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).tags)
      ? (value as Record<string, unknown>).tags as unknown[]
      : [];

  const usernames = rawTags
    .filter(
      (item): item is { username: string } =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).username === "string" &&
        String((item as Record<string, unknown>).username).trim().length > 0,
    )
    .map((item) => item.username.replace(/^@/, "").trim())
    .filter(Boolean);

  const positions = [
    { x: 0.5, y: 0.5 },
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.5 },
    { x: 0.3, y: 0.3 },
    { x: 0.7, y: 0.3 },
    { x: 0.3, y: 0.7 },
    { x: 0.7, y: 0.7 },
    { x: 0.5, y: 0.3 },
    { x: 0.5, y: 0.7 },
    { x: 0.5, y: 0.5 },
  ];

  return usernames.map((username, index) => ({
    username,
    ...(positions[index] ?? positions[positions.length - 1]),
  }));
}

function normalizeMediaUserTags(value: unknown, mediaKey: string, sortOrder: number): UserTag[] {
  if (!value || typeof value !== "object") return [];
  const media = (value as Record<string, unknown>).media;
  if (!media || typeof media !== "object") return [];
  const rawTags = (media as Record<string, unknown>)[mediaKey]
    ?? (media as Record<string, unknown>)[String(sortOrder)]
    ?? [];
  return normalizeUserTags(rawTags);
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

  await invalidateAutomationCache(instagramAccountId);
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

async function publishInstagramJobInternal(jobId: string) {
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

  const idempotency = await claimPublishingExecution({
    instagramAccountId: job.instagramAccountId,
    publishingJobId: job.id,
  });

  if (!idempotency.claimed) {
    return job;
  }

  const idempotencyKey = idempotency.key;
  const idempotencyLeaseToken = idempotency.leaseToken;

  const tags = normalizeUserTags(job.userTags);
  const token = await getValidInstagramAccessToken(job.instagramAccountId);
  const tenantId = job.instagramAccount.userId;

  await checkPublishingQuota(job.instagramAccount.igUserId, token, job.instagramAccountId, tenantId);

  if (job.status === "PUBLISHED" && job.instagramMediaId) {
    await completePublishingExecution(
      idempotencyKey,
      { publishingJobId: job.id, instagramMediaId: job.instagramMediaId },
      idempotencyLeaseToken,
    );
    return job;
  }

  const publishOperation = job.type === "REEL"
    ? "PUBLISH_REEL"
    : job.type === "CAROUSEL"
      ? "PUBLISH_CAROUSEL"
      : job.type === "STORY"
        ? "PUBLISH_STORY"
        : "PUBLISH_MEDIA";

  let reusableContainerId: string | null = null;
  if (job.instagramContainerId && (job.status === "PROCESSING" || job.status === "PUBLISHING")) {
    try {
      const existingStatus = await containerStatus(
        job.instagramContainerId,
        token,
        job.instagramAccountId,
        tenantId,
        publishOperation,
      );
      if (existingStatus.statusCode === "FINISHED") {
        reusableContainerId = job.instagramContainerId;
      } else if (existingStatus.statusCode === "IN_PROGRESS") {
        await waitReady(job.instagramContainerId, token, job.instagramAccountId, tenantId, 3000, 20, publishOperation);
        reusableContainerId = job.instagramContainerId;
      } else if (existingStatus.statusCode === "PUBLISHED") {
        throw new Error("Instagram container is already published but the final media ID was not persisted. Manual reconciliation is required.");
      }
    } catch (error) {
      if (error instanceof InstagramApiError) {
        console.warn("[Instagram Publishing] existing container reconciliation failed; creating a fresh container.", {
          publishingJobId: job.id,
          containerId: job.instagramContainerId,
          status: error.status,
        });
      } else if (error instanceof Error && error.message.includes("already published")) {
        throw error;
      }
    }
  }

  await prisma.instagramPublishJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", lastAttemptAt: new Date() },
  });

  try {
    let containerId: string = reusableContainerId ?? "";

    if (!containerId) {
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
        const mediaRecord = job.media.find((mediaItem) => mediaItem.sortOrder === item.sortOrder);
        const childId = await createImageContainer(
          job.instagramAccount.igUserId,
          token,
          item,
          null,
          true,
          normalizeMediaUserTags(job.userTags, mediaRecord?.storageKey ?? "", item.sortOrder),
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

  }

    await prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHING",
        instagramContainerId: containerId,
      },
    });

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

    await completePublishingExecution(
      idempotencyKey,
      {
        publishingJobId: job.id,
        instagramMediaId,
      },
      idempotencyLeaseToken,
    );

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

    try {
      await failPublishingExecution(idempotencyKey, error, idempotencyLeaseToken);
    } catch (idempotencyError) {
      console.error("Failed to mark publishing idempotency as FAILED:", idempotencyError);
    }

    throw error;
  }
}

export async function publishInstagramJob(jobId: string) {
  const startedAt = Date.now();

  try {
    const result = await publishInstagramJobInternal(jobId);
    const { recordLatency } = await import("@/lib/observability/metrics");
    void recordLatency("publishing", Date.now() - startedAt);
    return result;
  } catch (error) {
    const { recordLatency, recordFailure } = await import("@/lib/observability/metrics");
    void recordLatency("publishing", Date.now() - startedAt);
    void recordFailure(
      "publishing",
      error instanceof Error ? error.constructor.name : "unknown",
    );
    throw error;
  }
}
