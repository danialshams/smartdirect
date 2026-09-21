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

  const resourceId = `acquisition-test-${Date.now()}-${Math.random()}`;
  const input = {
    scope: "job" as const,
    resourceId,
  };

  const attempts = 100;
  const results = await Promise.all(
    Array.from({ length: attempts }, () => acquireLock(input)),
  );

  const owners = results.filter((result) => result.acquired);
  const blocked = results.filter((result) => !result.acquired);

  if (owners.length !== 1) {
    throw new Error(`Expected exactly one owner, got ${owners.length}.`);
  }

  if (blocked.length !== attempts - 1) {
    throw new Error(
      `Expected ${attempts - 1} blocked acquisitions, got ${blocked.length}.`,
    );
  }

  if (blocked.some((result) => result.reason !== "ALREADY_LOCKED")) {
    throw new Error("A blocked acquisition returned an unexpected reason.");
  }

  const owner = owners[0];
  if (!owner.acquired) {
    throw new Error("Acquisition result lost its owner state.");
  }

  if (!(await isLockOwned(owner.handle))) {
    throw new Error("Acquired lock is not owned by its returned handle.");
  }

  const competing = await acquireLock(input);
  if (competing.acquired || competing.reason !== "ALREADY_LOCKED") {
    throw new Error("A competing acquisition bypassed the active lock.");
  }

  const released = await releaseLock(owner.handle);
  if (!released) {
    throw new Error("The acquired lock could not be released.");
  }

  const afterRelease = await acquireLock(input);
  if (!afterRelease.acquired) {
    throw new Error("Lock could not be acquired after the previous owner released it.");
  }

  await releaseLock(afterRelease.handle);

  console.log("78 Redis lock acquisition: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "100-concurrent-acquisitions",
          "exactly-one-owner",
          "blocked-reason",
          "owner-handle-valid",
          "active-lock-contention",
          "release-and-reacquisition",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("78 Redis lock acquisition: FAILED");
  console.error(error);
  process.exitCode = 1;
});
