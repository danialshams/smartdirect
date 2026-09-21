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
  const { claimIdempotency, completeIdempotency } = await import("../src/lib/idempotency/store");

  const tenantId = `duplicate-request-test-${Date.now()}-${Math.random()}`;
  const operation = "DUPLICATE_REQUEST_TEST";
  const key = `smartdirect:test:duplicate-request:${tenantId}`;

  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      claimIdempotency({
        key,
        tenantId,
        operation,
        ttlSeconds: 60,
      }),
    ),
  );

  const claimedCount = results.filter((result) => result.claimed).length;
  const duplicateCount = results.filter((result) => !result.claimed).length;

  if (claimedCount !== 1 || duplicateCount !== 9) {
    throw new Error(
      `Expected exactly 1 claim and 9 duplicates, got ${claimedCount} claims and ${duplicateCount} duplicates.`,
    );
  }

  const completed = await completeIdempotency(key, {
    request: "duplicate-request-test",
    accepted: true,
  });

  if (completed.status !== "COMPLETED") {
    throw new Error("Winning request did not complete.");
  }

  const afterCompletion = await claimIdempotency({
    key,
    tenantId,
    operation,
    ttlSeconds: 60,
  });

  if (afterCompletion.claimed || afterCompletion.record.status !== "COMPLETED") {
    throw new Error("Duplicate request was allowed after completion.");
  }

  await prisma.idempotencyRecord.deleteMany({
    where: { tenantId },
  });

  console.log("72 duplicate request test: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "10-concurrent-identical-requests",
          "single-request-claim",
          "nine-duplicate-blocks",
          "completed-request-duplicate-block",
        ],
        claimedCount,
        duplicateCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("72 duplicate request test: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
