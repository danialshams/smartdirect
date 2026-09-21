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
  const { acquireLock, releaseLock, isLockOwned, createLockKey } = await import("../src/lib/lock/redis-lock");

  const resourceId = `lock-test-${Date.now()}-${Math.random()}`;
  const input = {
    scope: "job" as const,
    resourceId,
  };

  const expectedKey = `smartdirect:lock:v1:job:${encodeURIComponent(resourceId)}`;
  if (createLockKey(input) !== expectedKey) {
    throw new Error("Lock key strategy failed.");
  }

  if (createLockKey({ scope: "job", resourceId: "  same-resource  " }) !==
      "smartdirect:lock:v1:job:same-resource") {
    throw new Error("Lock key normalization failed.");
  }

  if (createLockKey({ scope: "job", resourceId: "a:b/c?d" }) !==
      "smartdirect:lock:v1:job:a%3Ab%2Fc%3Fd") {
    throw new Error("Lock key encoding failed.");
  }

  if (createLockKey({ scope: "job", resourceId }) ===
      createLockKey({ scope: "conversation", resourceId })) {
    throw new Error("Lock scope isolation failed.");
  }

  if (createLockKey({ scope: "job", resourceId: "resource-a" }) ===
      createLockKey({ scope: "job", resourceId: "resource-b" })) {
    throw new Error("Lock resource isolation failed.");
  }

  try {
    createLockKey({ scope: "job", resourceId: "   " });
    throw new Error("Empty resource ID was accepted.");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("resourceId cannot be empty")) {
      throw error;
    }
  }

  const [first, second] = await Promise.all([
    acquireLock(input),
    acquireLock(input),
  ]);

  const acquired = [first, second].filter((result) => result.acquired);
  const blocked = [first, second].filter((result) => !result.acquired);

  if (acquired.length !== 1 || blocked.length !== 1) {
    throw new Error(
      `Expected one owner and one blocked acquisition, got owners=${acquired.length}, blocked=${blocked.length}.`,
    );
  }

  const owner = acquired[0];
  if (!owner.acquired) {
    throw new Error("Lock owner was not acquired.");
  }

  if (!(await isLockOwned(owner.handle))) {
    throw new Error("Lock ownership check failed.");
  }

  const fakeRelease = await releaseLock({
    key: owner.handle.key,
    token: "not-the-owner",
    expiresAt: owner.handle.expiresAt,
  });

  if (fakeRelease) {
    throw new Error("Non-owner was able to release the lock.");
  }

  const released = await releaseLock(owner.handle);

  if (!released) {
    throw new Error("Owner could not release the lock.");
  }

  if (await isLockOwned(owner.handle)) {
    throw new Error("Lock remained owned after release.");
  }

  const reacquired = await acquireLock(input);

  if (!reacquired.acquired) {
    throw new Error("Lock could not be reacquired after release.");
  }

  await releaseLock(reacquired.handle);

  console.log("76 Redis lock key strategy: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "atomic-acquisition",
          "single-owner",
          "ownership-check",
          "non-owner-release-block",
          "owner-release",
          "reacquisition-after-release",
          "canonical-key-format",
          "resource-normalization",
          "resource-encoding",
          "scope-isolation",
          "resource-isolation",
          "empty-resource-rejection",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("75 Redis distributed lock: FAILED");
    console.error(error);
    process.exitCode = 1;
  });
