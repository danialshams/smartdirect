import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { getStorageProvider } from "@/lib/storage/provider";

const INSTAGRAM_API_VERSION = "v26.0";
const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

type InstagramApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type InstagramApiResponse<T = Record<string, unknown>> = T & {
  error?: InstagramApiError;
};

type ContainerResponse = {
  id?: string;
  status_code?: string;
  status?: string;
  error?: InstagramApiError;
};

type PublishResponse = {
  id?: string;
  error?: InstagramApiError;
};

type MediaItem = {
  type: "IMAGE" | "VIDEO";
  publicUrl: string;
  sortOrder: number;
};

function getErrorMessage(
  data: InstagramApiResponse | undefined,
  fallback: string,
) {
  return data?.error?.message || fallback;
}

async function instagramRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{
  response: Response;
  data: InstagramApiResponse<T>;
}> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30_000);

  try {
    const response = await fetch(`${INSTAGRAM_GRAPH_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();

    let data = {} as InstagramApiResponse<T>;

    try {
      data = text
        ? (JSON.parse(text) as InstagramApiResponse<T>)
        : ({} as InstagramApiResponse<T>);
    } catch {
      throw new Error("Instagram پاسخ JSON معتبر برنگرداند.");
    }

    return {
      response,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createImageContainer(
  igUserId: string,
  accessToken: string,
  media: MediaItem,
  caption?: string | null,
  isCarouselItem = false,
) {
  const body: Record<string, string> = {
    image_url: media.publicUrl,
    access_token: accessToken,
  };

  if (caption && !isCarouselItem) {
    body.caption = caption;
  }

  if (isCarouselItem) {
    body.is_carousel_item = "true";
  }

  const { response, data } = await instagramRequest<ContainerResponse>(
    `/${igUserId}/media`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!response.ok || !data.id) {
    throw new Error(
      getErrorMessage(data, "ساخت Instagram image container ناموفق بود."),
    );
  }

  return data.id;
}

async function createReelContainer(
  igUserId: string,
  accessToken: string,
  media: MediaItem,
  caption?: string | null,
) {
  const body: Record<string, string> = {
    media_type: "REELS",
    video_url: media.publicUrl,
    access_token: accessToken,
  };

  if (caption) {
    body.caption = caption;
  }

  const { response, data } = await instagramRequest<ContainerResponse>(
    `/${igUserId}/media`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!response.ok || !data.id) {
    throw new Error(
      getErrorMessage(data, "ساخت Instagram Reel container ناموفق بود."),
    );
  }

  return data.id;
}

async function createStoryContainer(
  igUserId: string,
  accessToken: string,
  media: MediaItem,
) {
  const body: Record<string, string> = {
    media_type: "STORIES",
    access_token: accessToken,
  };

  if (media.type === "IMAGE") {
    body.image_url = media.publicUrl;
  } else {
    body.video_url = media.publicUrl;
  }

  const { response, data } = await instagramRequest<ContainerResponse>(
    `/${igUserId}/media`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!response.ok || !data.id) {
    throw new Error(
      getErrorMessage(data, "ساخت Instagram Story container ناموفق بود."),
    );
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

  if (caption) {
    body.caption = caption;
  }

  const { response, data } = await instagramRequest<ContainerResponse>(
    `/${igUserId}/media`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!response.ok || !data.id) {
    throw new Error(
      getErrorMessage(data, "ساخت Instagram Carousel container ناموفق بود."),
    );
  }

  return data.id;
}

async function getContainerStatus(containerId: string, accessToken: string) {
  const params = new URLSearchParams({
    fields: "status_code,status",
    access_token: accessToken,
  });

  const { response, data } = await instagramRequest<ContainerResponse>(
    `/${containerId}?${params.toString()}`,
    accessToken,
  );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "دریافت وضعیت Instagram container ناموفق بود."),
    );
  }

  return {
    statusCode: data.status_code ?? null,
    status: data.status ?? null,
  };
}

async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxAttempts = 20,
  delayMs = 3000,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getContainerStatus(containerId, accessToken);

    const statusCode = String(status.statusCode ?? "").toUpperCase();

    if (statusCode === "FINISHED") {
      return;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`Instagram container failed with status: ${statusCode}`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  throw new Error("Instagram container در زمان مجاز آماده نشد.");
}

async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string,
) {
  const { response, data } = await instagramRequest<PublishResponse>(
    `/${igUserId}/media_publish`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    },
  );

  if (!response.ok || !data.id) {
    throw new Error(
      getErrorMessage(data, "انتشار محتوا در Instagram ناموفق بود."),
    );
  }

  return data.id;
}

async function cleanupPublishedMedia(
  mediaItems: Array<{
    id: string;
    storageKey: string;
    deletedAt: Date | null;
  }>,
) {
  const storageProvider = getStorageProvider();

  for (const item of mediaItems) {
    if (item.deletedAt || item.storageKey.startsWith("test:")) {
      continue;
    }

    try {
      await storageProvider.delete(item.storageKey);

      await prisma.instagramPublishMedia.update({
        where: {
          id: item.id,
        },
        data: {
          deletedAt: new Date(),
        },
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

export async function publishInstagramJob(jobId: string) {
  const job = await prisma.instagramPublishJob.findUnique({
    where: {
      id: jobId,
    },
    include: {
      media: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      instagramAccount: true,
    },
  });

  if (!job) {
    throw new Error("Publishing job پیدا نشد.");
  }

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

  const accessToken = await getValidInstagramAccessToken(
    job.instagramAccountId,
  );

  await prisma.instagramPublishJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "PROCESSING",
      lastAttemptAt: new Date(),
    },
  });

  try {
    let containerId: string;

    /*
     * STORY
     * یک Story فقط یک فایل می‌گیرد:
     * - یک تصویر
     * - یا یک ویدیو
     */
    if (job.type === "STORY") {
      if (media.length !== 1) {
        throw new Error("Story باید دقیقاً یک فایل داشته باشد.");
      }

      if (media[0].type !== "IMAGE" && media[0].type !== "VIDEO") {
        throw new Error("Story باید تصویر یا ویدیو باشد.");
      }

      containerId = await createStoryContainer(
        job.instagramAccount.igUserId,
        accessToken,
        media[0],
      );
    } else if (job.type === "POST") {
      if (media.length !== 1 || media[0].type !== "IMAGE") {
        throw new Error("POST باید دقیقاً یک تصویر داشته باشد.");
      }

      containerId = await createImageContainer(
        job.instagramAccount.igUserId,
        accessToken,
        media[0],
        job.caption,
      );
    } else if (job.type === "REEL") {
      if (media.length !== 1 || media[0].type !== "VIDEO") {
        throw new Error("Reel باید دقیقاً یک ویدیو داشته باشد.");
      }

      containerId = await createReelContainer(
        job.instagramAccount.igUserId,
        accessToken,
        media[0],
        job.caption,
      );
    } else {
      /*
       * CAROUSEL
       */
      if (media.length < 2 || media.length > 10) {
        throw new Error("Carousel باید بین ۲ تا ۱۰ فایل داشته باشد.");
      }

      if (media.some((item) => item.type !== "IMAGE")) {
        throw new Error("Carousel فعلاً فقط از تصاویر پشتیبانی می‌کند.");
      }

      const children: string[] = [];

      for (const item of media) {
        const childId = await createImageContainer(
          job.instagramAccount.igUserId,
          accessToken,
          item,
          null,
          true,
        );

        await waitForContainerReady(childId, accessToken);

        children.push(childId);
      }

      containerId = await createCarouselContainer(
        job.instagramAccount.igUserId,
        accessToken,
        children,
        job.caption,
      );
    }

    await prisma.instagramPublishJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "PUBLISHING",
        instagramContainerId: containerId,
      },
    });

    await waitForContainerReady(containerId, accessToken);

    const instagramMediaId = await publishContainer(
      job.instagramAccount.igUserId,
      accessToken,
      containerId,
    );

    const updatedJob = await prisma.instagramPublishJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        instagramMediaId,
        errorMessage: null,
      },
      include: {
        media: true,
      },
    });

    await cleanupPublishedMedia(updatedJob.media);

    return updatedJob;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instagram publishing failed.";

    await prisma.instagramPublishJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
        retryCount: {
          increment: 1,
        },
      },
    });

    throw error;
  }
}
