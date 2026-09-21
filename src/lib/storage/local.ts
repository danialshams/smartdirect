import fs from "node:fs/promises";
import path from "node:path";

import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "./index";

const basePath =
  process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "storage");

const publicBaseUrl = process.env.LOCAL_STORAGE_PUBLIC_URL || "";

function resolveKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");

  const fullPath = path.resolve(basePath, normalized);

  const root = path.resolve(/*turbopackIgnore: true*/ basePath);

  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key.");
  }

  return fullPath;
}

export const localStorageProvider: StorageProvider = {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const filePath = resolveKey(input.key);

    await fs.mkdir(path.dirname(filePath), {
      recursive: true,
    });

    await fs.writeFile(filePath, input.body);

    if (!publicBaseUrl) {
      throw new Error("LOCAL_STORAGE_PUBLIC_URL تنظیم نشده است.");
    }

    const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/${input.key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    return {
      storageKey: input.key,
      publicUrl,
    };
  },

  async delete(storageKey: string) {
    const filePath = resolveKey(storageKey);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : null;

      if (code !== "ENOENT") {
        throw error;
      }
    }
  },

  async exists(storageKey: string) {
    try {
      await fs.access(resolveKey(storageKey));

      return true;
    } catch {
      return false;
    }
  },
};
