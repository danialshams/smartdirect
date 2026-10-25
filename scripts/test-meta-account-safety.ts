import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  applyInboundAutomationPreference,
  automatedMessageBlockReason,
  getAutomatedMessageBlockReason,
  getInboundAutomationPreference,
  reserveRecipientAutomatedMessageBudget,
} from "../src/lib/instagram/automated-message-policy";

async function main() {
  assert.equal(getInboundAutomationPreference("STOP"), "STOP");
  assert.equal(getInboundAutomationPreference("دیگه پیام نده"), "STOP");
  assert.equal(getInboundAutomationPreference("توقف پیام‌های خودکار"), "STOP");
  assert.equal(getInboundAutomationPreference("start"), "START");
  assert.equal(getInboundAutomationPreference("فعال‌سازی پاسخ خودکار"), "START");
  assert.equal(getInboundAutomationPreference("قیمت"), null);
  const now = new Date("2026-10-26T12:00:00Z");
  const recent = new Date(now.getTime() - 60 * 60 * 1000);
  const expired = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  assert.equal(automatedMessageBlockReason({ active: true, lastInboundAt: recent, isPrivateReply: false, now }), null);
  assert.equal(automatedMessageBlockReason({ active: true, lastInboundAt: expired, isPrivateReply: false, now }), "INSTAGRAM_24H_WINDOW_CLOSED");
  assert.equal(automatedMessageBlockReason({ active: true, lastInboundAt: null, isPrivateReply: false, now }), "NO_INBOUND_MESSAGE");
  assert.equal(automatedMessageBlockReason({ active: true, lastInboundAt: null, isPrivateReply: true, now }), null);
  assert.equal(automatedMessageBlockReason({ active: false, lastInboundAt: recent, isPrivateReply: true, now }), "OPTED_OUT");
  const previousAgent = process.env.INSTAGRAM_HUMAN_AGENT_ENABLED;
  process.env.INSTAGRAM_HUMAN_AGENT_ENABLED = "true";
  try {
    assert.equal(automatedMessageBlockReason({ active: true, lastInboundAt: expired, isPrivateReply: false, now }),
      "INSTAGRAM_24H_WINDOW_CLOSED", "Automations must never use HUMAN_AGENT exception");
  } finally {
    if (previousAgent === undefined) delete process.env.INSTAGRAM_HUMAN_AGENT_ENABLED;
    else process.env.INSTAGRAM_HUMAN_AGENT_ENABLED = previousAgent;
  }

  const webhook = readFileSync("app/api/webhooks/instagram/route.ts", "utf8");
  const sender = readFileSync("src/lib/automation/send-automation-message.ts", "utf8");
  const engine = readFileSync("src/lib/automation/execute-automation.ts", "utf8");
  const inbox = readFileSync("app/api/instagram/inbox/route.ts", "utf8");
  const client = readFileSync("src/lib/instagram/client.ts", "utf8");
  const token = readFileSync("src/lib/instagram/token-manager.ts", "utf8");
  const commentFollowGate = webhook.slice(
    webhook.indexOf("FOLLOW GATE ENABLED FOR COMMENT AUTOMATION"),
    webhook.indexOf("// Normal Comment Automation"),
  );
  assert(commentFollowGate.includes("pendingGate.attempts > 0 ? false : await sendPrivateReply({") &&
    !commentFollowGate.includes("await sendFollowGateMessage({"),
    "Comment follow-gate must send just one eligible Private Reply, not cold DM");
  assert(webhook.includes("FOLLOW_GATE_PAYLOAD_PREFIX + gate.id") &&
    webhook.includes('source: "UNKNOWN_POSTBACK"'),
    "Follow-up must be resumed only after an explicit, persisted inbound DM or postback");
  assert((webhook.match(/applyInboundAutomationPreference\(conversation\.id, messageText\)/g) || []).length === 2,
    "Normal inbound DMs and Story replies must respect STOP and START");
  assert(engine.includes('if (policyBlock) return {') &&
    !engine.includes("update: {\n      isActive: true,\n      igUserId: input.igUserId"),
    "Automation engine must not resurrect opted-out conversations or trigger stale flows");
  assert(sender.includes("getAutomatedMessageBlockReason({") &&
    sender.includes("reserveRecipientAutomatedMessageBudget({") &&
    sender.includes("RECIPIENT_AUTOMATION_BUDGET_EXCEEDED"),
    "Shared sender must enforce recipient opt-out, window and burst protection");
  assert(inbox.includes('action !== "mark_seen" && !conversation.isActive'),
    "Inbox manual send should respect opted-out recipients");
  assert(client.includes('"client_secret", "appsecret_proof", "code"') &&
    client.includes("paramNames: Object.keys(params).sort()"),
    "Never leak OAuth secrets or auth codes in Graph debug/error logs");
  assert(!token.includes('"[Instagram Token] Meta did not return a valid expires_in:",\n      data,') &&
    !token.includes("instagramAccountId,\n        data,\n      },"),
    "Token response bodies must not be logged on invalid Meta expiry");
  assert(readFileSync("src/lib/automation/smart-reminder-policy.ts", "utf8").includes('window.mode === "STANDARD"'),
    "Human-agent message exception must never be used for automated reminders");

  const uid = randomUUID();
  const user = await prisma.user.create({ data: {
    email: "meta-safety-" + uid + "@example.invalid", name: "Meta Safety Test", password: "test-only",
  } });
  try {
    const account = await prisma.instagramAccount.create({ data: {
      userId: user.id, igUserId: "meta-safety-" + uid, igUsername: "safety_" + uid.slice(0, 8),
      accessToken: "test-only", isConnected: true,
    } });
    const participantId = "meta-recipient-" + uid;
    const conversation = await prisma.conversation.create({ data: {
      userId: user.id, instagramAccountId: account.id, igUserId: participantId,
      participantId, isActive: true,
    } });
    const check = (isPrivateReply = false) => getAutomatedMessageBlockReason({
      instagramAccountId: account.id, participantId, isPrivateReply,
    });
    assert.equal(await check(), "NO_INBOUND_MESSAGE");
    assert.equal(await check(true), null);
    await prisma.conversationMessage.create({ data: {
      conversationId: conversation.id, direction: "INBOUND",
      messageType: "TEXT", text: "سلام",
    } });
    assert.equal(await check(), null);
    assert.equal(await applyInboundAutomationPreference(conversation.id, "STOP"), true);
    assert.equal(await check(), "OPTED_OUT");
    assert.equal(await check(true), "OPTED_OUT");
    assert.equal(await applyInboundAutomationPreference(conversation.id, "سلام"), false);
    assert.equal(await check(), "OPTED_OUT");
    assert.equal(await applyInboundAutomationPreference(conversation.id, "/start"), true);
    assert.equal(await check(), null);
    assert.equal(await getAutomatedMessageBlockReason({
      instagramAccountId: "unrelated-account", participantId, isPrivateReply: true,
    }), null, "Opt-out must never leak across accounts");
    for (let n = 0; n < 20; n++) {
      assert.equal(await reserveRecipientAutomatedMessageBudget({ instagramAccountId: account.id, participantId }), true);
    }
    assert.equal(await reserveRecipientAutomatedMessageBudget({ instagramAccountId: account.id, participantId }), false,
      "The 21st automated message to a recipient within 10 minutes must be blocked");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
  console.log("META_ACCOUNT_SAFETY_GUARDRAILS_OK");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
