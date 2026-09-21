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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { claimIdempotency, completeIdempotency } = await import("../src/lib/idempotency/store");

  const tenantId = `concurrent-duplicate-test-${Date.now()}-${Math.random()}`;
  const operation = "CONCURRENT_DUPLICATE_TEST";
  const key = `smartdirect:test:concurrent-duplicate:${tenantId}`;
  const requestCount = 50;

  let executionCount = 0;

  const results = await Promise.all(
    Array.from({ length: requestCount }, async (_, index) => {
      await sleep(index % 7);

      const claim = await claimIdempotency({
        key,
        tenantId,
        operation,
        ttlSeconds: 60,
      });

      if (!claim.claimed) {
        return {
          index,
          claimed: false,
          executed: false,
        };
      }

      executionCount += 1;

      // Simulate a real execution that remains in progress while duplicates arrive.
      await sleep(25);

      return {
        index,
        claimed: true,
        executed: true,
      };
    }),
  );

  const claimedCount = results.filter((result) => result.claimed).length;
  const executedCount = results.filter((result) => result.executed).length;

  if (claimedCount !== 1 || executedCount !== 1 || executionCount !== 1) {
    throw new Error(
      `Concurrent execution guard failed: claimed=${claimedCount}, executed=${executedCount}, handlerExecutions=${executionCount}.`,
    );
  }

  const recordBeforeComplete = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (!recordBeforeComplete || recordBeforeComplete.status !== "IN_PROGRESS") {
    throw new Error("The single execution owner did not remain IN_PROGRESS during execution.");
  }

  const completed = await completeIdempotency(key, {
    execution: "concurrent-duplicate-test",
    accepted: true,
  });

  if (completed.status !== "COMPLETED") {
    throw new Error("The single execution owner did not complete successfully.");
  }

  const recordCount = await prisma.idempotencyRecord.count({
    where: {
      tenantId,
      operation,
    },
  });

  if (recordCount !== 1) {
    throw new Error(`Expected exactly one idempotency record, found ${recordCount}.`);
  }

  const afterCompletion = await claimIdempotency({
    key,
    tenantId,
    operation,
    ttlSeconds: 60,
  });

  if (afterCompletion.claimed || afterCompletion.record.status !== "COMPLETED") {
    throw new Error("A concurrent duplicate was allowed after completion.");
  }

  await prisma.idempotencyRecord.deleteMany({
    where: { tenantId },
  });

  console.log("73 concurrent duplicate request test: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "50-concurrent-identical-requests",
          "single-execution-owner",
          "duplicate-during-in-progress-block",
          "single-idempotency-record",
          "duplicate-after-completion-block",
        ],
        requestCount,
        claimedCount,
        executedCount,
        handlerExecutions: executionCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("73 concurrent duplicate request test: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
