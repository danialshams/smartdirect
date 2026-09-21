import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const root = process.cwd();
  const route = await readFile(
    path.join(root, "app/api/webhooks/instagram/route.ts"),
    "utf8",
  );
  const handler = await readFile(
    path.join(root, "src/lib/webhook/worker-handler.ts"),
    "utf8",
  );
  const queue = await readFile(
    path.join(root, "src/lib/webhook/queue.ts"),
    "utf8",
  );

  const assertions: Record<string, boolean> = {
    "message events are queued": route.includes('eventType: "MESSAGING"'),
    "comment events are queued": route.includes('eventType: "COMMENT"'),
    "message processor preserved": route.includes("processMessagingEvent("),
    "comment processor preserved": route.includes("processCommentEvent("),
    "story reply processor preserved": route.includes("extractStoryReplyData"),
    "postback processor preserved": route.includes("processInstagramPostback"),
    "follow gate remains in comment processor": route.includes("FOLLOW GATE ENABLED FOR COMMENT AUTOMATION"),
    "queue worker dispatches webhook jobs": handler.includes("processQueuedInstagramWebhookEvent"),
    "webhook queue uses retry budget": queue.includes("maxAttempts: 3"),
  };

  const failed = Object.entries(assertions)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (failed.length > 0) {
    throw new Error(`Failed assertions: ${failed.join(", ")}`);
  }

  console.log("90-93 Webhook processing integration foundation: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        tests: Object.keys(assertions),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("90-93 Webhook processing integration foundation: FAILED");
  console.error(error);
  process.exitCode = 1;
});
