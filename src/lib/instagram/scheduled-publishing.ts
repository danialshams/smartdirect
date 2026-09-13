import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";
const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;
const LEASE_MS = 45_000;

type ApiError = {
  message?: string;
};

type ApiResponse = {
  id?: string;
  status_code?: string;
  status?: string;
  error?: ApiError;
};

type WorkerMedia = {
  type: "IMAGE" | "VIDEO";
  publicUrl: string;
  sortOrder: number;
};

type CarouselState = {
  kind: "CAROUSEL_CHILDREN";
  ids: string[];
};

async function instagramRequest(
  path: string,
  accessToken: string,
  body?: Record<string, string>,
) {
  const response = await fetch(`${INSTAGRAM_GRAPH_URL}${path}`, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let data: ApiResponse = {};

  try {
    data = text ? (JSON.parse(text) as ApiResponse) : {};
  } catch {
    throw new Error("Instagram پاسخ JSON معتبر برنگرداند.");
  }

  return { response, data };
}

function apiError(data: ApiResponse, fallback: string) {
  return data.error?.message || fallback;
}

async function createContainer(
  igUserId: string,
  accessToken: string,
  media: WorkerMedia,
  type: "POST" | "REEL" | "CAROUSEL_ITEM",
  caption?: string | null,
) {
  const body: Record<string, string> = {
    access_token: accessToken,
  };

  if (type === "POST") {
    body.image_url = media.publicUrl;
    if (caption) body.caption = caption;
  } else if (type === "REEL") {
    body.media_type = "REELS";
    body.video_url = media.publicUrl;
    if (caption) body.caption = caption;
  } else {
    body.image_url = media.publicUrl;
    body.is_carousel_item = "true";
  }

  const { response, data } = await instagramRequest(
    `/${igUserId}/media`,
    accessToken,
    body,
  );

  if (!response.ok || !data.id) {
    throw new Error(apiError(data, "ساخت Instagram container ناموفق بود."));
  }

  return data.id;
}

async function createCarouselContainer(
  igUserId: string,
  accessToken: string,
  children: string[],
  caption?: string | null,
) {
  const body: Record<string, string> = {
    media_type: "CAROUSEL",
    children: JSON.stringify(children),
    access_token: accessToken,
  };

  if (caption) body.caption = caption;

  const { response, data } = await instagramRequest(
    `/${igUserId}/media`,
    accessToken,
    body,
  );

  if (!response.ok || !data.id) {
    throw new Error(
      apiError(data, "ساخت Instagram Carousel container ناموفق بود."),
    );
  }

  return data.id;
}

async function getContainerStatus(containerId: string, accessToken: string) {
  const params = new URLSearchParams({
    fields: "status_code,status",
    access_token: accessToken,
  });

  const { response, data } = await instagramRequest(
    `/${containerId}?${params.toString()}`,
    accessToken,
  );

  if (!response.ok) {
    throw new Error(
      apiError(data, "دریافت وضعیت Instagram container ناموفق بود."),
    );
  }

  return String(data.status_code ?? data.status ?? "").toUpperCase();
}

async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string,
) {
  const { response, data } = await instagramRequest(
    `/${igUserId}/media_publish`,
    accessToken,
    {
      creation_id: containerId,
      access_token: accessToken,
    },
  );

  if (!response.ok || !data.id) {
    throw new Error(
      apiError(data, "انتشار محتوا در Instagram ناموفق بود."),
    );
  }

  return data.id;
}

function isLeasable(lastAttemptAt: Date | null) {
  return !lastAttemptAt || Date.now() - lastAttemptAt.getTime() >= LEASE_MS;
}

async function claimJob(jobId: string, status: "SCHEDULED" | "PROCESSING" | "PUBLISHING") {
  const now = new Date();
  const result = await prisma.instagramPublishJob.updateMany({
    where: {
      id: jobId,
      status,
      OR: [
        { lastAttemptAt: null },
        { lastAttemptAt: { lte: new Date(now.getTime() - LEASE_MS) } },
      ],
    },
    data: {
      lastAttemptAt: now,
    },
  });

  return result.count === 1;
}

async function failJob(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Instagram publishing failed.";

  await prisma.instagramPublishJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage: message,
      retryCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  return message;
}

