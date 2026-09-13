import { cloudinaryStorageProvider } from "./cloudinary";
import { localStorageProvider } from "./local";
import { testStorageProvider } from "./test";

export function getStorageProvider() {
  const provider = process.env.STORAGE_PROVIDER || "local";

  switch (provider) {
    case "local":
      return localStorageProvider;

    case "cloudinary":
      return cloudinaryStorageProvider;

    case "test":
      return testStorageProvider;

    default:
      throw new Error(`Storage provider "${provider}" پشتیبانی نمی‌شود.`);
  }
}
