import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { InstagramApiError, instagramApiRequest } from "@/lib/instagram/client";
import { deletePublishMediaStorage } from "@/lib/instagram/publishing-media-cleanup";
import { invalidateAutomationCache } from "@/lib/cache/instagram";
import {
  claimPublishingExecution,
  completePublishingExecution,
  failPublishingExecution,
} from "@/lib/idempotency/publishing";

type ContainerResponse = { id?: string; status_code?: string; status?: string };
type ContainerWaitContext = {
  publishingJobId?: string;
  stage?: string;
  slideNumber?: number;
  mediaType?: "IMAGE" | "VIDEO";
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  mediaUrlHost?: string | null;
  mediaUrlExtension?: string | null;
  mediaUrlHasQuery?: boolean | null;
};
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

/**
 * Verify that Meta's source URL is publicly readable and begins with an MP4
 * container signature. This is diagnostic only: it never logs the full URL,
 * follows redirects, downloads the whole file, or blocks publishing on failure.
 */
async function diagnosePublicVideoUrl(
  publicUrl: string,
  context: { publishingJobId: string; slideNumber: number; fileName?: string | null },
) {
  const startedAt = Date.now();
  let parsed: URL;
  try {
    parsed = new URL(publicUrl);
  } catch {
    console.error("[Instagram Publishing] video source probe rejected invalid URL", {
      ...context,
      reason: "INVALID_URL",
    });
    return;
  }

  // Restrict this diagnostic fetch to HTTPS Vercel Blob public URLs to avoid
  // turning a user-controlled media URL into a server-side request primitive.
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    console.warn("[Instagram Publishing] video source probe skipped", {
      ...context,
      reason: "URL_NOT_ON_ALLOWED_PUBLIC_BLOB_HOST",
      protocol: parsed.protocol,
      host: parsed.hostname,
      elapsedMs: Date.now() - startedAt,
    });
    return;
  }

  const result: Record<string, unknown> = {
    ...context,
    host: parsed.hostname,
    urlHasQuery: parsed.search.length > 0,
  };

  try {
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 5000);
    try {
      const response = await fetch(parsed, {
        method: "HEAD",
        redirect: "manual",
        cache: "no-store",
        signal: headController.signal,
      });
      result.headStatus = response.status;
      result.headOk = response.ok;
      result.headContentType = response.headers.get("content-type");
      result.headContentLength = response.headers.get("content-length");
      result.headAcceptRanges = response.headers.get("accept-ranges");
      result.headRedirected = response.status >= 300 && response.status < 400;
      result.headRedirectHost = (() => {
        const location = response.headers.get("location");
        if (!location) return null;
        try { return new URL(location, parsed).hostname; } catch { return "invalid-location"; }
      })();
      await response.body?.cancel().catch(() => undefined);
    } finally {
      clearTimeout(headTimeout);
    }

    const rangeController = new AbortController();
    const rangeTimeout = setTimeout(() => rangeController.abort(), 5000);
    try {
      const response = await fetch(parsed, {
        method: "GET",
        headers: { Range: "bytes=0-63" },
        redirect: "manual",
        cache: "no-store",
        signal: rangeController.signal,
      });
      result.rangeStatus = response.status;
      result.rangeOk = response.ok;
      result.rangeContentType = response.headers.get("content-type");
      result.rangeContentLength = response.headers.get("content-length");
      result.rangeContentRange = response.headers.get("content-range");
      result.rangeRedirected = response.status >= 300 && response.status < 400;
      result.rangeRedirectHost = (() => {
        const location = response.headers.get("location");
        if (!location) return null;
        try { return new URL(location, parsed).hostname; } catch { return "invalid-location"; }
      })();

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        try {
          while (total < 64) {
            const part = await reader.read();
            if (part.done) break;
            const remaining = 64 - total;
            const chunk = part.value.subarray(0, remaining);
            chunks.push(chunk);
            total += chunk.byteLength;
            if (chunk.byteLength === 0) break;
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const ascii = (start: number, end: number) =>
          Array.from(bytes.subarray(start, end)).map((byte) => String.fromCharCode(byte)).join("");
        result.rangeBytesRead = total;
        result.mp4FtypAtOffset4 = total >= 8 && ascii(4, 8) === "ftyp";
        result.first16BytesHex = Array.from(bytes.subarray(0, 16))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      } else {
        await response.body?.cancel().catch(() => undefined);
      }
    } finally {
      clearTimeout(rangeTimeout);
    }

    // A short signature probe cannot reveal truncated MP4s or codec/container metadata.
    // Inspect the complete file only when it is small enough for a bounded diagnostic.
    const headLength = typeof result.headContentLength === "string" ? Number(result.headContentLength) : Number.NaN;
    const maxDiagnosticBytes = 8 * 1024 * 1024;
    if (Number.isFinite(headLength) && headLength > maxDiagnosticBytes) {
      result.mp4Inspection = "SKIPPED_FILE_OVER_DIAGNOSTIC_LIMIT";
      result.mp4InspectionBytesLimit = maxDiagnosticBytes;
    } else {
      const fileController = new AbortController();
      const fileTimeout = setTimeout(() => fileController.abort(), 8000);
      try {
        const fileResponse = await fetch(parsed, {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal: fileController.signal,
        });
        result.fullGetStatus = fileResponse.status;
        result.fullGetContentType = fileResponse.headers.get("content-type");
        const declaredLengthHeader = fileResponse.headers.get("content-length");
        const declaredLength = declaredLengthHeader ? Number(declaredLengthHeader) : Number.NaN;
        if (declaredLength > maxDiagnosticBytes) {
          result.mp4Inspection = "SKIPPED_FILE_OVER_DIAGNOSTIC_LIMIT";
          await fileResponse.body?.cancel().catch(() => undefined);
        } else if (fileResponse.status !== 200 || !fileResponse.body) {
          result.mp4Inspection = "FULL_GET_NOT_HTTP_200";
          await fileResponse.body?.cancel().catch(() => undefined);
        } else {
          const reader = fileResponse.body.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          let tooLarge = false;
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              total += part.value.byteLength;
              if (total > maxDiagnosticBytes) {
                tooLarge = true;
                break;
              }
              chunks.push(part.value);
            }
          } finally {
            if (tooLarge) await reader.cancel().catch(() => undefined);
          }
          if (tooLarge) {
            result.mp4Inspection = "SKIPPED_STREAM_OVER_DIAGNOSTIC_LIMIT";
          } else {
            const bytes = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) {
              bytes.set(chunk, offset);
              offset += chunk.byteLength;
            }
            const readU32 = (at: number) =>
              at + 4 <= bytes.length
                ? bytes[at] * 0x1000000 + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3]
                : 0;
            const asciiAt = (at: number, length: number) =>
              Array.from(bytes.subarray(at, at + length)).map((byte) => String.fromCharCode(byte)).join("");
            const topLevelBoxes: string[] = [];
            let cursor = 0;
            let malformed = false;
            while (cursor + 8 <= bytes.length) {
              let boxSize = readU32(cursor);
              const boxType = asciiAt(cursor + 4, 4);
              let headerSize = 8;
              if (boxSize === 1) {
                if (cursor + 16 > bytes.length) { malformed = true; break; }
                const high = readU32(cursor + 8);
                const low = readU32(cursor + 12);
                const extendedSize = high * 0x100000000 + low;
                if (!Number.isSafeInteger(extendedSize)) { malformed = true; break; }
                boxSize = extendedSize;
                headerSize = 16;
              } else if (boxSize === 0) {
                boxSize = bytes.length - cursor;
              }
              if (boxSize < headerSize || boxSize > bytes.length - cursor) {
                malformed = true;
                break;
              }
              topLevelBoxes.push(boxType);
              cursor += boxSize;
            }
            if (cursor !== bytes.length) malformed = true;
            const containsAscii = (needle: string) => {
              for (let start = 0; start <= bytes.length - needle.length; start++) {
                let match = true;
                for (let index = 0; index < needle.length; index++) {
                  if (bytes[start + index] !== needle.charCodeAt(index)) {
                    match = false;
                    break;
                  }
                }
                if (match) return true;
              }
              return false;
            };
            const codecs = ["avc1", "avc3", "hvc1", "hev1", "mp4a", "ac-3", "ec-3", "Opus"]
              .filter(containsAscii);
            result.mp4Inspection = "COMPLETED";
            result.mp4BytesRead = bytes.length;
            result.mp4DeclaredLengthMatches = !Number.isFinite(declaredLength) || declaredLength === bytes.length;
            result.mp4TopLevelBoxes = topLevelBoxes;
            result.mp4HasFtyp = topLevelBoxes.includes("ftyp");
            result.mp4HasMoov = topLevelBoxes.includes("moov");
            result.mp4HasMdat = topLevelBoxes.includes("mdat");
            result.mp4MoovBeforeMdat = topLevelBoxes.indexOf("moov") >= 0 &&
              topLevelBoxes.indexOf("mdat") >= 0 &&
              topLevelBoxes.indexOf("moov") < topLevelBoxes.indexOf("mdat");
            result.mp4BoxStructureMalformed = malformed;
            result.mp4CodecMarkers = codecs;
          }
        }
      } finally {
        clearTimeout(fileTimeout);
      }
    }

    console.info("[Instagram Publishing] video source probe", {
      ...result,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[Instagram Publishing] video source probe failed", {
      ...result,
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
  }
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
  const body: Record<string, unknown> = carousel && media.type === "VIDEO"
    ? { media_type: "VIDEO", video_url: media.publicUrl, is_carousel_item: true }
    : { image_url: media.publicUrl, ...(carousel ? { is_carousel_item: true } : {}) };
  if (caption && !carousel) body.caption = caption;
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

async function containerStatus(id: string, token: string, instagramAccountId: string, tenantId?: string) {
  const data = await instagramApiRequest<ContainerResponse>(`/${id}`, {
    accessToken: token,
    params: { fields: "status_code,status" },
    timeoutMs: 30_000,
    rateLimit: { instagramAccountId, operation: "PUBLISH_CONTAINER_STATUS", ...(tenantId ? { tenantId } : {}) },
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
  context: ContainerWaitContext = {},
) {
  const startedAt = Date.now();
  let lastLoggedCode: string | null = null;
  let lastStatus: { statusCode: string | null; status: string | null } = {
    statusCode: null,
    status: null,
  };

  console.info("[Instagram Publishing] waiting for media container", {
    publishingJobId: context.publishingJobId ?? null,
    containerId: id,
    stage: context.stage ?? "unknown",
    slideNumber: context.slideNumber ?? null,
    mediaType: context.mediaType ?? null,
    fileName: context.fileName ?? null,
    mimeType: context.mimeType ?? null,
    fileSizeBytes: context.fileSizeBytes ?? null,
    mediaUrlHost: context.mediaUrlHost ?? null,
    mediaUrlExtension: context.mediaUrlExtension ?? null,
    mediaUrlHasQuery: context.mediaUrlHasQuery ?? null,
    maxAttempts,
    pollIntervalMs: delayMs,
  });

  for (let i = 0; i < maxAttempts; i += 1) {
    const status = await containerStatus(id, token, instagramAccountId, tenantId);
    const code = String(status.statusCode ?? "").toUpperCase();
    lastStatus = status;

    // Log the first response, state transitions, and periodic checkpoints.
    // This keeps production logs useful without emitting one line per poll.
    if (i === 0 || code !== lastLoggedCode || (i + 1) % 10 === 0) {
      console.info("[Instagram Publishing] media container status", {
        publishingJobId: context.publishingJobId ?? null,
        containerId: id,
        stage: context.stage ?? "unknown",
        slideNumber: context.slideNumber ?? null,
        mediaType: context.mediaType ?? null,
        fileName: context.fileName ?? null,
        mimeType: context.mimeType ?? null,
        fileSizeBytes: context.fileSizeBytes ?? null,
        mediaUrlHost: context.mediaUrlHost ?? null,
        mediaUrlExtension: context.mediaUrlExtension ?? null,
        mediaUrlHasQuery: context.mediaUrlHasQuery ?? null,
        statusCode: code || null,
        status: status.status,
        attempt: i + 1,
        maxAttempts,
        elapsedMs: Date.now() - startedAt,
      });
      lastLoggedCode = code;
    }

    if (code === "FINISHED") {
      // Meta can report FINISHED a moment before media_publish becomes ready.
      // Keep a short stabilization window before the final publish call.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.info("[Instagram Publishing] media container ready", {
        publishingJobId: context.publishingJobId ?? null,
        containerId: id,
        stage: context.stage ?? "unknown",
        slideNumber: context.slideNumber ?? null,
        mediaType: context.mediaType ?? null,
        elapsedMs: Date.now() - startedAt,
        attempts: i + 1,
      });
      return;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      const diagnostic = {
        publishingJobId: context.publishingJobId ?? null,
        containerId: id,
        stage: context.stage ?? "unknown",
        slideNumber: context.slideNumber ?? null,
        mediaType: context.mediaType ?? null,
        fileName: context.fileName ?? null,
        mimeType: context.mimeType ?? null,
        fileSizeBytes: context.fileSizeBytes ?? null,
        mediaUrlHost: context.mediaUrlHost ?? null,
        mediaUrlExtension: context.mediaUrlExtension ?? null,
        mediaUrlHasQuery: context.mediaUrlHasQuery ?? null,
        statusCode: code,
        status: status.status,
        attempt: i + 1,
        elapsedMs: Date.now() - startedAt,
      };
      console.error("[Instagram Publishing] media container processing failed", diagnostic);
      const location = context.slideNumber ? ` اسلاید ${context.slideNumber}` : "";
      throw new Error(`Instagram container failed with status: ${code}.${location} (containerId=${id}, stage=${context.stage ?? "unknown"})`);
    }

    if (i + 1 < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const diagnostic = {
    publishingJobId: context.publishingJobId ?? null,
    containerId: id,
    stage: context.stage ?? "unknown",
    slideNumber: context.slideNumber ?? null,
    mediaType: context.mediaType ?? null,
    fileName: context.fileName ?? null,
    mimeType: context.mimeType ?? null,
    fileSizeBytes: context.fileSizeBytes ?? null,
    mediaUrlHost: context.mediaUrlHost ?? null,
    mediaUrlExtension: context.mediaUrlExtension ?? null,
    mediaUrlHasQuery: context.mediaUrlHasQuery ?? null,
    lastStatusCode: lastStatus.statusCode,
    lastStatus: lastStatus.status,
    attempts: maxAttempts,
    pollIntervalMs: delayMs,
    elapsedMs: Date.now() - startedAt,
  };
  console.error("[Instagram Publishing] media container wait timed out", diagnostic);
  const location = context.slideNumber ? ` اسلاید ${context.slideNumber}` : "";
  throw new Error(
    `Instagram container timeout after ${Math.round(diagnostic.elapsedMs / 1000)}s${location} (containerId=${id}, stage=${context.stage ?? "unknown"}, lastStatus=${lastStatus.statusCode ?? "UNKNOWN"})`,
  );
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
  items: Array<{ id: string; storageKey: string; publicUrl: string | null; deletedAt: Date | null }>,
) {
  await deletePublishMediaStorage(items);
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
      );
      if (existingStatus.statusCode === "FINISHED") {
        reusableContainerId = job.instagramContainerId;
      } else if (existingStatus.statusCode === "IN_PROGRESS") {
        await waitReady(job.instagramContainerId, token, job.instagramAccountId, tenantId, 3000, 20, {
          publishingJobId: job.id,
          stage: "existing-container",
        });
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
      if (media.length < 2 || media.length > 10) {
        throw new Error("Carousel باید بین ۲ تا ۱۰ تصویر یا ویدیو داشته باشد.");
      }

      const children: string[] = [];

      for (const item of media) {
        const mediaRecord = job.media.find((mediaItem) => mediaItem.sortOrder === item.sortOrder);
        const mediaUrlDiagnostics = (() => {
          try {
            const parsed = new URL(item.publicUrl);
            const lastSegment = parsed.pathname.split("/").pop() ?? "";
            const extension = lastSegment.includes(".") ? lastSegment.split(".").pop()?.toLowerCase() ?? null : null;
            return {
              host: parsed.host,
              extension,
              hasQuery: parsed.search.length > 0,
            };
          } catch {
            return { host: null, extension: null, hasQuery: null };
          }
        })();
        const childDiagnostics = {
          publishingJobId: job.id,
          slideNumber: item.sortOrder + 1,
          mediaType: item.type,
          fileName: mediaRecord?.fileName ?? null,
          mimeType: mediaRecord?.mimeType ?? null,
          fileSizeBytes: mediaRecord?.fileSize ?? null,
          mediaUrlHost: mediaUrlDiagnostics.host,
          mediaUrlExtension: mediaUrlDiagnostics.extension,
          mediaUrlHasQuery: mediaUrlDiagnostics.hasQuery,
        };
        console.info("[Instagram Publishing] carousel child media diagnostics", childDiagnostics);
        if (item.type === "VIDEO") {
          await diagnosePublicVideoUrl(item.publicUrl, {
            publishingJobId: job.id,
            slideNumber: item.sortOrder + 1,
            fileName: mediaRecord?.fileName ?? null,
          });
        }
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

        console.info("[Instagram Publishing] carousel child container created", {
          publishingJobId: job.id,
          slideNumber: item.sortOrder + 1,
          mediaType: item.type,
          containerId: childId,
          mediaHost: (() => { try { return new URL(item.publicUrl).host; } catch { return "invalid-url"; } })(),
        });
        // Video children can remain IN_PROGRESS well beyond one minute while
        // Meta transcodes them. Give videos a bounded three-minute window;
        // keep image processing on the existing shorter timeout.
        const childWaitAttempts = item.type === "VIDEO" ? 60 : 20;
        await waitReady(childId, token, job.instagramAccountId, tenantId, 3000, childWaitAttempts, {
          publishingJobId: job.id,
          stage: "carousel-child",
          slideNumber: item.sortOrder + 1,
          mediaType: item.type,
          fileName: mediaRecord?.fileName ?? null,
          mimeType: mediaRecord?.mimeType ?? null,
          fileSizeBytes: mediaRecord?.fileSize ?? null,
          mediaUrlHost: mediaUrlDiagnostics.host,
          mediaUrlExtension: mediaUrlDiagnostics.extension,
          mediaUrlHasQuery: mediaUrlDiagnostics.hasQuery,
        });
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

    await waitReady(containerId, token, job.instagramAccountId, tenantId, 3000, 20, {
      publishingJobId: job.id,
      stage: job.type === "CAROUSEL" ? "carousel-parent" : `${job.type.toLowerCase()}-container`,
    });

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
      error instanceof InstagramApiError &&
      (error.details?.code === 36003 || error.details?.error_subcode === 2207009)
        ? "اینستاگرام یکی از تصاویر آلبوم را نپذیرفت؛ نسبت تصویر نامعتبر است یا فایل تصویر قابل خواندن نیست. تصویر را با JPG/PNG سالم و نسبت ۴:۵ تا ۱٫۹۱:۱ دوباره آماده و آپلود کن."
        : error instanceof Error ? error.message : "Instagram publishing failed.";

    if (message === "INSTAGRAM_CONCURRENCY_WAIT_TIMEOUT") {
      // Concurrency pressure is transient. Keep the job/container reusable and
      // let the queue's normal retry policy schedule the next attempt.
      await prisma.instagramPublishJob.update({
        where: { id: job.id },
        data: {
          status: job.instagramContainerId ? "PUBLISHING" : "PROCESSING",
          errorMessage: null,
        },
      });

      try {
        await failPublishingExecution(idempotencyKey, error, idempotencyLeaseToken);
      } catch (idempotencyError) {
        console.error("Failed to reset publishing idempotency after concurrency wait:", idempotencyError);
      }

      throw error;
    }

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
