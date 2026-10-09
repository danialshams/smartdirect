"use client";

import { useEffect } from "react";

const STORAGE_LEASE_RENEW_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keep uploaded files alive while their editor remains mounted. Once the editor
 * unmounts, the one-hour TTL becomes the fallback for abandoned uploads.
 */
export function useStorageUploadLease(publicUrls: Array<string | null | undefined>) {
  const signature = JSON.stringify(
    Array.from(new Set(publicUrls.filter((url): url is string => Boolean(url)))).sort(),
  );

  useEffect(() => {
    const urls = JSON.parse(signature) as string[];
    if (urls.length === 0) return;

    const renew = () => {
      void fetch("/api/instagram/publishing/upload/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "keepalive", publicUrls: urls }),
      }).catch(() => undefined);
    };

    renew();
    const interval = window.setInterval(renew, STORAGE_LEASE_RENEW_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [signature]);
}

export async function requestStorageCleanupByPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) return;

  const response = await fetch("/api/instagram/publishing/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ publicUrl }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || "حذف فایل ناموفق بود.");
  }
}
