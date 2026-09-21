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

async function main() {
  const { acquireLock, releaseLock, isLockOwned } = await import("../src/lib/lock/redis-lock");

  delete process.env.DISTRIBUTED_LOCK_TTL_SECONDS;

  const resources = Array.from(
    { length: 20 },
    (_, index) => ({
      scope: "job" as const,
      resourceId: `concurrent-worker-test-${Date.now()}-${index}-${Math.random()}`,
    }),
  );

  const workersPerResource = 50;
  let totalExecutions = 0;

  const resourceResults = await Promise.all(
    resources.map(async (input) => {
      const results = await Promise.all(
        Array.from({ length: workersPerResource }, async (_, workerIndex) => {
          const lock = await acquireLock(input);

          if (!lock.acquired) {
            return { workerIndex, executed: false };
          }

          try {
            totalExecutions += 1;
            await new Promise((resolve) => setTimeout(resolve, 25));
            return { workerIndex, executed: true };
          } finally {
            await releaseLock(lock.handle);
          }
        }),
      );

      const executed = results.filter((result) => result.executed);
      const blocked = results.filter((result) => !result.executed);

      if (executed.length !== 1) {
        throw new Error(
          `Expected exactly one execution for ${input.resourceId}, got ${executed.length}.`,
        );
      }

      if (blocked.length !== workersPerResource - 1) {
        throw new Error(
          `Expected ${workersPerResource - 1} blocked workers for ${input.resourceId}, got ${blocked.length}.`,
        );
      }

      const reacquired = await acquireLock(input);
      if (!reacquired.acquired) {
        throw new Error(`Lock could not be reacquired for ${input.resourceId}.`);
      }

      if (!(await isLockOwned(reacquired.handle))) {
        throw new Error(`Reacquired lock is not owned for ${input.resourceId}.`);
      }

      await releaseLock(reacquired.handle);

      return {
        resourceId: input.resourceId,
        executions: executed.length,
        blocked: blocked.length,
      };
    }),
  );

  if (totalExecutions !== resources.length) {
    throw new Error(
      `Expected ${resources.length} total executions, got ${totalExecutions}.`,
    );
  }

  console.log("82 Concurrent worker test: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "20-independent-resources",
          "50-concurrent-workers-per-resource",
          "exactly-one-execution-per-resource",
          "49-blocked-workers-per-resource",
          "cross-resource-isolation",
          "reacquisition-after-release",
          "total-execution-count",
        ],
        resources: resources.length,
        workersPerResource,
        totalExecutions,
        blockedExecutions:
          resources.length * (workersPerResource - 1),
        resourceResults,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("82 Concurrent worker test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
