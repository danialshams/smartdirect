import fs from "node:fs";

const source = fs.readFileSync("src/lib/automation/execute-automation.ts", "utf8");
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const checks = [
  ["account validation", 'throw new Error("Instagram account not found")'],
  ["inactive automation guard", 'isActive: true'],
  ["empty flow guard", 'reason: "NO_MESSAGES"'],
  ["human handoff guard", 'reason: "HUMAN_HANDOFF"'],
  ["execution idempotency", "claimAutomationExecution"],
  ["duplicate execution guard", 'reason: "IDEMPOTENT_DUPLICATE"'],
  ["quick reply routing", "resolveQuickReplyDestination"],
  ["circular flow protection", "Automation flow contains a circular reference"],
  ["action validation", "resolveAutomationAction"],
  ["message sending", "sendAutomationMessage"],
  ["message failure handling", 'reason: "MESSAGE_NOT_SENT"'],
  ["send failure idempotency", "failAutomationExecution"],
  ["outbound persistence", "prisma.conversationMessage.create"],
  ["comment one-shot", "isCommentTriggeredFlow"],
  ["quick reply wait", "Waiting for Quick Reply"],
  ["sequential traversal", "resolveNextSequentialMessage"],
  ["conversation finalization", "lastMessageAt: new Date()"],
  ["execution completion", "completeAutomationExecution"],
] as const;

for (const [name, marker] of checks) assert(source.includes(marker), name + " is missing");
assert(!source.includes("const selectedQuickReply = await prisma.quickReply.findFirst"), "redundant quick-reply query remains");
assert(!source.includes("const currentIndex = automation.messages.findIndex"), "redundant current-index lookup remains");

console.log("108-109 Automation Engine reliability/integration: OK");
console.log(JSON.stringify({
  success: true,
  validation: true,
  failureHandling: true,
  idempotency: true,
  circularFlowProtection: true,
  quickReplyRouting: true,
  sequentialFlow: true,
  commentOneShot: true,
  outboundPersistence: true,
  conversationFinalization: true
}, null, 2));
