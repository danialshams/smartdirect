import type { QueueJob } from "@/lib/queue/types";

export async function handleInstagramWebhookJob(
  job: QueueJob<"INSTAGRAM_WEBHOOK">,
): Promise<void> {
  const { processQueuedInstagramWebhookEvent } =
    await import("../../../app/api/webhooks/instagram/route");

  await processQueuedInstagramWebhookEvent(job.payload, job.attempts);
}
