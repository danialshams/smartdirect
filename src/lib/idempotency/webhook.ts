import { createHash } from "node:crypto";

import {
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
} from "./store";

const WEBHOOK_OPERATION = "WEBHOOK_INSTAGRAM_EVENT";

type InstagramWebhookEventType = "MESSAGING" | "COMMENT";

type ClaimInstagramWebhookEventInput = {
  instagramAccountId: string;
  event: any;
  eventType: InstagramWebhookEventType;
};

type ClaimInstagramWebhookEventResult = {
  claimed: boolean;
  eventId: string;
  key: string;
};

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }

  const keys = Object.keys(value).sort();

  return (
    "{" +
    keys
      .map((key) => JSON.stringify(key) + ":" + stableStringify(value[key]))
      .join(",") +
    "}"
  );
}

function getCandidateEventId(event: any): string | null {
  const candidates = [
    event?.event_id,
    event?.eventId,
    event?.id,
    event?.message?.mid,
    event?.postback?.mid,
    event?.read?.mid,
    event?.reaction?.mid,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return null;
}

export function getInstagramWebhookEventId(event: any): string {
  const directId = getCandidateEventId(event);

  if (directId) {
    return directId;
  }

  const fingerprint = stableStringify(event);

  return `fingerprint:${createHash("sha256").update(fingerprint).digest("hex")}`;
}

export async function claimInstagramWebhookEvent(
  input: ClaimInstagramWebhookEventInput,
): Promise<ClaimInstagramWebhookEventResult> {
  const eventId = getInstagramWebhookEventId(input.event);

  const key = `smartdirect:idempotency:v1:webhook:${input.instagramAccountId}:${input.eventType}:${createHash("sha256").update(eventId).digest("hex")}`;

  const result = await claimIdempotency({
    key,
    tenantId: input.instagramAccountId,
    operation: WEBHOOK_OPERATION,
    resourceId: eventId,
  });

  return {
    claimed: result.claimed,
    eventId,
    key,
  };
}

export async function completeInstagramWebhookEvent(
  key: string,
): Promise<void> {
  await completeIdempotency(key, {
    processed: true,
    operation: WEBHOOK_OPERATION,
  });
}

export async function failInstagramWebhookEvent(
  key: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : "Instagram webhook processing failed.";

  await failIdempotency(key, message);
}
