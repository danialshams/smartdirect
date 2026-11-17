/**
 * Links without URLs in Instagram button templates are postback buttons.
 * Keep the original pre-2026-11-17 payload format working for messages
 * already delivered to an Instagram inbox.
 *
 * These helpers are pure so the mapping can be regression-tested without
 * accessing a database, Meta credentials or the send-message API.
 */
export const LINKLESS_BUTTON_PAYLOAD_PREFIX = "DAIRA_LINKLESS_BUTTON:";

export type LinklessButtonClick = {
  messageId: string | null;
  buttonIndex: number;
};

export type StoredLinklessButtonMessage = {
  id: string;
  linkButtons: unknown;
  linkButtonUrl: string | null;
  linkButtonTitle: string | null;
};

export function createLinklessButtonPayload(messageId: string, buttonIndex: number): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(messageId) ||
      !Number.isInteger(buttonIndex) || buttonIndex < 0 || buttonIndex > 2) {
    throw new Error("Invalid Instagram linkless button identity");
  }
  return `${LINKLESS_BUTTON_PAYLOAD_PREFIX}${messageId}:${buttonIndex + 1}`;
}

export function parseLinklessButtonPayload(payload: string): LinklessButtonClick | null {
  const current = /^DAIRA_LINKLESS_BUTTON:([a-zA-Z0-9_-]{1,128}):([1-3])$/.exec(payload);
  if (current) return { messageId: current[1], buttonIndex: Number(current[2]) - 1 };

  const legacy = /^DAIRA_LINKLESS_BUTTON_([1-3])$/.exec(payload);
  return legacy ? { messageId: null, buttonIndex: Number(legacy[1]) - 1 } : null;
}

function normalizeTitle(title: string): string {
  return title.trim().normalize("NFKC").toLocaleLowerCase("fa-IR");
}

/**
 * Never use an unverified postback title as an automation keyword.
 * The clicked button must exist on an active automation belonging to
 * the same Instagram account. For legacy index-only payloads, Meta's
 * postback.title is required to distinguish buttons on different messages.
 */
export function resolveLinklessButtonTitle(
  click: LinklessButtonClick,
  postbackTitle: string | null,
  messages: readonly StoredLinklessButtonMessage[],
): string | null {
  if (!click.messageId && !postbackTitle?.trim()) return null;
  for (const message of messages) {
    if (click.messageId && message.id !== click.messageId) continue;
    const buttons = Array.isArray(message.linkButtons) && message.linkButtons.length
      ? message.linkButtons
      : message.linkButtonTitle
        ? [{ title: message.linkButtonTitle, url: message.linkButtonUrl || "" }]
        : [];
    const button = buttons[click.buttonIndex];
    if (!button || typeof button !== "object" || Array.isArray(button)) continue;
    const record = button as { title?: unknown; url?: unknown };
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title || (typeof record.url === "string" && record.url.trim())) continue;
    if (postbackTitle?.trim() && normalizeTitle(postbackTitle) !== normalizeTitle(title)) continue;
    return title;
  }
  return null;
}
