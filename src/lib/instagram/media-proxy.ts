const PROXY_PATH = "/api/instagram/media-proxy";

function isAlreadyProxied(url: string) {
  return url.startsWith(PROXY_PATH + "?") || url.startsWith(PROXY_PATH + "&");
}

export function proxyInstagramMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  // Keep the helper idempotent. Some API routes already persist/return a
  // SmartDirect proxy URL, and wrapping it again makes the proxy reject its
  // own URL as an external Instagram host.
  if (isAlreadyProxied(url)) {
    return url;
  }

  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`;
}
