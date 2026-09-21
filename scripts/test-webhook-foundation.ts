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
  const {
    getInstagramWebhookEventId,
    normalizeInstagramCommentEvent,
    normalizeInstagramMessagingEvent,
    normalizeInstagramWebhookEvent,
  } = await import("../src/lib/webhook/normalize");

  const accountId = "instagram-account-test";

  const messaging = {
    sender: { id: "customer-1" },
    recipient: { id: "business-1" },
    timestamp: 123,
    message: {
      mid: "mid.123",
      text: "hello",
    },
  };

  const messagingRetry = structuredClone(messaging);

  const normalizedMessage = normalizeInstagramMessagingEvent(
    messaging,
    accountId,
  );

  const normalizedRetry = normalizeInstagramWebhookEvent({
    type: "MESSAGING",
    event: messagingRetry,
    accountId,
  });

  if (normalizedMessage.eventId !== "mid.123") {
    throw new Error("Messaging event ID was not extracted from message.mid.");
  }

  if (normalizedRetry.eventId !== normalizedMessage.eventId) {
    throw new Error("Identical messaging retries did not normalize to the same event ID.");
  }

  if (normalizedMessage.type !== "MESSAGING") {
    throw new Error("Messaging event type was not normalized.");
  }

  const comment = {
    id: "comment-123",
    media: { id: "media-123" },
    from: { id: "customer-1", username: "customer" },
    text: "1",
  };

  const normalizedComment = normalizeInstagramCommentEvent(
    comment,
    accountId,
  );

  if (normalizedComment.eventId !== "comment-123") {
    throw new Error("Comment event ID was not extracted from comment.id.");
  }

  if (normalizedComment.type !== "COMMENT") {
    throw new Error("Comment event type was not normalized.");
  }

  const postback = {
    sender: { id: "customer-1" },
    recipient: { id: "business-1" },
    postback: {
      mid: "postback-mid-1",
      payload: "TEST_PAYLOAD",
    },
  };

  if (getInstagramWebhookEventId(postback) !== "postback-mid-1") {
    throw new Error("Postback event ID was not extracted from postback.mid.");
  }

  const fallbackA = {
    sender: { id: "customer-1" },
    message: { text: "same payload" },
  };

  const fallbackB = structuredClone(fallbackA);

  const fallbackIdA = getInstagramWebhookEventId(fallbackA);
  const fallbackIdB = getInstagramWebhookEventId(fallbackB);

  if (!fallbackIdA.startsWith("fingerprint:")) {
    throw new Error("Fallback webhook event ID is not fingerprint-based.");
  }

  if (fallbackIdA !== fallbackIdB) {
    throw new Error("Equivalent fallback events did not produce the same fingerprint.");
  }

  if (normalizedMessage.accountId !== accountId) {
    throw new Error("Normalized event did not preserve account scope.");
  }

  if (normalizedMessage.rawEvent !== messaging) {
    throw new Error("Normalized event did not preserve the raw event.");
  }

  console.log("83-86 Webhook foundation: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: [
          "architecture-normalization-boundary",
          "messaging-event-normalization",
          "comment-event-normalization",
          "messaging-event-id",
          "comment-event-id",
          "postback-event-id",
          "fingerprint-fallback",
          "duplicate-event-id-stability",
          "account-scope-preserved",
          "raw-event-preserved",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("83-86 Webhook foundation: FAILED");
  console.error(error);
  process.exitCode = 1;
});
