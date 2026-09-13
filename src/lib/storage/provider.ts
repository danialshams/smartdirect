import { localStorageProvider } from "./local";

export function getStorageProvider() {
  const provider = process.env.STORAGE_PROVIDER || "local";

  switch (provider) {
    case "local":
      return localStorageProvider;

    default:
      throw new Error(`Storage provider "${provider}" پشتیبانی نمی‌شود.`);
  }
}
