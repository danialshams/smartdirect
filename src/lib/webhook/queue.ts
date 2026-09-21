import "server-only";

import { enqueueJob } from "@/lib/queue/core";
import type { QueueJob } from "@/lib/queue/types";

export type InstagramWebhookQueueInput = {
  instagramAccountId: string;
  eventId: string;
  eventType: "MESSAGING" | "COMMENT";
  event: unknown;
  idempotencyKey: string;
};

export async function enqueueInstagramWebhookEvent(
  input: InstagramWebhookQueueInput,
): Promise<QueueJob<"INSTAGRAM_WEBHOOK">> {
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
      idempotency: {
        key: input.idempotencyKey,
        tenantId: input.instagramAccountId,
        operation: "WEBHOOK_INSTAGRAM_EVENT",
        resourceId: input.eventId,
      },
    },
  );
}
