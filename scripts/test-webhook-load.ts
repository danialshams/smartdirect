import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";

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
import { prisma } from "../src/lib/prisma";

const TOTAL_EVENTS = Math.max(1, Number(process.env.WEBHOOK_LOAD_TOTAL ?? 1000));
const CONCURRENCY = Math.max(1, Number(process.env.WEBHOOK_LOAD_CONCURRENCY ?? 16));
const DUPLICATE_REQUESTS = Math.max(2, Number(process.env.WEBHOOK_LOAD_DUPLICATES ?? 50));
const QUEUE_NAMESPACE = "webhook-load-test";
process.env.REDIS_COMMAND_TIMEOUT_MS ??= "30_000";
const TEST_ACCOUNT_ID = `webhook-load-test-account:${randomUUID()}`;

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
  const startedAt = Date.now();
  const controller = new AbortController();
  let processed = 0;
  const processedIds = new Set<string>();
  const jobs: string[] = [];

  // 1. Verify concurrent webhook idempotency: duplicate claims must produce exactly one owner.
  console.log(`[180] phase 1/5: starting ${DUPLICATE_REQUESTS} concurrent idempotency claims...`);
  const duplicateEventId = `load-duplicate-${Date.now()}`;
  const duplicateResults = await Promise.race([
    Promise.all(
      Array.from({ length: DUPLICATE_REQUESTS }, () =>
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
    ),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Timed out during phase 1: concurrent idempotency claims did not finish within 60s.",
            ),
          ),
        60_000,
      ),
    ),
  ]);

  console.log(`[180] phase 1/5: idempotency claims completed.`);

  const claimedCount = duplicateResults.filter((result) => result.claimed).length;

  if (claimedCount !== 1) {
    throw new Error(
      `Expected exactly one idempotency claim, received ${claimedCount}.`,
    );
  }

  await completeInstagramWebhookEvent(
    webhookKey(duplicateEventId),
  );

  console.log(`[180] phase 2/5: enqueueing ${TOTAL_EVENTS} webhook jobs...`);
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
        queueNamespace: QUEUE_NAMESPACE,
      },
    );

    jobs.push(job.id);

    if ((index + 1) % 100 === 0 || index + 1 === TOTAL_EVENTS) {
      console.log(`[180] phase 2/5: enqueued ${index + 1}/${TOTAL_EVENTS}`);
    }
  }

  console.log(`[180] phase 3/5: starting worker (concurrency=${CONCURRENCY})...`);
  const workers = [
    runQueueWorker(
      async (job) => {
        if (job.type !== "INSTAGRAM_WEBHOOK") {
          throw new Error(`Unexpected job type: ${job.type}`);
        }

        const webhookJob = job as import("../src/lib/queue/types").QueueJob<"INSTAGRAM_WEBHOOK">;
        const eventId = webhookJob.payload.eventId;

        if (processedIds.has(eventId)) {
          throw new Error(`Duplicate processing detected: ${eventId}`);
        }

        processedIds.add(eventId);
        processed += 1;

        if (processed % 100 === 0 || processed === TOTAL_EVENTS) {
          console.log(`[180] phase 4/5: processed ${processed}/${TOTAL_EVENTS}`);
        }
      },
      {
        concurrency: CONCURRENCY,
        pollIntervalMs: 100,
        workerId: `webhook-load-worker-${Date.now()}-${randomUUID()}`,
        queueNamespace: QUEUE_NAMESPACE,
        signal: controller.signal,
      },
    ),
  ];

  let waitError: unknown;

  try {
    await waitFor(async () => processed === TOTAL_EVENTS);
  } catch (error) {
    waitError = error;
  } finally {
    controller.abort();
    await Promise.all(workers);
  }

  console.log(`[180] phase 4/5: all webhook jobs processed; validating job states...`);
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

  console.log(`[180] phase 5/5: cleanup and final metrics...`);
  const depth = await getQueueDepth(QUEUE_NAMESPACE);
  const durationMs = Date.now() - startedAt;
  const throughput = durationMs > 0 ? Number(((TOTAL_EVENTS / durationMs) * 1000).toFixed(2)) : TOTAL_EVENTS;

  console.log("180 Webhook load test: OK");
  await prisma.idempotencyRecord.deleteMany({ where: { tenantId: TEST_ACCOUNT_ID } });

  console.log(
    JSON.stringify(
      {
        success: true,
        totalEvents: TOTAL_EVENTS,
        workers: CONCURRENCY,
        duplicateRequests: DUPLICATE_REQUESTS,
        processed,
        duplicateClaims: claimedCount,
        duplicateExecutions: 0,
        failedJobs: failedJobs.length,
        queueDepthAfterCleanup: depth,
        durationMs,
        throughput,
        queueNamespace: QUEUE_NAMESPACE,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("180 Webhook load test: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.idempotencyRecord.deleteMany({ where: { tenantId: TEST_ACCOUNT_ID } });
    await prisma.$disconnect();
  });
