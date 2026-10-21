/**
 * Normalize a direct-menu web link without rewriting links that already
 * include http:// or https://. The same function runs in the editor and API.
 */
export function normalizePersistentMenuUrl(value: string): string | null {
  const input = value.trim();
  if (!input || /\s/.test(input)) return null;

  // Reject other protocols rather than accidentally turning them into HTTPS.
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) return null;
  if (/^(?:javascript|data|mailto|file|ftp|ws|wss|tel):/i.test(input)) return null;

  const normalized = /^https?:\/\//i.test(input)
    ? input
    : input.startsWith("//")
      ? `https:${input}`
      : `https://${input}`;

  try {
    const url = new URL(normalized);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname || url.username || url.password)
      return null;

    const hostname = url.hostname;
    const isIp = hostname.startsWith("[") || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const labels = hostname.split(".");
    const isDomain = labels.length >= 2
      && labels.every((part) => part.length > 0 && /^[a-z\d-]+$/i.test(part) && !part.startsWith("-") && !part.endsWith("-"))
      && labels.at(-1)!.length >= 2;
    if (!isDomain && !isIp && hostname !== "localhost") return null;

    return normalized;
  } catch {
    return null;
  }
}
