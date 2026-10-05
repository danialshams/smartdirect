const PROXY_PATH = "/api/instagram/media-proxy";

function isAlreadyProxied(url: string) {
  return url.startsWith(PROXY_PATH + "?") || url.startsWith(PROXY_PATH + "&");
}

export function proxyInstagramMediaUrl(
  url: string | null | undefined,
  accountId?: string | null,
  messageId?: string | null,
): string | null {
  if (!url) return null;

  if (isAlreadyProxied(url)) {
    if (!accountId) return url;

    try {
      const proxied = new URL(url, "https://smartdirect.local");
      if (!proxied.searchParams.get("accountId")) {
        proxied.searchParams.set("accountId", accountId);
      }
      return `${proxied.pathname}?${proxied.searchParams.toString()}`;
    } catch {
      return url;
    }
  }

  const params = new URLSearchParams({ url });
  if (accountId) params.set("accountId", accountId);
  if (messageId) params.set("messageId", messageId);

  return `${PROXY_PATH}?${params.toString()}`;
}

export function proxyInstagramParticipantProfileUrl(
  accountId: string,
  participantId: string,
): string {
  return `${PROXY_PATH}?accountId=${encodeURIComponent(
    accountId,
  )}&participantId=${encodeURIComponent(participantId)}`;
}

export function proxyInstagramAccountProfileUrl(accountId: string): string {
  return `${PROXY_PATH}?accountId=${encodeURIComponent(accountId)}`;
}
