/**
 * Instagram Login messaging webhook interaction parser.
 * Story replies to OUR stories use reply_to.story; story mentions of our
 * account are story_mention attachments or STORY_MENTION referrals instead.
 * Since February 2026 post shares use ig_post; the deprecated share type
 * often contains only an ephemeral lookaside URL and cannot identify a post.
 */
export type InteractionKind = "DM_MEDIA_SHARE" | "STORY_MENTION";
export type InboundInteraction =
  | { kind: "STORY_MENTION"; storyUrl: string | null }
  | { kind: "DM_MEDIA_SHARE"; mediaId: string | null; shortcode: string | null };

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function shortcodeFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["www.instagram.com","instagram.com","m.instagram.com"].includes(url.hostname.toLowerCase())) return null;
    if (url.protocol !== "https:") return null;
    const match = url.pathname.match(/^\/(?:p|reel|reels|tv)\/([\w-]+)(?:\/|$)/i);
    return match?.[1] ?? null;
  } catch { return null; }
}

export function extractInboundInteraction(event: unknown): InboundInteraction | null {
  const e = object(event);
  const message = object(e.message);
  if (message.is_echo === true || object(message.reply_to).story) return null;
  const referral = object(e.referral);
  if (referral.source === "STORY_MENTION") {
    return {kind:"STORY_MENTION",storyUrl:safeString(object(referral.story).url)};
  }
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  for (const raw of attachments) {
    const attachment = object(raw);
    const type = safeString(attachment.type)?.toLowerCase();
    const payload = object(attachment.payload);
    if (type === "story_mention") {
      return {kind:"STORY_MENTION",storyUrl:safeString(payload.url)};
    }
    if (type !== "ig_post" && type !== "ig_reel" && type !== "share" && type !== "media_share") continue;
    const id = safeString(payload.media_id) ?? safeString(payload.mediaId)
      ?? safeString(payload.id) ?? safeString(attachment.id);
    const mediaId = id && /^\d{5,40}$/.test(id) ? id : null;
    const shortcode = shortcodeFromUrl(safeString(payload.permalink) ?? safeString(payload.url) ?? safeString(attachment.url));
    // Never confuse a generic image/video or CDN lookaside URL with a known shared post.
    return {kind:"DM_MEDIA_SHARE",mediaId,shortcode};
  }
  return null;
}

export function matchesSharedMedia(
  candidate: {mediaId: string | null; shortcode: string | null},
  configuredIds: string[],
  ownedMedia: Array<{id:string;permalink?:string|null}>,
) {
  if (!configuredIds.length) return false;
  const mediaId = candidate.mediaId;
  if (mediaId && configuredIds.includes(mediaId)) return true;
  if (!candidate.shortcode) return false;
  return ownedMedia.some(item => configuredIds.includes(item.id)
    && shortcodeFromUrl(item.permalink ?? null) === candidate.shortcode);
}
