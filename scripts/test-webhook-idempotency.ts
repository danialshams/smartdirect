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
  const {
    claimInstagramWebhookEvent,
    completeInstagramWebhookEvent,
    getInstagramWebhookEventId,
  } = await import("../src/lib/idempotency/webhook");
  const { prisma } = await import("../src/lib/prisma");

  const testId = randomUUID();
  const accountA = `webhook-idempotency-account-a:${testId}`;
  const accountB = `webhook-idempotency-account-b:${testId}`;

  const messageEvent = {
    sender: { id: "1611287987285879" },
    recipient: { id: "17841434583842416" },
    timestamp: 1758440000000,
    message: {
      mid: `mid-${testId}`,
      text: "1",
    },
  };

  const commentEvent = {
    id: `comment-${testId}`,
    media: { id: "media-test" },
    from: { id: "1611287987285879", username: "test-user" },
    text: "1",
  };

  try {
    const messageEventId = getInstagramWebhookEventId(messageEvent);

    if (messageEventId !== `mid-${testId}`) {
      throw new Error("Messaging event ID resolver did not prefer message.mid.");
    }

    const [first, duplicateInProgress] = await Promise.all([
      claimInstagramWebhookEvent({
        instagramAccountId: accountA,
        event: messageEvent,
        eventType: "MESSAGING",
      }),
      claimInstagramWebhookEvent({
        instagramAccountId: accountA,
        event: messageEvent,
        eventType: "MESSAGING",
      }),
    ]);

    const concurrentClaims = [first.claimed, duplicateInProgress.claimed].filter(
      Boolean,
    ).length;

    if (concurrentClaims !== 1) {
      throw new Error(
        `Expected exactly one concurrent webhook claim, got ${concurrentClaims}.`,
      );
    }

    await completeInstagramWebhookEvent(first.key);

    const duplicateCompleted = await claimInstagramWebhookEvent({
      instagramAccountId: accountA,
      event: messageEvent,
      eventType: "MESSAGING",
    });

    if (duplicateCompleted.claimed) {
      throw new Error("Completed duplicate messaging event was claimed.");
    }

    const differentEvent = await claimInstagramWebhookEvent({
      instagramAccountId: accountA,
      event: {
        ...messageEvent,
        message: {
          mid: `mid-different-${testId}`,
          text: "2",
        },
      },
      eventType: "MESSAGING",
    });

    if (!differentEvent.claimed) {
      throw new Error("Different messaging event was incorrectly deduplicated.");
    }

    const differentAccount = await claimInstagramWebhookEvent({
      instagramAccountId: accountB,
      event: messageEvent,
      eventType: "MESSAGING",
    });

    if (!differentAccount.claimed) {
      throw new Error("Webhook event leaked across Instagram accounts.");
    }

    const comment = await claimInstagramWebhookEvent({
      instagramAccountId: accountA,
      event: commentEvent,
      eventType: "COMMENT",
    });

    if (!comment.claimed || comment.eventId !== commentEvent.id) {
      throw new Error("Comment webhook event ID/idempotency failed.");
    }

    const commentDuplicate = await claimInstagramWebhookEvent({
      instagramAccountId: accountA,
      event: commentEvent,
      eventType: "COMMENT",
    });

    if (commentDuplicate.claimed) {
      throw new Error("Duplicate comment webhook event was claimed.");
    }

    console.log("67 webhook idempotency: OK");
    console.log(
      JSON.stringify(
        {
          success: true,
          tests: [
            "event-id-resolution",
            "concurrent-duplicate-claim",
            "completed-duplicate-skip",
            "different-event-isolation",
            "account-isolation",
            "comment-idempotency",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.idempotencyRecord.deleteMany({
      where: {
        tenantId: {
          in: [accountA, accountB],
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
