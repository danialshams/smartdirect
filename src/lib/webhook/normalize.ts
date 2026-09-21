import "server-only";

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

export function getInstagramWebhookEventId(event: any): string {
  const candidates = [
    event?.event_id,
    event?.eventId,
    event?.id,
    event?.comment_id,
    event?.commentId,
    event?.message?.mid,
    event?.message?.id,
    event?.postback?.mid,
    event?.postback?.id,
    event?.read?.mid,
    event?.reaction?.mid,
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
