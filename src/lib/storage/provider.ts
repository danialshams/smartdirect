import { cloudinaryStorageProvider } from "./cloudinary";
import { localStorageProvider } from "./local";
import { s3CompatibleStorageProvider } from "./s3-compatible";
import { testStorageProvider } from "./test";
import { vercelBlobStorageProvider } from "./vercel-blob";

export function getStorageProvider() {
  const provider = process.env.STORAGE_PROVIDER || "local";

  switch (provider) {
    case "local":
      return localStorageProvider;

    case "cloudinary":
      return cloudinaryStorageProvider;

    case "vercel-blob":
      return vercelBlobStorageProvider;

    case "s3":
    case "s3-compatible":
      return s3CompatibleStorageProvider;

    case "test":
      return testStorageProvider;

    default:
      throw new Error(`Storage provider "${provider}" پشتیبانی نمی‌شود.`);
  }
}

/** A stored file keeps its provider when the default backend changes. */
export function getStorageProviderForObject(storageKey: string, publicUrl?: string | null) {
  if (storageKey.startsWith("s3:")) return s3CompatibleStorageProvider;
  if (publicUrl) {
    try {
      if (new URL(publicUrl).hostname.endsWith(".public.blob.vercel-storage.com")) return vercelBlobStorageProvider;
    } catch { /* old records may have malformed URLs */ }
  }
  return getStorageProvider();
}
