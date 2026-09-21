import { createHash } from "node:crypto";

import { getInstagramWebhookEventId } from "@/lib/webhook/normalize";

import {
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
  retryFailedIdempotency,
} from "./store";

const WEBHOOK_OPERATION = "WEBHOOK_INSTAGRAM_EVENT";

type InstagramWebhookEventType = "MESSAGING" | "COMMENT";

type ClaimInstagramWebhookEventInput = {
  instagramAccountId: string;
  event: any;
  eventType: InstagramWebhookEventType;
  eventId?: string;
};

type ClaimInstagramWebhookEventResult = {
  claimed: boolean;
  eventId: string;
  key: string;
};

export async function claimInstagramWebhookEvent(
  input: ClaimInstagramWebhookEventInput,
): Promise<ClaimInstagramWebhookEventResult> {
  const eventId =
    typeof input.eventId === "string" && input.eventId.trim()
      ? input.eventId.trim()
      : getInstagramWebhookEventId(input.event);

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

export async function retryInstagramWebhookEvent(
  key: string,
): Promise<boolean> {
  const result = await retryFailedIdempotency(key);
  return result.claimed;
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
