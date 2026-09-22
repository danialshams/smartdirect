import "dotenv/config";

import {
  claimNextJob,
  completeJob,
  deleteJob,
  enqueueJob,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";

async function main() {
  const queueNamespace = `group18-smoke-${Date.now()}`;
  const job = await enqueueJob(
    "TEST",
    { message: `worker-smoke-${Date.now()}` },
    {
      priority: "normal",
      maxAttempts: 1,
      queueNamespace,
    },
  );

  console.log(
    JSON.stringify(
      {
        step: "enqueued",
        jobId: job.id,
        status: job.status,
      },
      null,
      2,
    ),
  );

  try {
    const queued = await getJob(job.id);
    console.log(
      JSON.stringify(
        {
          step: "before-claim",
          jobId: job.id,
          status: queued?.status ?? "missing",
          queue: await getQueueDepth(queueNamespace),
        },
        null,
        2,
      ),
    );

    const claimed = await claimNextJob("worker-smoke", queueNamespace);

    if (!claimed) {
      throw new Error("SMOKE_CLAIM_FAILED: claimNextJob returned null.");
    }

    console.log(
      JSON.stringify(
        {
          step: "claimed",
          jobId: claimed.id,
          status: claimed.status,
          attempts: claimed.attempts,
          workerId: claimed.workerId,
          queue: await getQueueDepth(),
        },
        null,
        2,
      ),
    );

    if (claimed.id !== job.id) {
      throw new Error(`SMOKE_CLAIM_FAILED: expected ${job.id}, got ${claimed.id}.`);
    }

    const completed = await completeJob(claimed.id);

    if (completed?.status !== "completed") {
      throw new Error(
        `SMOKE_COMPLETE_FAILED: expected completed, got ${completed?.status ?? "missing"}.`,
      );
    }

    const finalJob = await getJob(job.id);

    console.log(
      JSON.stringify(
        {
          step: "completed",
          jobId: job.id,
          status: finalJob?.status ?? "missing",
          queue: await getQueueDepth(),
        },
        null,
        2,
      ),
    );

    if (finalJob?.status !== "completed") {
      throw new Error(
        `SMOKE_FINAL_STATE_FAILED: expected completed, got ${finalJob?.status ?? "missing"}.`,
      );
    }

    console.log("Worker Smoke Test: OK");
  } finally {
    await deleteJob(job.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