export async function processScheduledInstagramJob(jobId: string) {
  const job = await prisma.instagramPublishJob.findUnique({
    where: { id: jobId },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      instagramAccount: true,
    },
  });

  if (!job || !job.instagramAccount.isConnected || !job.media.length) {
    return { processed: false, published: false, skipped: true };
  }

  if (job.status === "SCHEDULED") {
    if (!job.scheduledAt || job.scheduledAt.getTime() > Date.now()) {
      return { processed: false, published: false, skipped: true };
    }

    if (!(await claimJob(job.id, "SCHEDULED"))) {
      return { processed: false, published: false, skipped: true };
    }

    try {
      const accessToken = await getValidInstagramAccessToken(job.instagramAccountId);
      const media: WorkerMedia[] = job.media.map((item) => {
        if (!item.publicUrl) {
          throw new Error(`فایل ${item.fileName ?? item.id} URL عمومی ندارد.`);
        }
        return {
          type: item.type,
          publicUrl: item.publicUrl,
          sortOrder: item.sortOrder,
        };
      });

      if (job.type === "POST") {
        if (media.length !== 1 || media[0].type !== "IMAGE") {
          throw new Error("POST باید دقیقاً یک تصویر داشته باشد.");
        }

        const containerId = await createContainer(
          job.instagramAccount.igUserId,
          accessToken,
          media[0],
          "POST",
          job.caption,
        );

        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: {
            status: "PROCESSING",
            instagramContainerId: containerId,
            errorMessage: null,
            lastAttemptAt: new Date(),
          },
        });
      } else if (job.type === "REEL") {
        if (media.length !== 1 || media[0].type !== "VIDEO") {
          throw new Error("REEL باید دقیقاً یک ویدیو داشته باشد.");
        }

        const containerId = await createContainer(
          job.instagramAccount.igUserId,
          accessToken,
          media[0],
          "REEL",
          job.caption,
        );

        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: {
            status: "PROCESSING",
            instagramContainerId: containerId,
            errorMessage: null,
            lastAttemptAt: new Date(),
          },
        });
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
          children.push(
            await createContainer(
              job.instagramAccount.igUserId,
              accessToken,
              item,
              "CAROUSEL_ITEM",
            ),
          );
        }

        const state: CarouselState = {
          kind: "CAROUSEL_CHILDREN",
          ids: children,
        };

        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: {
            status: "PROCESSING",
            instagramContainerId: JSON.stringify(state),
            errorMessage: null,
            lastAttemptAt: new Date(),
          },
        });
      }

      return { processed: true, published: false, skipped: false };
    } catch (error) {
      return {
        processed: true,
        published: false,
        skipped: false,
        error: await failJob(job.id, error),
      };
    }
  }

  if (job.status !== "PROCESSING" && job.status !== "PUBLISHING") {
    return { processed: false, published: false, skipped: true };
  }

  if (!job.instagramContainerId || !isLeasable(job.lastAttemptAt)) {
    return { processed: false, published: false, skipped: true };
  }

  const currentStatus = job.status;
  if (!(await claimJob(job.id, currentStatus))) {
    return { processed: false, published: false, skipped: true };
  }

  try {
    const accessToken = await getValidInstagramAccessToken(job.instagramAccountId);
    let containerId = job.instagramContainerId;

    if (currentStatus === "PROCESSING") {
      let carouselState: CarouselState | null = null;
      try {
        const parsed = JSON.parse(job.instagramContainerId) as Partial<CarouselState>;
        if (parsed.kind === "CAROUSEL_CHILDREN" && Array.isArray(parsed.ids)) {
          carouselState = { kind: "CAROUSEL_CHILDREN", ids: parsed.ids };
        }
      } catch {
        carouselState = null;
      }

      if (carouselState) {
        const statuses = await Promise.all(
          carouselState.ids.map((id) => getContainerStatus(id, accessToken)),
        );

        if (statuses.some((status) => status === "ERROR" || status === "EXPIRED")) {
          throw new Error("Instagram Carousel child container پردازش نشد.");
        }

        if (!statuses.every((status) => status === "FINISHED")) {
          await prisma.instagramPublishJob.update({
            where: { id: job.id },
            data: { lastAttemptAt: new Date() },
          });
          return { processed: true, published: false, skipped: false, waiting: true };
        }

        containerId = await createCarouselContainer(
          job.instagramAccount.igUserId,
          accessToken,
          carouselState.ids,
          job.caption,
        );

        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: {
            status: "PUBLISHING",
            instagramContainerId: containerId,
            lastAttemptAt: new Date(),
          },
        });

        return { processed: true, published: false, skipped: false, waiting: true };
      }

      const status = await getContainerStatus(containerId, accessToken);

      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error(`Instagram container failed with status: ${status}`);
      }

      if (status !== "FINISHED") {
        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: { lastAttemptAt: new Date() },
        });
        return { processed: true, published: false, skipped: false, waiting: true };
      }

      await prisma.instagramPublishJob.update({
        where: { id: job.id },
        data: { status: "PUBLISHING", lastAttemptAt: new Date() },
      });

      return { processed: true, published: false, skipped: false, waiting: true };
    }

    const status = await getContainerStatus(containerId, accessToken);

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram container failed with status: ${status}`);
    }

    if (status !== "FINISHED") {
      await prisma.instagramPublishJob.update({
        where: { id: job.id },
        data: { lastAttemptAt: new Date() },
      });
      return { processed: true, published: false, skipped: false, waiting: true };
    }

    const instagramMediaId = await publishContainer(
      job.instagramAccount.igUserId,
      accessToken,
      containerId,
    );

    const published = await prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        instagramMediaId,
        errorMessage: null,
        lastAttemptAt: new Date(),
      },
    });

    return { processed: true, published: true, skipped: false, job: published };
  } catch (error) {
    return {
      processed: true,
      published: false,
      skipped: false,
      error: await failJob(job.id, error),
    };
  }
}
