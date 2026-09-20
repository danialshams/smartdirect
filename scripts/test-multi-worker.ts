import "dotenv/config";

import {
  enqueueJob,
  getJob,
} from "../src/lib/queue/core";

const JOB_COUNT = Number(process.env.QUEUE_WORKER_TEST_JOBS ?? 10);
const POLL_MS = 250;
const TIMEOUT_MS = 30_000;

async function main() {
  const jobs = await Promise.all(
    Array.from({ length: JOB_COUNT }, (_, index) =>
      enqueueJob(
        "TEST",
        { message: `multi-worker-test-${index + 1}` },
        {
          priority: "normal",
        },
      ),
    ),
  );

  console.log(
    JSON.stringify(
      {
        event: "test:jobs-created",
        count: jobs.length,
        jobIds: jobs.map((job) => job.id),
      },
      null,
      2,
    ),
  );

  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const current = await Promise.all(
      jobs.map((job) => getJob(job.id)),
    );

    const completed = current.filter(
      (job) => job?.status === "completed",
    ).length;

    const failed = current.filter(
      (job) => job?.status === "failed",
    ).length;

    if (completed + failed === jobs.length) {
      const duplicateAttempts = current.filter(
        (job) => (job?.attempts ?? 0) > 1,
      );

      console.log(
        JSON.stringify(
          {
            event: "test:finished",
            total: jobs.length,
            completed,
            failed,
            duplicateClaimCandidates: duplicateAttempts.map((job) => ({
              id: job?.id,
              attempts: job?.attempts,
            })),
          },
          null,
          2,
        ),
      );

      if (failed > 0 || duplicateAttempts.length > 0) {
        process.exitCode = 1;
      }

      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  throw new Error(
    `Timed out after ${TIMEOUT_MS}ms waiting for workers to process ${JOB_COUNT} jobs`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
