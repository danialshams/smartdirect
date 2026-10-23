/**
 * Conservative, provider-independent limits for the media paths implemented by Daira.
 * Publishing JPEG: Meta requires JPEG <= 8 MB. Direct messages: image <= 8 MB,
 * audio/video <= 25 MB. Publishing video source caps also protect the transcoder.
 */
export const META_IMAGE_BYTES = 8_000_000 - 1;
export const META_MESSAGE_BYTES = 25_000_000 - 1;
export const PUBLISH_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
export const PUBLISH_VIDEO_SOURCE_BYTES = {
  POST: 0,
  REEL: 200 * 1024 * 1024,
  STORY: 100 * 1024 * 1024,
  CAROUSEL: 100 * 1024 * 1024,
} as const;
export type PublishVideoTarget = keyof typeof PUBLISH_VIDEO_SOURCE_BYTES;
export type UploadPurpose = "PUBLISHING" | "AUTOMATION";
export function maximumUploadBytes(purpose: UploadPurpose, media: "IMAGE" | "VIDEO" | "AUDIO", target: PublishVideoTarget = "REEL") {
  if (purpose === "AUTOMATION") return media === "IMAGE" ? META_IMAGE_BYTES : META_MESSAGE_BYTES;
  if (media === "IMAGE") return PUBLISH_IMAGE_INPUT_BYTES;
  if (media === "VIDEO") return PUBLISH_VIDEO_SOURCE_BYTES[target];
  return 0;
}
export function checkMediaOutputSize(purpose: UploadPurpose, media: "IMAGE" | "VIDEO" | "AUDIO", bytes: number) {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error("فایل خالی یا نامعتبر است.");
  const max = media === "IMAGE" ? META_IMAGE_BYTES
    : purpose === "AUTOMATION" ? META_MESSAGE_BYTES
    : media === "VIDEO" ? 100 * 1024 * 1024 : 0;
  if (!max || bytes > max) throw new Error("حجم فایل پس از آماده‌سازی از محدودیت مجاز اینستاگرام بیشتر است.");
}
