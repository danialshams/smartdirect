import type { StorageProvider } from "./index";

const TEST_IMAGE_URL =
  process.env.TEST_IMAGE_URL ||
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1080&q=90";

const TEST_VIDEO_URL =
  process.env.TEST_VIDEO_URL ||
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const testStorageProvider: StorageProvider = {
  async upload(input) {
    const isVideo = input.contentType.startsWith("video/");

    return {
      storageKey: `test:${isVideo ? "video" : "image"}:${Date.now()}`,
      publicUrl: isVideo ? TEST_VIDEO_URL : TEST_IMAGE_URL,
    };
  },

  async delete() {
    // Test storage uses public sample assets and does not create files.
  },

  async exists() {
    return true;
  },
};
