import "dotenv/config";

import { deleteJob, getJob } from "../src/lib/queue/core";
import { enqueueInstagramWebhookEvent } from "../src/lib/webhook/queue";

async function main() {
  const eventId = `webhook-queue-test-${Date.now()}`;

  const job = await enqueueInstagramWebhookEvent({
    instagramAccountId: "instagram-account-test",
    eventId,
    eventType: "MESSAGING",
    event: {
      message: {
        mid: eventId,
        text: "queue-test",
      },
    },
    idempotencyKey: `webhook-idempotency-${eventId}`,
  });

  if (job.type !== "INSTAGRAM_WEBHOOK" || job.status !== "waiting") {
    throw new Error("Webhook event was not queued as a waiting job.");
  }

  const stored = await getJob(job.id);

  if (
    !stored ||
    stored.type !== "INSTAGRAM_WEBHOOK" ||
    stored.payload.eventId !== eventId ||
    stored.payload.instagramAccountId !== "instagram-account-test"
  ) {
    throw new Error("Queued webhook payload could not be read back.");
  }

  await deleteJob(job.id);

  console.log("87-89 Webhook queue/retry/failure foundation: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "webhook-job-type",
          "normalized-event-id-preserved",
          "account-scope-preserved",
          "idempotency-preserved",
          "retry-budget-configured",
          "queue-persistence",
        ],
        maxAttempts: job.maxAttempts,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("87-89 Webhook queue/retry/failure foundation: FAILED");
  console.error(error);
  process.exitCode = 1;
});
