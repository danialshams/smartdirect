import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { getStorageProvider } from "@/lib/storage/provider";

const VERSION = "v26.0";
const GRAPH = `https://graph.instagram.com/${VERSION}`;

type ApiError = { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
type ApiResponse<T = Record<string, unknown>> = T & { error?: ApiError };
type ContainerResponse = { id?: string; status_code?: string; status?: string; error?: ApiError };
type PublishResponse = { id?: string; error?: ApiError };
type MediaItem = { type: "IMAGE" | "VIDEO"; publicUrl: string; sortOrder: number };
type UserTag = { username: string; x?: number; y?: number };

function errorMessage(data: ApiResponse | undefined, fallback: string) { return data?.error?.message || fallback; }
async function instagramRequest<T>(path: string, accessToken: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${GRAPH}${path}`, { ...init, cache: "no-store", signal: controller.signal, headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const text = await response.text();
    let data = {} as ApiResponse<T>;
    try { data = text ? JSON.parse(text) as ApiResponse<T> : {} as ApiResponse<T>; } catch { throw new Error("Instagram پاسخ JSON معتبر برنگرداند."); }
    return { response, data };
  } finally { clearTimeout(timeout); }
}
function normalizeUserTags(value: unknown): UserTag[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is UserTag => !!item && typeof item === "object" && typeof (item as Record<string, unknown>).username === "string" && String((item as Record<string, unknown>).username).trim().length > 0).map((tag) => ({ username: tag.username.replace(/^@/, "").trim(), ...(typeof tag.x === "number" ? { x: tag.x } : {}), ...(typeof tag.y === "number" ? { y: tag.y } : {}) }));
}
async function createImageContainer(igUserId: string, token: string, media: MediaItem, caption?: string | null, carousel = false, tags: UserTag[] = []) {
  const body: Record<string, string> = { image_url: media.publicUrl, access_token: token };
  if (caption && !carousel) body.caption = caption;
  if (carousel) body.is_carousel_item = "true";
  if (!carousel && tags.length) body.user_tags = JSON.stringify(tags);
  const { response, data } = await instagramRequest<ContainerResponse>(`/${igUserId}/media`, token, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok || !data.id) throw new Error(errorMessage(data, "ساخت Instagram image container ناموفق بود."));
  return data.id;
}
async function createReelContainer(igUserId: string, token: string, media: MediaItem, caption?: string | null, tags: UserTag[] = []) {
  const body: Record<string, string> = { media_type: "REELS", video_url: media.publicUrl, access_token: token };
  if (caption) body.caption = caption;
  if (tags.length) body.user_tags = JSON.stringify(tags);
  const { response, data } = await instagramRequest<ContainerResponse>(`/${igUserId}/media`, token, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok || !data.id) throw new Error(errorMessage(data, "ساخت Instagram Reel container ناموفق بود."));
  return data.id;
}
async function createStoryContainer(igUserId: string, token: string, media: MediaItem) {
  const body: Record<string, string> = { media_type: "STORIES", access_token: token, ...(media.type === "IMAGE" ? { image_url: media.publicUrl } : { video_url: media.publicUrl }) };
  const { response, data } = await instagramRequest<ContainerResponse>(`/${igUserId}/media`, token, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok || !data.id) throw new Error(errorMessage(data, "ساخت Instagram Story container ناموفق بود."));
  return data.id;
}
async function createCarouselContainer(igUserId: string, token: string, children: string[], caption?: string | null) {
  const body: Record<string, string> = { media_type: "CAROUSEL", children: JSON.stringify(children), access_token: token };
  if (caption) body.caption = caption;
  const { response, data } = await instagramRequest<ContainerResponse>(`/${igUserId}/media`, token, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok || !data.id) throw new Error(errorMessage(data, "ساخت Instagram Carousel ناموفق بود."));
  return data.id;
}
async function containerStatus(id: string, token: string) {
  const params = new URLSearchParams({ fields: "status_code,status", access_token: token });
  const { response, data } = await instagramRequest<ContainerResponse>(`/${id}?${params}`, token);
  if (!response.ok) throw new Error(errorMessage(data, "دریافت وضعیت Instagram container ناموفق بود."));
  return { statusCode: data.status_code ?? null, status: data.status ?? null };
}
async function waitReady(id: string, token: string, maxAttempts = 20, delayMs = 3000) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const status = await containerStatus(id, token);
    const code = String(status.statusCode ?? "").toUpperCase();
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") throw new Error(`Instagram container failed with status: ${code}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Instagram container در زمان مجاز آماده نشد.");
}
async function publishContainer(igUserId: string, token: string, containerId: string) {
  const { response, data } = await instagramRequest<PublishResponse>(`/${igUserId}/media_publish`, token, { method: "POST", body: JSON.stringify({ creation_id: containerId, access_token: token }) });
  if (!response.ok || !data.id) throw new Error(errorMessage(data, "انتشار محتوا در Instagram ناموفق بود."));
  return data.id;
}
async function cleanupPublishedMedia(items: Array<{ id: string; storageKey: string; deletedAt: Date | null }>) {
  const storage = getStorageProvider();
  for (const item of items) {
    if (item.deletedAt || item.storageKey.startsWith("test:")) continue;
    try { await storage.delete(item.storageKey); await prisma.instagramPublishMedia.update({ where: { id: item.id }, data: { deletedAt: new Date() } }); } catch (error) { console.error("Failed to delete published Instagram media:", { mediaId: item.id, storageKey: item.storageKey, error }); }
  }
}

async function bindConditionalAutomations(job: { commentAutomationId: string | null; storyReplyAutomationId: string | null; instagramAccountId: string; type: string }, instagramMediaId: string) {
  if (job.commentAutomationId && job.type !== "STORY") {
    await prisma.automation.updateMany({ where: { id: job.commentAutomationId, instagramAccountId: job.instagramAccountId, triggerType: "COMMENT_KEYWORD" }, data: { mediaId: instagramMediaId } });
  }
  if (job.storyReplyAutomationId && job.type === "STORY") {
    await prisma.automation.updateMany({ where: { id: job.storyReplyAutomationId, instagramAccountId: job.instagramAccountId, triggerType: "STORY_REPLY_KEYWORD" }, data: { mediaId: instagramMediaId } });
  }
}

export async function publishInstagramJob(jobId: string) {
  const job = await prisma.instagramPublishJob.findUnique({ where: { id: jobId }, include: { media: { orderBy: { sortOrder: "asc" } }, instagramAccount: true } });
  if (!job) throw new Error("Publishing job پیدا نشد.");
  if (!job.instagramAccount.isConnected) throw new Error("اکانت Instagram متصل نیست.");
  if (!job.media.length) throw new Error("هیچ Media برای انتشار وجود ندارد.");

  const media: MediaItem[] = job.media.map((item) => {
    if (!item.publicUrl) throw new Error(`فایل ${item.fileName ?? item.id} URL عمومی ندارد.`);
    return { type: item.type, publicUrl: item.publicUrl, sortOrder: item.sortOrder };
  });
  const tags = normalizeUserTags(job.userTags);
  const token = await getValidInstagramAccessToken(job.instagramAccountId);
  await prisma.instagramPublishJob.update({ where: { id: job.id }, data: { status: "PROCESSING", lastAttemptAt: new Date() } });

  try {
    let containerId: string;
    if (job.type === "STORY") {
      if (media.length !== 1 || !["IMAGE", "VIDEO"].includes(media[0].type)) throw new Error("Story باید دقیقاً یک تصویر یا ویدیو داشته باشد.");
      containerId = await createStoryContainer(job.instagramAccount.igUserId, token, media[0]);
    } else if (job.type === "POST") {
      if (media.length !== 1 || media[0].type !== "IMAGE") throw new Error("POST باید دقیقاً یک تصویر داشته باشد.");
      containerId = await createImageContainer(job.instagramAccount.igUserId, token, media[0], job.caption, false, tags);
    } else if (job.type === "REEL") {
      if (media.length !== 1 || media[0].type !== "VIDEO") throw new Error("Reel باید دقیقاً یک ویدیو داشته باشد.");
      containerId = await createReelContainer(job.instagramAccount.igUserId, token, media[0], job.caption, tags);
    } else {
      if (media.length < 2 || media.length > 10 || media.some((item) => item.type !== "IMAGE")) throw new Error("Carousel باید بین ۲ تا ۱۰ تصویر داشته باشد.");
      const children: string[] = [];
      for (const item of media) { const childId = await createImageContainer(job.instagramAccount.igUserId, token, item, null, true); await waitReady(childId, token); children.push(childId); }
      containerId = await createCarouselContainer(job.instagramAccount.igUserId, token, children, job.caption);
    }

    await prisma.instagramPublishJob.update({ where: { id: job.id }, data: { status: "PUBLISHING", instagramContainerId: containerId } });
    await waitReady(containerId, token);
    const instagramMediaId = await publishContainer(job.instagramAccount.igUserId, token, containerId);
    await bindConditionalAutomations(job, instagramMediaId);

    const updatedJob = await prisma.instagramPublishJob.update({ where: { id: job.id }, data: { status: "PUBLISHED", publishedAt: new Date(), instagramMediaId, errorMessage: null }, include: { media: true } });
    await cleanupPublishedMedia(updatedJob.media);
    return updatedJob;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram publishing failed.";
    await prisma.instagramPublishJob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: message, retryCount: { increment: 1 } } });
    throw error;
  }
}
