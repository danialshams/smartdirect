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
  const { acquireLock, releaseLock } = await import("../src/lib/lock/redis-lock");

  const originalTtl = process.env.DISTRIBUTED_LOCK_TTL_SECONDS;
  const input = {
    scope: "job" as const,
    resourceId: `failure-test-${Date.now()}-${Math.random()}`,
  };

  try {
    process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "0";

    const invalidTtlLock = await acquireLock(input);
    if (!invalidTtlLock.acquired) {
      throw new Error("Lock acquisition failed while testing invalid TTL fallback.");
    }

    await releaseLock(invalidTtlLock.handle);

    process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "not-a-number";

    const malformedTtlLock = await acquireLock(input);
    if (!malformedTtlLock.acquired) {
      throw new Error("Lock acquisition failed while testing malformed TTL fallback.");
    }

    await releaseLock(malformedTtlLock.handle);

    process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "1";

    const owner = await acquireLock(input);
    if (!owner.acquired) {
      throw new Error("Initial lock acquisition failed.");
    }

    const failureStart = Date.now();

    try {
      await Promise.reject(new Error("simulated-worker-failure"));
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "simulated-worker-failure") {
        throw error;
      }
    } finally {
      await releaseLock(owner.handle);
    }

    const failureDurationMs = Date.now() - failureStart;

    const afterFailure = await acquireLock(input);
    if (!afterFailure.acquired) {
      throw new Error("Lock remained stuck after worker failure cleanup.");
    }

    await releaseLock(afterFailure.handle);

    process.env.DISTRIBUTED_LOCK_TTL_SECONDS = "1";

    const expiringOwner = await acquireLock(input);
    if (!expiringOwner.acquired) {
      throw new Error("Could not acquire lock for TTL failure test.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const recovered = await acquireLock(input);
    if (!recovered.acquired) {
      throw new Error("Lock did not recover after TTL expiration.");
    }

    const staleRelease = await releaseLock(expiringOwner.handle);
    if (staleRelease) {
      throw new Error("Expired owner released a recovered lock.");
    }

    if (!await releaseLock(recovered.handle)) {
      throw new Error("Recovered owner could not release the lock.");
    }

    console.log("81 Lock failure handling: OK");
    console.log(
      JSON.stringify(
        {
          success: true,
          tests: [
            "invalid-ttl-fallback",
            "malformed-ttl-fallback",
            "release-after-worker-failure",
            "no-stuck-lock",
            "ttl-recovery",
            "stale-owner-protection-after-recovery",
          ],
          failureDurationMs,
        },
        null,
        2,
      ),
    );
  } finally {
    if (originalTtl === undefined) {
      delete process.env.DISTRIBUTED_LOCK_TTL_SECONDS;
    } else {
      process.env.DISTRIBUTED_LOCK_TTL_SECONDS = originalTtl;
    }
  }
}

main().catch((error) => {
  console.error("81 Lock failure handling: FAILED");
  console.error(error);
  process.exitCode = 1;
});
