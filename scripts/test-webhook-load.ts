import "dotenv/config";

import { createHash } from "node:crypto";

import {
  completeInstagramWebhookEvent,
  claimInstagramWebhookEvent,
} from "../src/lib/idempotency/webhook";
import {
  deleteJob,
  enqueueJob,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";

const TOTAL_EVENTS = 200;
const CONCURRENCY = 32;
const TEST_ACCOUNT_ID = "webhook-load-test-account";

function webhookKey(eventId: string) {
  return `smartdirect:idempotency:v1:webhook:${TEST_ACCOUNT_ID}:MESSAGING:${createHash("sha256").update(eventId).digest("hex")}`;
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 180_000,
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for webhook load test completion.");
}

async function main() {
  const controller = new AbortController();
  let processed = 0;
  const processedIds = new Set<string>();
  const jobs: string[] = [];

  // 1. Verify concurrent webhook idempotency: 50 claims for the same event
  // must produce exactly one owner.
  const duplicateEventId = `load-duplicate-${Date.now()}`;
  const duplicateResults = await Promise.all(
    Array.from({ length: 50 }, () =>
      claimInstagramWebhookEvent({
        instagramAccountId: TEST_ACCOUNT_ID,
        eventType: "MESSAGING",
        eventId: duplicateEventId,
        event: {
          sender: { id: "load-test-user" },
          message: { mid: duplicateEventId, text: "load-test" },
        },
      }),
    ),
  );

  const claimedCount = duplicateResults.filter((result) => result.claimed).length;

  if (claimedCount !== 1) {
    throw new Error(
      `Expected exactly one idempotency claim, received ${claimedCount}.`,
    );
  }

  await completeInstagramWebhookEvent(
    webhookKey(duplicateEventId),
  );

  // 2. Queue a realistic burst of normalized webhook jobs.
  for (let index = 0; index < TOTAL_EVENTS; index++) {
    const eventId = `load-event-${Date.now()}-${index}`;

    const job = await enqueueJob(
      "INSTAGRAM_WEBHOOK",
      {
        event: {
          sender: { id: `load-user-${index}` },
          message: {
            mid: eventId,
            text: `load-${index}`,
          },
        },
        eventId,
        instagramAccountId: TEST_ACCOUNT_ID,
        eventType: "MESSAGING",
      },
      {
        priority: "high",
        maxAttempts: 3,
      },
    );

    jobs.push(job.id);
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, index) =>
    runQueueWorker(
      async (job) => {
        if (job.type !== "INSTAGRAM_WEBHOOK") {
          throw new Error(`Unexpected job type: ${job.type}`);
        }

        const eventId = job.payload.eventId;

        if (processedIds.has(eventId)) {
          throw new Error(`Duplicate processing detected: ${eventId}`);
        }

        processedIds.add(eventId);
        processed += 1;
      },
      {
        concurrency: 1,
        pollIntervalMs: 100,
        workerId: `webhook-load-worker-${index}-${Date.now()}`,
        signal: controller.signal,
      },
    ),
  );

  let waitError: unknown;

  try {
    await waitFor(async () => processed === TOTAL_EVENTS);
  } catch (error) {
    waitError = error;
  } finally {
    controller.abort();
    await Promise.all(workers);
  }

  const failedJobs: string[] = [];

  for (const jobId of jobs) {
    const job = await getJob(jobId);

    if (!job || job.status !== "completed") {
      failedJobs.push(jobId);
    }

    await deleteJob(jobId);
  }

  if (waitError) {
    throw new Error(
      `${waitError instanceof Error ? waitError.message : String(waitError)} Processed ${processed}/${TOTAL_EVENTS} events.`,
    );
  }

  if (failedJobs.length > 0) {
    throw new Error(
      `${failedJobs.length} webhook load-test jobs did not complete.`,
    );
  }

  const depth = await getQueueDepth();

  console.log("94 Webhook load test: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        totalEvents: TOTAL_EVENTS,
        workers: CONCURRENCY,
        processed,
        duplicateClaims: claimedCount,
        duplicateExecutions: 0,
        failedJobs: failedJobs.length,
        queueDepthAfterCleanup: depth,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("94 Webhook load test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
