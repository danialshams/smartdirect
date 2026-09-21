import "dotenv/config";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as any;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const {
    claimIdempotency,
    completeIdempotency,
    failIdempotency,
    getIdempotencyRecord,
  } = await import("../src/lib/idempotency/store");

  const prefix = `smartdirect-idempotency-store-test:${randomUUID()}`;
  const key = `${prefix}:complete`;
  const failedKey = `${prefix}:failed`;

  try {
    const first = await claimIdempotency({
      key,
      tenantId: "tenant-test",
      operation: "TEST_OPERATION",
      resourceId: "resource-test",
      ttlSeconds: 300,
    });

    if (!first.claimed || first.record.status !== "IN_PROGRESS") {
      throw new Error("Initial claim failed.");
    }

    const duplicate = await claimIdempotency({
      key,
      tenantId: "tenant-test",
      operation: "TEST_OPERATION",
      resourceId: "resource-test",
      ttlSeconds: 300,
    });

    if (duplicate.claimed || duplicate.record.id !== first.record.id) {
      throw new Error("Duplicate claim was not rejected atomically.");
    }

    const completed = await completeIdempotency(key, {
      test: true,
      value: 123,
    });

    if (completed.status !== "COMPLETED" || completed.response === null) {
      throw new Error("Completion state was not persisted.");
    }

    const completedAgain = await claimIdempotency({
      key,
      tenantId: "tenant-test",
      operation: "TEST_OPERATION",
      resourceId: "resource-test",
      ttlSeconds: 300,
    });

    if (completedAgain.claimed || completedAgain.record.status !== "COMPLETED") {
      throw new Error("Completed operation was claimed again.");
    }

    const failedClaim = await claimIdempotency({
      key: failedKey,
      tenantId: "tenant-test",
      operation: "TEST_OPERATION",
      ttlSeconds: 300,
    });

    if (!failedClaim.claimed || failedClaim.record.status !== "IN_PROGRESS") {
      throw new Error("Failed-operation initial claim failed.");
    }

    const failed = await failIdempotency(failedKey, "test failure");

    if (failed.status !== "FAILED" || failed.errorMessage !== "test failure") {
      throw new Error("Failure state was not persisted.");
    }

    const failedAgain = await claimIdempotency({
      key: failedKey,
      tenantId: "tenant-test",
      operation: "TEST_OPERATION",
      ttlSeconds: 300,
    });

    if (failedAgain.claimed || failedAgain.record.status !== "FAILED") {
      throw new Error("Failed operation was unexpectedly claimed again.");
    }

    const stored = await getIdempotencyRecord(key);

    if (!stored || stored.status !== "COMPLETED") {
      throw new Error("Stored record could not be read.");
    }

    console.log("65 idempotency state store: OK");
    console.log(
      JSON.stringify(
        {
          success: true,
          tests: [
            "atomic-create",
            "duplicate-read",
            "completed-state",
            "failed-state",
            "persistent-read",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.idempotencyRecord.deleteMany({
      where: {
        key: {
          startsWith: prefix,
        },
      },
    });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
