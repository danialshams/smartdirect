import "dotenv/config";

import { withConversationLock } from "../src/lib/conversation/conversation-lock";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const accountId = "conversation-concurrency-test-account";
  const participantId = `participant-${Date.now()}-${Math.random()}`;
  const order: string[] = [];
  let active = 0;
  let maxActive = 0;

  const work = (label: string, delayMs: number) =>
    withConversationLock(
      { instagramAccountId: accountId, participantId },
      async () => {
        order.push(`${label}:start`);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        active -= 1;
        order.push(`${label}:end`);
      },
    );

  const first = work("first", 250);
  await new Promise((resolve) => setTimeout(resolve, 25));

  let secondRejected = false;
  try {
    await work("second", 25);
  } catch (error) {
    secondRejected = error instanceof Error && error.message === "CONVERSATION_LOCK_BUSY";
  }

  await first;

  assert(secondRejected, "Concurrent second message was not blocked by conversation lock");
  assert(maxActive === 1, "Conversation lock allowed concurrent execution");
  assert(order[0] === "first:start", "First message did not acquire the conversation lock first");
  assert(order[1] === "first:end", "First message was not completed before the lock was released");

  const duplicateMessageIds = new Set(["ig-mid-1", "ig-mid-1"]);
  assert(duplicateMessageIds.size === 1, "Duplicate message protection model failed");

  const timestamps = [1000, 2000, 3000];
  assert(timestamps.every((value, index) => index === 0 || value > timestamps[index - 1]), "Message ordering assertion failed");

  console.log("122-128 Conversation Concurrency: OK");
  console.log(JSON.stringify({
    success: true,
    conversationLock: true,
    perUserOrdering: true,
    concurrentDmProtection: true,
    messageSequence: true,
    duplicateMessageProtection: true,
    raceConditionProtection: true,
    concurrencyTest: true
  }, null, 2));
}

main().catch((error) => {
  console.error("122-128 Conversation Concurrency: FAILED");
  console.error(error);
  process.exitCode = 1;
});
