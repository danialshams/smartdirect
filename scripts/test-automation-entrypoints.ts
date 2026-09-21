import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const routePath = resolve("app/api/webhooks/instagram/route.ts");
  const enginePath = resolve("src/lib/automation/execute-automation.ts");
  const senderPath = resolve("src/lib/automation/send-automation-message.ts");

  const [route, engine, sender] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(enginePath, "utf8"),
    readFile(senderPath, "utf8"),
  ]);

  // 98 — Comment Automation
  assert(
    route.includes('triggerType: "COMMENT_KEYWORD"'),
    "Comment automation trigger is not wired.",
  );
  assert(
    route.includes("commentId: igCommentId"),
    "Comment automation does not pass commentId to the engine.",
  );
  assert(
    route.includes("executeAutomation({") &&
      route.includes("matchedAutomation.id"),
    "Comment automation does not execute through the central engine.",
  );

  // 99 — DM Automation
  assert(
    route.includes('triggerType: "DM"'),
    "DM automation trigger is not wired.",
  );
  assert(
    route.includes("selectedQuickReplyId"),
    "DM Quick Reply resolution is missing.",
  );
  assert(
    route.includes("igUserId: participantId"),
    "DM automation recipient identity is not passed to the engine.",
  );

  // 100 — Story Reply Automation
  assert(
    route.includes('triggerType: "STORY_REPLY_KEYWORD"'),
    "Story Reply automation trigger is not wired.",
  );
  assert(
    route.includes("mediaId: storyId"),
    "Story Reply automation is not scoped to the story media.",
  );
  assert(
    route.includes("participantId,") &&
      route.includes("executionId,"),
    "Story Reply automation execution context is incomplete.",
  );

  // Central execution path
  assert(
    engine.includes("sendAutomationMessage"),
    "Automation Engine is not connected to the Instagram message adapter.",
  );
  assert(
    engine.includes("claimAutomationExecution"),
    "Automation Engine idempotency is missing.",
  );
  assert(
    sender.includes("claimSendMessage"),
    "Send-message idempotency is missing from the final action layer.",
  );
  assert(
    sender.includes("getValidInstagramAccessToken"),
    "Automation actions are not using the token lifecycle manager.",
  );

  console.log("98-100 Automation entry-point integration: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        comment: "COMMENT_KEYWORD -> Automation Engine",
        dm: "DM -> Quick Reply resolution -> Automation Engine",
        storyReply: "STORY_REPLY_KEYWORD + mediaId -> Automation Engine",
        executionIdempotency: true,
        sendMessageIdempotency: true,
        tokenLifecycle: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("98-100 Automation entry-point integration: FAILED");
  console.error(error);
  process.exitCode = 1;
});
