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
    claimPublishingExecution,
    completePublishingExecution,
  } = await import("../src/lib/idempotency/publishing");

  const accountId = `publishing-test-account-${Date.now()}-${Math.random()}`;
  const jobId = "publishing-test-job";

  const first = await Promise.all([
    claimPublishingExecution({
      instagramAccountId: accountId,
      publishingJobId: jobId,
    }),
    claimPublishingExecution({
      instagramAccountId: accountId,
      publishingJobId: jobId,
    }),
  ]);

  const claimedCount = first.filter((result) => result.claimed).length;

  if (claimedCount !== 1) {
    throw new Error(`Expected exactly one concurrent publish claim, got ${claimedCount}`);
  }

  const key = first.find((result) => result.claimed)!.key;

  const duplicateWhileInProgress = await claimPublishingExecution({
    instagramAccountId: accountId,
    publishingJobId: jobId,
  });

  if (duplicateWhileInProgress.claimed) {
    throw new Error("Duplicate publish claimed while original is in progress");
  }

  await completePublishingExecution(key, {
    publishingJobId: jobId,
  });

  const duplicateAfterCompletion = await claimPublishingExecution({
    instagramAccountId: accountId,
    publishingJobId: jobId,
  });

  if (duplicateAfterCompletion.claimed) {
    throw new Error("Completed duplicate publish was claimed");
  }

  const differentJob = await claimPublishingExecution({
    instagramAccountId: accountId,
    publishingJobId: `${jobId}-other`,
  });

  if (!differentJob.claimed) {
    throw new Error("Different publishing job was incorrectly deduplicated");
  }

  await completePublishingExecution(differentJob.key, {
    publishingJobId: `${jobId}-other`,
  });

  await prisma.idempotencyRecord.deleteMany({
    where: { tenantId: accountId },
  });

  console.log("70 publishing idempotency: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "concurrent-duplicate-publish",
          "in-progress-duplicate-skip",
          "completed-duplicate-skip",
          "publishing-job-isolation",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("70 publishing idempotency: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
