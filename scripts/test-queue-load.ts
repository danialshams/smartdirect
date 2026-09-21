import "dotenv/config";

import {
  deleteJob,
  enqueueJob,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";
import { getLoadTestConfig } from "./load-test/config";
import { printLoadTestReport } from "./load-test/report";
import { runLoadTest } from "./load-test/runner";

async function main() {
  const config = getLoadTestConfig("queue-load", {
    total: 1_000,
    concurrency: 16,
    durationMs: 30_000,
  });

  const createdJobIds: string[] = [];
  const startedAt = Date.now();

  try {
    const result = await runLoadTest(config, async (index) => {
      const job = await enqueueJob(
        "TEST",
        {
          message: "queue-load-" + startedAt + "-" + index,
        },
        {
          priority:
            index % 4 === 0
              ? "high"
              : index % 4 === 1
                ? "normal"
                : index % 4 === 2
                  ? "low"
                  : "critical",
          maxAttempts: 1,
        },
      );

      createdJobIds.push(job.id);

      if (job.status !== "waiting") {
        throw new Error("Expected waiting job, received " + job.status);
      }
    });

    printLoadTestReport(result);

    if (result.failed > 0) {
      throw new Error(
        "queue-load failed: " +
          result.failed +
          " of " +
          result.total +
          " operations failed.",
      );
    }

    const depth = await getQueueDepth();
    const missingJobs: string[] = [];

    for (const jobId of createdJobIds) {
      const job = await getJob(jobId);

      if (!job || job.status !== "waiting") {
        missingJobs.push(jobId);
      }
    }

    if (missingJobs.length > 0) {
      throw new Error(
        "Queue integrity check failed: " +
          missingJobs.length +
          " jobs were not readable as waiting.",
      );
    }

    if (depth.ready < createdJobIds.length) {
      throw new Error(
        "Queue depth check failed: expected at least " +
          createdJobIds.length +
          " ready jobs, received " +
          depth.ready +
          ".",
      );
    }

    console.log(
      JSON.stringify(
        {
          integrity: true,
          created: createdJobIds.length,
          readyDepth: depth.ready,
          delayedDepth: depth.delayed,
          activeDepth: depth.active,
          failedDepth: depth.failed,
        },
        null,
        2,
      ),
    );

    console.log("177 Queue Load Test: OK");
  } finally {
    const cleanupResults = await Promise.allSettled(
      createdJobIds.map((jobId) => deleteJob(jobId)),
    );

    const cleanupFailures = cleanupResults.filter(
      (result) => result.status === "rejected",
    ).length;

    if (cleanupFailures > 0) {
      console.error(
        "Queue load-test cleanup failed for " + cleanupFailures + " jobs.",
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
