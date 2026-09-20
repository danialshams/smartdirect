import "dotenv/config";

import {
  completeJob,
  enqueueJob,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";

async function main() {
  const before = await getQueueDepth();

  const job = await enqueueJob(
    "TEST",
    { message: "smartdirect-queue-test" },
    {
      priority: "high",
    },
  );

  const afterEnqueue = await getQueueDepth();

  console.log(
    JSON.stringify(
      {
        ok: true,
        createdJobId: job.id,
        createdStatus: job.status,
        before,
        afterEnqueue,
      },
      null,
      2,
    ),
  );

  const stored = await getJob(job.id);

  if (!stored || stored.id !== job.id) {
    throw new Error("Queue job could not be read back from Redis");
  }

  await completeJob(job.id);

  const completed = await getJob(job.id);

  if (!completed || completed.status !== "completed") {
    throw new Error("Queue job could not be marked completed");
  }

  console.log(
    JSON.stringify(
      {
        completed: true,
        jobId: completed.id,
        status: completed.status,
        attempts: completed.attempts,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
