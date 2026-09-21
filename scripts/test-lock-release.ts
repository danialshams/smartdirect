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

  const input = {
    scope: "job" as const,
    resourceId: `release-test-${Date.now()}-${Math.random()}`,
  };

  const ownerA = await acquireLock(input);
  if (!ownerA.acquired) {
    throw new Error("Initial lock acquisition failed.");
  }

  if (!(await isLockOwned(ownerA.handle))) {
    throw new Error("Initial owner does not own the lock.");
  }

  const nonOwnerRelease = await releaseLock({
    key: ownerA.handle.key,
    token: `wrong-token-${Math.random()}`,
    expiresAt: ownerA.handle.expiresAt,
  });

  if (nonOwnerRelease) {
    throw new Error("A non-owner was able to release the lock.");
  }

  if (!(await isLockOwned(ownerA.handle))) {
    throw new Error("Non-owner release changed the active lock.");
  }

  const releasedA = await releaseLock(ownerA.handle);
  if (!releasedA) {
    throw new Error("The actual owner could not release the lock.");
  }

  if (await isLockOwned(ownerA.handle)) {
    throw new Error("Released lock is still owned by the previous owner.");
  }

  const ownerB = await acquireLock(input);
  if (!ownerB.acquired) {
    throw new Error("A new owner could not acquire after release.");
  }

  const staleRelease = await releaseLock(ownerA.handle);
  if (staleRelease) {
    throw new Error("A stale owner handle released a newer owner's lock.");
  }

  if (!(await isLockOwned(ownerB.handle))) {
    throw new Error("The newer owner's lock was affected by stale release.");
  }

  const releasedB = await releaseLock(ownerB.handle);
  if (!releasedB) {
    throw new Error("The newer owner could not release its lock.");
  }

  const doubleRelease = await releaseLock(ownerB.handle);
  if (doubleRelease) {
    throw new Error("Releasing an already released lock returned success.");
  }

  const finalOwner = await acquireLock(input);
  if (!finalOwner.acquired) {
    throw new Error("Lock could not be reacquired after final release.");
  }

  await releaseLock(finalOwner.handle);

  console.log("79 Redis lock release: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "non-owner-release-block",
          "owner-release",
          "release-removes-lock",
          "stale-owner-release-block",
          "new-owner-protection",
          "double-release-block",
          "reacquisition-after-release",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("79 Redis lock release: FAILED");
  console.error(error);
  process.exitCode = 1;
});
