import crypto from "node:crypto";

import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "./index";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} تنظیم نشده است.`);
  }

  return value;
}

function signParams(params: Record<string, string>) {
  const signatureBase = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${signatureBase}${requiredEnv("CLOUDINARY_API_SECRET")}`)
    .digest("hex");
}

function parseStorageKey(storageKey: string) {
  const prefix = "cloudinary:";

  if (!storageKey.startsWith(prefix)) {
    throw new Error("Cloudinary storage key نامعتبر است.");
  }

  const value = storageKey.slice(prefix.length);
  const separator = value.indexOf(":");

  if (separator === -1) {
    throw new Error("Cloudinary storage key نامعتبر است.");
  }

  return {
    resourceType: value.slice(0, separator),
    publicId: value.slice(separator + 1),
  };
}

export const cloudinaryStorageProvider: StorageProvider = {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
    const apiKey = requiredEnv("CLOUDINARY_API_KEY");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "smartdirect";

    const signature = signParams({
      folder,
      timestamp,
    });

    const formData = new FormData();
    formData.append("file", new Blob([input.body], { type: input.contentType }), input.key.split("/").pop());
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("folder", folder);
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    const data = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      resource_type?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data.secure_url || !data.public_id) {
      throw new Error(
        data.error?.message || "آپلود فایل در Cloudinary ناموفق بود.",
      );
    }

    const resourceType = data.resource_type || "image";

    return {
      storageKey: `cloudinary:${resourceType}:${data.public_id}`,
      publicUrl: data.secure_url,
    };
  },

  async delete(storageKey: string) {
    const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
    const apiKey = requiredEnv("CLOUDINARY_API_KEY");
    const { resourceType, publicId } = parseStorageKey(storageKey);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signature = signParams({
      public_id: publicId,
      timestamp,
    });

    const formData = new URLSearchParams({
      public_id: publicId,
      api_key: apiKey,
      timestamp,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error("حذف فایل از Cloudinary ناموفق بود.");
    }
  },

  async exists(storageKey: string) {
    try {
      const { publicId } = parseStorageKey(storageKey);
      const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
      const apiKey = requiredEnv("CLOUDINARY_API_KEY");
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signParams({ public_id: publicId, timestamp });

      const params = new URLSearchParams({
        public_id: publicId,
        api_key: apiKey,
        timestamp,
        signature,
      });

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?${params.toString()}`,
      );

      return response.ok;
    } catch {
      return false;
    }
  },
};
