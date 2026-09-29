const PROXY_PATH = "/api/instagram/media-proxy";

function isAlreadyProxied(url: string) {
  return url.startsWith(PROXY_PATH + "?") || url.startsWith(PROXY_PATH + "&");
}

export function proxyInstagramMediaUrl(
  url: string | null | undefined,
  accountId?: string | null,
): string | null {
  if (!url) return null;

  if (isAlreadyProxied(url)) {
    return url;
  }

  const params = new URLSearchParams({ url });
  if (accountId) params.set("accountId", accountId);

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
