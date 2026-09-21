import "dotenv/config";

import { randomUUID } from "node:crypto";

import { createIdempotencyKey } from "../src/lib/idempotency/key";
import { prisma } from "../src/lib/prisma";
import {
  deleteJob,
  enqueueJob,
  getJob,
} from "../src/lib/queue/core";
import { runQueueWorker } from "../src/lib/queue/worker";

const TIMEOUT_MS = 15_000;

async function waitForCompletion(jobIds: string[]) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const jobs = await Promise.all(jobIds.map((id) => getJob(id)));

    if (
      jobs.every(
        (job) => job?.status === "completed" || job?.status === "failed",
      )
    ) {
      return jobs;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for duplicate jobs to finish.");
}

async function main() {
  const testId = randomUUID();
  const tenantId = `queue-idempotency-test:${testId}`;
  const clientKey = `duplicate-job:${testId}`;
  const idempotencyKey = createIdempotencyKey(
    {
      tenantId,
      operation: "TEST_QUEUE_JOB",
      resourceId: "resource-test",
    },
    clientKey,
  );

  const jobs: string[] = [];
  let handlerExecutions = 0;

  const controller = new AbortController();

  const handler = async () => {
    handlerExecutions += 1;
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  try {
    const [first, second] = await Promise.all([
      enqueueJob(
        "TEST",
        { message: "duplicate-job-1" },
        {
          idempotency: {
            key: idempotencyKey,
            tenantId,
            operation: "TEST_QUEUE_JOB",
            resourceId: "resource-test",
          },
        },
      ),
      enqueueJob(
        "TEST",
        { message: "duplicate-job-2" },
        {
          idempotency: {
            key: idempotencyKey,
            tenantId,
            operation: "TEST_QUEUE_JOB",
            resourceId: "resource-test",
          },
        },
      ),
    ]);

    jobs.push(first.id, second.id);

    const worker1 = runQueueWorker(handler, {
      concurrency: 1,
      pollIntervalMs: 50,
      workerId: `idempotency-test-worker-1-${testId}`,
      signal: controller.signal,
    });

    const worker2 = runQueueWorker(handler, {
      concurrency: 1,
      pollIntervalMs: 50,
      workerId: `idempotency-test-worker-2-${testId}`,
      signal: controller.signal,
    });

    const completed = await waitForCompletion(jobs);

    if (completed.some((job) => job?.status !== "completed")) {
      throw new Error("Duplicate queue jobs did not both complete.");
    }

    if (handlerExecutions !== 1) {
      throw new Error(
        `Expected exactly 1 handler execution, got ${handlerExecutions}.`,
      );
    }

    const third = await enqueueJob(
      "TEST",
      { message: "duplicate-job-3" },
      {
        idempotency: {
          key: idempotencyKey,
          tenantId,
          operation: "TEST_QUEUE_JOB",
          resourceId: "resource-test",
        },
      },
    );

    jobs.push(third.id);

    const thirdController = new AbortController();

    const thirdWorker = runQueueWorker(handler, {
      concurrency: 1,
      pollIntervalMs: 50,
      workerId: `idempotency-test-worker-3-${testId}`,
      signal: thirdController.signal,
    });

    const thirdResultPromise = waitForCompletion([third.id]);
    const thirdResult = await thirdResultPromise;

    thirdController.abort();
    controller.abort();

    await Promise.all([worker1, worker2, thirdWorker]);

    if (thirdResult[0]?.status !== "completed") {
      throw new Error("Completed idempotency record did not skip duplicate job.");
    }

    if (handlerExecutions !== 1) {
      throw new Error(
        `Completed duplicate executed unexpectedly: ${handlerExecutions} executions.`,
      );
    }

    console.log("66 duplicate queue execution prevention: OK");
    console.log(
      JSON.stringify(
        {
          success: true,
          tests: [
            "concurrent-duplicate-jobs",
            "single-handler-execution",
            "completed-record-skips-duplicate",
          ],
          handlerExecutions,
        },
        null,
        2,
      ),
    );
  } finally {
    controller.abort();

    await Promise.all(
      jobs.map((jobId) => deleteJob(jobId)),
    );

    await prisma.idempotencyRecord.deleteMany({
      where: {
        key: idempotencyKey,
      },
    });

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
