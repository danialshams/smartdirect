import type { QueueJob } from "@/lib/queue/types";
import { processQueuedInstagramWebhookEvent } from "../../../app/api/webhooks/instagram/route";

export { processQueuedInstagramWebhookEvent };

export async function handleInstagramWebhookJob(
  job: QueueJob<"INSTAGRAM_WEBHOOK">,
): Promise<void> {
  await processQueuedInstagramWebhookEvent(job.payload, job.attempts);
}
