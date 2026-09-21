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
    claimAutomationExecution,
    completeAutomationExecution,
  } = await import("../src/lib/idempotency/automation");

  const tenantId = `automation-test-tenant-${Date.now()}-${Math.random()}`;
  const automationId = "automation-test";
  const executionId = `execution-${Date.now()}-${Math.random()}`;
  const otherExecutionId = `${executionId}-other`;

  const first = await Promise.all([
    claimAutomationExecution({
      instagramAccountId: tenantId,
      automationId,
      executionId,
    }),
    claimAutomationExecution({
      instagramAccountId: tenantId,
      automationId,
      executionId,
    }),
  ]);

  const claimedCount = first.filter((result) => result.claimed).length;

  if (claimedCount !== 1) {
    throw new Error(`Expected exactly one concurrent claim, got ${claimedCount}`);
  }

  const key = first.find((result) => result.claimed)!.key;

  const duplicateWhileInProgress = await claimAutomationExecution({
    instagramAccountId: tenantId,
    automationId,
    executionId,
  });

  if (duplicateWhileInProgress.claimed) {
    throw new Error("Duplicate execution claimed while original is in progress");
  }

  await completeAutomationExecution(key, {
    processed: true,
  });

  const duplicateAfterCompletion = await claimAutomationExecution({
    instagramAccountId: tenantId,
    automationId,
    executionId,
  });

  if (duplicateAfterCompletion.claimed) {
    throw new Error("Completed duplicate execution was claimed");
  }

  const differentExecution = await claimAutomationExecution({
    instagramAccountId: tenantId,
    automationId,
    executionId: otherExecutionId,
  });

  if (!differentExecution.claimed) {
    throw new Error("Different execution ID was incorrectly deduplicated");
  }

  await prisma.idempotencyRecord.deleteMany({
    where: { tenantId },
  });

  console.log("68 automation idempotency: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "concurrent-duplicate-claim",
          "in-progress-duplicate-skip",
          "completed-duplicate-skip",
          "different-execution-isolation",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("68 automation idempotency: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
