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
  const { prisma } = await import("../src/lib/prisma");
  const {
    claimIdempotency,
    completeIdempotency,
    failIdempotency,
    getIdempotencyExecutionState,
  } = await import("../src/lib/idempotency/store");

  const tenantId = `semantics-test-${Date.now()}-${Math.random()}`;
  const key = `smartdirect:test:semantics:${tenantId}`;

  const claimed = await claimIdempotency({
    key,
    tenantId,
    operation: "SEMANTICS_TEST",
    ttlSeconds: 60,
  });

  if (!claimed.claimed || getIdempotencyExecutionState(claimed.record) !== "IN_PROGRESS") {
    throw new Error("Initial claim did not create IN_PROGRESS state");
  }

  const duplicateInProgress = await claimIdempotency({
    key,
    tenantId,
    operation: "SEMANTICS_TEST",
    ttlSeconds: 60,
  });

  if (duplicateInProgress.claimed || getIdempotencyExecutionState(duplicateInProgress.record) !== "IN_PROGRESS") {
    throw new Error("IN_PROGRESS duplicate semantics failed");
  }

  const completed = await completeIdempotency(key, { result: "ok" });

  if (
    getIdempotencyExecutionState(completed) !== "COMPLETED" ||
    completed.response === null ||
    completed.errorMessage !== null ||
    completed.completedAt === null
  ) {
    throw new Error("COMPLETED semantics failed");
  }

  const duplicateCompleted = await claimIdempotency({
    key,
    tenantId,
    operation: "SEMANTICS_TEST",
    ttlSeconds: 60,
  });

  if (duplicateCompleted.claimed || getIdempotencyExecutionState(duplicateCompleted.record) !== "COMPLETED") {
    throw new Error("COMPLETED duplicate semantics failed");
  }

  const failedKey = `${key}:failed`;

  const failedClaim = await claimIdempotency({
    key: failedKey,
    tenantId,
    operation: "SEMANTICS_TEST",
    ttlSeconds: 60,
  });

  const failed = await failIdempotency(failedKey, "simulated failure");

  if (
    !failedClaim.claimed ||
    getIdempotencyExecutionState(failed) !== "FAILED" ||
    failed.errorMessage !== "simulated failure"
  ) {
    throw new Error("FAILED semantics failed");
  }

  const duplicateFailed = await claimIdempotency({
    key: failedKey,
    tenantId,
    operation: "SEMANTICS_TEST",
    ttlSeconds: 60,
  });

  if (duplicateFailed.claimed || getIdempotencyExecutionState(duplicateFailed.record) !== "FAILED") {
    throw new Error("FAILED duplicate semantics failed");
  }

  const expiredKey = `${key}:expired`;

  await prisma.idempotencyRecord.create({
    data: {
      key: expiredKey,
      tenantId,
      operation: "SEMANTICS_TEST",
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() - 1000),
    },
  });

  const reclaimed = await claimIdempotency({
    key: expiredKey,
    tenantId,
    operation: "SEMANTICS_TEST",
    ttlSeconds: 60,
  });

  if (!reclaimed.claimed || getIdempotencyExecutionState(reclaimed.record) !== "IN_PROGRESS") {
    throw new Error("Expired IN_PROGRESS record was not safely reclaimed");
  }

  await prisma.idempotencyRecord.deleteMany({
    where: { tenantId },
  });

  console.log("71 idempotency execution semantics: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "IN_PROGRESS-state",
          "COMPLETED-state",
          "FAILED-state",
          "completed-duplicate-block",
          "failed-duplicate-block",
          "expired-in-progress-reclaim",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("71 idempotency execution semantics: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
