/**
 * A Meta attachment_id is an optimization, not durable storage. Persisted
 * replies must retain an owned, retrievable original for every media branch.
 * Pure helper shared by API validation and regression tests.
 */
const MEDIA_TYPES = new Set(["IMAGE", "AUDIO", "VIDEO"]);
const MAX_RESPONSE_BRANCHES = 256;

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type SavedResponseMedia = {
  messageType: unknown;
  mediaUrl: unknown;
  quickReplies: unknown;
};

export function collectSavedResponseMedia(input: SavedResponseMedia): {
  urls: string[];
  missingOriginal: boolean;
} {
  const urls = new Set<string>();
  let missingOriginal = false;
  if (MEDIA_TYPES.has(String(input.messageType))) {
    const url = stringValue(input.mediaUrl);
    if (url) urls.add(url);
    else missingOriginal = true;
  }
  const queue: unknown[] = Array.isArray(input.quickReplies) ? [...input.quickReplies] : [];
  let inspected = 0;
  while (queue.length) {
    if (++inspected > MAX_RESPONSE_BRANCHES) {
      throw new Error("تعداد شاخه‌های پاسخ ذخیره‌شده بیش از حد مجاز است.");
    }
    const entry = queue.pop();
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const reply = entry as Record<string, unknown>;
    if (MEDIA_TYPES.has(String(reply.destinationType))) {
      const url = stringValue(reply.destinationMediaUrl) ?? stringValue(reply.mediaUrl);
      if (url) urls.add(url);
      else missingOriginal = true;
    }
    if (Array.isArray(reply.destinationQuickReplies)) queue.push(...reply.destinationQuickReplies);
    if (Array.isArray(reply.quickReplies)) queue.push(...reply.quickReplies);
  }
  return { urls: [...urls], missingOriginal };
}
