import { enqueueJob } from "@/lib/queue/core";
import type { QueueJob } from "@/lib/queue/types";

export type InstagramWebhookQueueInput = {
  instagramAccountId: string;
  eventId: string;
  eventType: "MESSAGING" | "COMMENT" | "LIVE_COMMENT";
  event: unknown;
  idempotencyKey: string;
};

export async function enqueueInstagramWebhookEvent(
  input: InstagramWebhookQueueInput,
): Promise<QueueJob<"INSTAGRAM_WEBHOOK">> {
  const event = input.event && typeof input.event === "object"
    ? input.event as { sender?: { id?: string | number } }
    : null;
  const participantId = event?.sender?.id;
  // Independent conversations run concurrently while each participant's
  // events remain serialized.
  const orderingKey = input.eventType === "MESSAGING" && participantId
    ? `conversation:${input.instagramAccountId}:${participantId}`
    : input.instagramAccountId;
  return enqueueJob(
    "INSTAGRAM_WEBHOOK",
    {
      event: input.event,
      eventId: input.eventId,
      instagramAccountId: input.instagramAccountId,
      eventType: input.eventType,
    },
    {
      priority: "high",
      maxAttempts: 3,
      instagramAccountId: input.instagramAccountId,
      orderingKey,
    },
  );
}
