const PROXY_PATH = "/api/instagram/media-proxy";

function isAlreadyProxied(url: string) {
  return url.startsWith(PROXY_PATH + "?") || url.startsWith(PROXY_PATH + "&");
}

export function proxyInstagramMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  if (isAlreadyProxied(url)) {
    return url;
  }

  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`;
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
