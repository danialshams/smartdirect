import { createHash } from "node:crypto";

export type InstagramWebhookEventType = "MESSAGING" | "COMMENT";

export type InstagramWebhookNormalizedEvent = {
  type: InstagramWebhookEventType;
  eventId: string;
  accountId: string;
  rawEvent: unknown;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return (
    "{" +
    keys
      .map((key) => JSON.stringify(key) + ":" + stableStringify(record[key]))
      .join(",") +
    "}"
  );
}

function readStringCandidate(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

export function getInstagramWebhookEventId(event: unknown): string {
  const record = event && typeof event === "object" && !Array.isArray(event)
    ? event as Record<string, unknown>
    : {};
  const message = record.message && typeof record.message === "object"
    ? record.message as Record<string, unknown>
    : {};
  const postback = record.postback && typeof record.postback === "object"
    ? record.postback as Record<string, unknown>
    : {};
  const read = record.read && typeof record.read === "object"
    ? record.read as Record<string, unknown>
    : {};
  const reaction = record.reaction && typeof record.reaction === "object"
    ? record.reaction as Record<string, unknown>
    : {};
  const candidates = [
    record.event_id,
    record.eventId,
    record.id,
    record.comment_id,
    record.commentId,
    message.mid,
    message.id,
    postback.mid,
    postback.id,
    read.mid,
    reaction.mid,
  ];

  for (const candidate of candidates) {
    const value = readStringCandidate(candidate);

    if (value) {
      return value;
    }
  }

  const fingerprint = stableStringify(event);

  return `fingerprint:${createHash("sha256").update(fingerprint).digest("hex")}`;
}

export function normalizeInstagramMessagingEvent(
  event: unknown,
  accountId: string,
): InstagramWebhookNormalizedEvent {
  return {
    type: "MESSAGING",
    eventId: getInstagramWebhookEventId(event),
    accountId,
    rawEvent: event,
  };
}

export function normalizeInstagramCommentEvent(
  event: unknown,
  accountId: string,
): InstagramWebhookNormalizedEvent {
  return {
    type: "COMMENT",
    eventId: getInstagramWebhookEventId(event),
    accountId,
    rawEvent: event,
  };
}

export function normalizeInstagramWebhookEvent(input: {
  type: InstagramWebhookEventType;
  event: unknown;
  accountId: string;
}): InstagramWebhookNormalizedEvent {
  return input.type === "MESSAGING"
    ? normalizeInstagramMessagingEvent(input.event, input.accountId)
    : normalizeInstagramCommentEvent(input.event, input.accountId);
}
