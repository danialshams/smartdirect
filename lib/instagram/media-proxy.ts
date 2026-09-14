export function proxyInstagramMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  return `/api/instagram/media-proxy?url=${encodeURIComponent(url)}`;
}
