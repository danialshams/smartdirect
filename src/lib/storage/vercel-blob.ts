import { del, head, put } from "@vercel/blob";

import type { StorageProvider } from "./index";

export const vercelBlobStorageProvider: StorageProvider = {
  async upload(input) {
    const blob = await put(input.key, input.body, {
      access: "public",
      addRandomSuffix: false,
      contentType: input.contentType,
    });

    return {
      storageKey: blob.pathname,
      publicUrl: blob.url,
    };
  },

  async delete(storageKey) {
    await del(storageKey);
  },

  async exists(storageKey) {
    try {
      await head(storageKey);
      return true;
    } catch {
      return false;
    }
  },
};
