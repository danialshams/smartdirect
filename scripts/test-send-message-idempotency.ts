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
    claimSendMessage,
    completeSendMessage,
  } = await import("../src/lib/idempotency/send-message");

  const tenantId = `send-message-test-tenant-${Date.now()}-${Math.random()}`;
  const messageId = "message-test";
  const executionId = `execution-${Date.now()}-${Math.random()}`;

  const first = await Promise.all([
    claimSendMessage({
      instagramAccountId: tenantId,
      messageId,
      executionId,
    }),
    claimSendMessage({
      instagramAccountId: tenantId,
      messageId,
      executionId,
    }),
  ]);

  const claimedCount = first.filter((result) => result.claimed).length;

  if (claimedCount !== 1) {
    throw new Error(`Expected exactly one concurrent send claim, got ${claimedCount}`);
  }

  const key = first.find((result) => result.claimed)!.key;

  const duplicateWhileInProgress = await claimSendMessage({
    instagramAccountId: tenantId,
    messageId,
    executionId,
  });

  if (duplicateWhileInProgress.claimed) {
    throw new Error("Duplicate send claimed while original is in progress");
  }

  await completeSendMessage(key, {
    messageId,
  });

  const duplicateAfterCompletion = await claimSendMessage({
    instagramAccountId: tenantId,
    messageId,
    executionId,
  });

  if (duplicateAfterCompletion.claimed) {
    throw new Error("Completed duplicate send was claimed");
  }

  const differentMessage = await claimSendMessage({
    instagramAccountId: tenantId,
    messageId: `${messageId}-other`,
    executionId,
  });

  if (!differentMessage.claimed) {
    throw new Error("Different message was incorrectly deduplicated");
  }

  await completeSendMessage(differentMessage.key, {
    messageId: `${messageId}-other`,
  });

  await prisma.idempotencyRecord.deleteMany({
    where: { tenantId },
  });

  console.log("69 send message idempotency: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "concurrent-duplicate-send",
          "in-progress-duplicate-skip",
          "completed-duplicate-skip",
          "message-isolation",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("69 send message idempotency: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
