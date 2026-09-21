import "dotenv/config";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");

require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as any;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { acquireLock, releaseLock } = await import("../src/lib/lock/redis-lock");

  delete process.env.DISTRIBUTED_LOCK_TTL_SECONDS;

  const resourceId = `double-worker-test-${Date.now()}-${Math.random()}`;
  const workerCount = 50;

  let executions = 0;

  const results = await Promise.all(
    Array.from({ length: workerCount }, async (_, index) => {
      const lock = await acquireLock({
        scope: "job",
        resourceId,
      });

      if (!lock.acquired) {
        return { worker: index, executed: false };
      }

      try {
        executions += 1;
        await sleep(100);
        return { worker: index, executed: true };
      } finally {
        await releaseLock(lock.handle);
      }
    }),
  );

  const executed = results.filter((result) => result.executed);
  const blocked = results.filter((result) => !result.executed);

  if (executions !== 1) {
    throw new Error(`Expected exactly one worker execution, got ${executions}.`);
  }

  if (executed.length !== 1) {
    throw new Error(`Expected exactly one executing worker, got ${executed.length}.`);
  }

  if (blocked.length !== workerCount - 1) {
    throw new Error(
      `Expected ${workerCount - 1} blocked workers, got ${blocked.length}.`,
    );
  }

  const reacquired = await acquireLock({
    scope: "job",
    resourceId,
  });

  if (!reacquired.acquired) {
    throw new Error("The job lock could not be reacquired after execution.");
  }

  await releaseLock(reacquired.handle);

  console.log("80 Prevent double worker: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "worker-execution-lock",
          "exactly-one-execution",
          "49-blocked-workers",
          "lock-release-after-execution",
          "reacquisition-after-execution",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("80 Prevent double worker: FAILED");
  console.error(error);
  process.exitCode = 1;
});
