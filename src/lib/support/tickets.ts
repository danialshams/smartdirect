import "server-only";
import Redis from "ioredis";

export const SUPPORT_CATEGORIES = ["GENERAL", "CONNECTION", "AUTOMATION", "BILLING", "BUG", "OTHER"] as const;
export const SUPPORT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export type SupportImage = { fileName: string; mimeType: string; bytes: Uint8Array };

export async function getSupportPayload(request: Request) {
  const size = Number(request.headers.get("content-length") || "0");
  if (size > SUPPORT_MAX_IMAGE_BYTES + 100_000) throw new Error("حجم درخواست بیش از حد مجاز است.");
  let subject = "", body = "", category = "GENERAL", image: SupportImage | null = null;
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    const data = await request.formData();
    subject = String(data.get("subject") || "").trim();
    body = String(data.get("body") || "").trim();
    category = String(data.get("category") || "GENERAL");
    const file = data.get("image");
    if (file instanceof File && file.size > 0) {
      if (file.size > SUPPORT_MAX_IMAGE_BYTES) throw new Error("حجم تصویر باید کمتر از ۲ مگابایت باشد.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      const mimeType = jpg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
      if (!mimeType) throw new Error("فقط تصاویر معتبر JPG، PNG یا WebP قابل ارسال هستند.");
      image = { fileName: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 100) || "screenshot", mimeType, bytes };
    }
  } else {
    const data = await request.json().catch(() => ({}));
    subject = String(data.subject || "").trim();
    body = String(data.body || "").trim();
    category = String(data.category || "GENERAL");
  }
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(category)) throw new Error("دسته‌بندی نامعتبر است.");
  return { subject, body, category, image };
}

export function supportAttachmentCreate(image: SupportImage | null) {
  return image ? { create: { fileName: image.fileName, mimeType: image.mimeType, bytes: Uint8Array.from(image.bytes) } } : undefined;
}

export function supportRealtimeEnabled() {
  // Pub/Sub uses the Redis TCP URL even when the application uses Upstash REST
  // for ordinary queue commands. REDIS_DRIVER need not be set on Vercel.
  return Boolean(process.env.REDIS_URL?.trim() || process.env.REDIS_LOCAL_URL?.trim());
}

export function supportRedisUrl() {
  return process.env.REDIS_URL || process.env.REDIS_LOCAL_URL || "";
}

export function supportChannel(userId: string) { return "sd:support:user:" + userId; }
export const adminSupportChannel = "sd:support:admin";

export async function publishAdminSupportChange(ticketId: string, messageId: string) {
  if (!supportRealtimeEnabled()) return;
  const redis = new Redis(supportRedisUrl(), { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  redis.on("error", () => undefined);
  try {
    await redis.connect();
    await redis.publish(adminSupportChannel, JSON.stringify({ ticketId, messageId }));
  } catch (error) {
    console.warn("[support] admin realtime event unavailable; polling will recover", error instanceof Error ? error.message : error);
  } finally { redis.disconnect(); }
}

export async function publishSupportChange(userId: string, ticketId: string, messageId: string) {
  if (!supportRealtimeEnabled()) return;
  const redis = new Redis(supportRedisUrl(), { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  redis.on("error", () => undefined);
  try {
    await redis.connect();
    await redis.publish(supportChannel(userId), JSON.stringify({ ticketId, messageId }));
  } catch (error) {
    console.warn("[support] redis event unavailable; polling will recover", error instanceof Error ? error.message : error);
  } finally {
    redis.disconnect();
  }
}