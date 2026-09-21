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
  const { acquireLock, releaseLock, isLockOwned, createLockKey, getLockTtlSeconds, DISTRIBUTED_LOCK_TTL_DEFAULT_SECONDS, DISTRIBUTED_LOCK_TTL_MIN_SECONDS, DISTRIBUTED_LOCK_TTL_MAX_SECONDS } = await import("../src/lib/lock/redis-lock");

  const originalTtl = process.env.DISTRIBUTED_LOCK_TTL_SECONDS;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const restoreTtl = () => {
    if (originalTtl === undefined) delete process.env.DISTRIBUTED_LOCK_TTL_SECONDS;
    else process.env.DISTRIBUTED_LOCK_TTL_SECONDS = originalTtl;
  };

  delete process.env.DISTRIBUTED_LOCK_TTL_SECONDS;
  if (getLockTtlSeconds() !== DISTRIBUTED_LOCK_TTL_DEFAULT_SECONDS) {
    throw new Error("Default lock TTL validation failed.");
  }

  process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "7";
  if (getLockTtlSeconds() !== 7) {
    throw new Error("Configured lock TTL validation failed.");
  }

  for (const invalid of ["0", "-1", "301", "1.5", "abc"]) {
    process.env.DISTRIBUTED_LOCK_TTL_SECONDS = invalid;
    if (getLockTtlSeconds() !== DISTRIBUTED_LOCK_TTL_DEFAULT_SECONDS) {
      throw new Error(`Invalid lock TTL was accepted: ${invalid}`);
    }
  }

  process.env.DISTRIBUTED_LOCK_TTL_SECONDS = String(DISTRIBUTED_LOCK_TTL_MIN_SECONDS);
  if (getLockTtlSeconds() !== DISTRIBUTED_LOCK_TTL_MIN_SECONDS) {
    throw new Error("Minimum lock TTL was rejected.");
  }

  process.env.DISTRIBUTED_LOCK_TTL_SECONDS = String(DISTRIBUTED_LOCK_TTL_MAX_SECONDS);
  if (getLockTtlSeconds() !== DISTRIBUTED_LOCK_TTL_MAX_SECONDS) {
    throw new Error("Maximum lock TTL was rejected.");
  }

  process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "1";
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

  const ttlInput = { scope: "job" as const, resourceId: `ttl-test-${Date.now()}-${Math.random()}` };
  const ttlOwner = await acquireLock(ttlInput);
  if (!ttlOwner.acquired) throw new Error("TTL test lock could not be acquired.");
  const ttlRemaining = ttlOwner.handle.expiresAt - Date.now();
  if (ttlRemaining < 800 || ttlRemaining > 1500) throw new Error(`Unexpected 1-second lock expiry window: ${ttlRemaining}ms`);
  await sleep(1200);
  if (await isLockOwned(ttlOwner.handle)) throw new Error("Lock did not expire after its TTL.");
  const afterExpiry = await acquireLock(ttlInput);
  if (!afterExpiry.acquired) throw new Error("Lock could not be reacquired after TTL expiration.");
  await releaseLock(afterExpiry.handle);

  process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "30";

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

  restoreTtl();

  console.log("77 Redis lock TTL: OK");
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
          "default-ttl",
          "configured-ttl",
          "invalid-ttl-fallback",
          "minimum-ttl",
          "maximum-ttl",
          "ttl-expiration",
          "reacquisition-after-ttl",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("77 Redis lock TTL: FAILED");
    console.error(error);
    process.exitCode = 1;
  });
