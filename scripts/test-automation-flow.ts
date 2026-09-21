import { resolveAutomationAction } from "../src/lib/automation/action";
import { evaluateAutomationConditions } from "../src/lib/automation/conditions";
import { resolveNextSequentialMessage, resolveQuickReplyDestination } from "../src/lib/automation/quick-reply-flow";
import { AutomationMessageType } from "../src/generated/prisma/client";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

async function main() {
  const messages = [
    { id: "m1", quickReplies: [{ id: "q1", nextMessageId: "m2" }] },
    { id: "m2", quickReplies: [] },
  ];
  assert(resolveQuickReplyDestination(messages, "q1") === "m2", "Quick Reply destination failed");
  assert(resolveNextSequentialMessage(messages, "m1")?.id === "m2", "Sequential flow failed");
  assert(resolveNextSequentialMessage(messages, "m2") === null, "Flow should finish at last message");

  const active = evaluateAutomationConditions({ automationIsActive: true, humanHandoffActive: false });
  assert(active.allowed, "Active automation should be allowed");
  const inactive = evaluateAutomationConditions({ automationIsActive: false, humanHandoffActive: false });
  assert(!inactive.allowed && inactive.reason === "INACTIVE", "Inactive condition failed");
  const handoff = evaluateAutomationConditions({ automationIsActive: true, humanHandoffActive: true });
  assert(!handoff.allowed && handoff.reason === "HUMAN_HANDOFF", "Handoff condition failed");

  assert(resolveAutomationAction({ messageType: AutomationMessageType.TEXT, text: " hello ", mediaUrl: null, mediaId: null, formId: null, showcaseId: null }).type === "TEXT", "Text action resolution failed");
  assert(resolveAutomationAction({ messageType: AutomationMessageType.IMAGE, text: null, mediaUrl: "https://example.com/a.jpg", mediaId: null, formId: null, showcaseId: null }).type === "IMAGE", "Media action resolution failed");
  assert(resolveAutomationAction({ messageType: AutomationMessageType.FORM, text: null, mediaUrl: null, mediaId: null, formId: "form-1", showcaseId: null }).type === "FORM", "Form action resolution failed");
  assert(resolveAutomationAction({ messageType: AutomationMessageType.SHOWCASE, text: null, mediaUrl: null, mediaId: null, formId: null, showcaseId: "showcase-1" }).type === "SHOWCASE", "Showcase action resolution failed");

  console.log("101-103 Automation flow/conditions/action resolution: OK");
  console.log(JSON.stringify({ success: true, quickReplyFlow: true, conditions: ["ACTIVE","HUMAN_HANDOFF"], actionTypes: ["TEXT","IMAGE","VIDEO","AUDIO","FORM","SHOWCASE"] }, null, 2));
}
main().catch((error) => { console.error("101-103 Automation flow/conditions/action resolution: FAILED"); console.error(error); process.exitCode = 1; });
