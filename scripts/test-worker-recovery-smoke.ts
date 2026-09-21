import "dotenv/config";

import { getQueueDepth } from "../src/lib/queue/core";
import { recoverStalledJobs } from "../src/lib/queue/recovery";

async function main() {
  const before = await getQueueDepth();
  const startedAt = Date.now();

  console.log(
    JSON.stringify(
      {
        step: "before",
        startedAt: new Date(startedAt).toISOString(),
        queue: before,
      },
      null,
      2,
    ),
  );

  const timeoutMs = 10_000;

  const result = await Promise.race([
    recoverStalledJobs(50),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `RECOVERY_SMOKE_TIMEOUT: recoverStalledJobs did not finish within ${timeoutMs}ms.`,
          ),
        );
      }, timeoutMs);
    }),
  ]);

  const after = await getQueueDepth();
  const durationMs = Date.now() - startedAt;

  console.log(
    JSON.stringify(
      {
        step: "after",
        durationMs,
        result,
        queue: after,
      },
      null,
      2,
    ),
  );

  console.log("Recovery Smoke Test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
