import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { disconnectRedis } from "../src/lib/redis/client";
import {
  AUTOMATION_STOP_QUICK_REPLY_PAYLOAD, AUTOMATION_STOP_QUICK_REPLY_TITLE,
  getInboundAutomationPreference, isManualMessagingOptedOut,
  applyInboundAutomationPreference, getAutomatedMessageBlockReason,
  claimFirstAutomationStopOption,
} from "../src/lib/instagram/automated-message-policy";

async function main() {
  assert.equal(AUTOMATION_STOP_QUICK_REPLY_TITLE, "توقف پاسخ خودکار");
  assert(AUTOMATION_STOP_QUICK_REPLY_TITLE.length <= 20);
  assert.equal(getInboundAutomationPreference(null, AUTOMATION_STOP_QUICK_REPLY_PAYLOAD), "AUTO_STOP");
  assert.equal(getInboundAutomationPreference("توقف پاسخ خودکار"), "AUTO_STOP");
  assert.equal(getInboundAutomationPreference("توقف پیام‌های خودکار"), "AUTO_STOP");
  assert.equal(getInboundAutomationPreference("فعال‌سازی پاسخ خودکار"), "AUTO_START");
  assert.equal(getInboundAutomationPreference("دیگه پیام نده"), "STOP");
  assert.equal(getInboundAutomationPreference("لغو پیام‌ها"), "STOP");
  assert.equal(getInboundAutomationPreference("/start"), "START");
  assert.equal(getInboundAutomationPreference("قیمت"), null);
  assert.equal(getInboundAutomationPreference("شاید توقف پاسخ خودکار لازم باشد"), null);

  const sender = readFileSync("src/lib/automation/send-automation-message.ts", "utf8");
  const webhook = readFileSync("app/api/webhooks/instagram/route.ts", "utf8");
  const inbox = readFileSync("app/api/instagram/inbox/route.ts", "utf8");
  assert(sender.includes("plainTextNormalDm = !payload.commentId") &&
    sender.includes("replies.length < MAX_QUICK_REPLIES") &&
    sender.includes("claimFirstAutomationStopOption(instagramAccountId, recipientId)"),
    "Only ordinary compatible text replies get first-contact STOP button; never comment Private Reply");
  assert(sender.includes("offeredReplies") && sender.includes("AUTOMATION_STOP_QUICK_REPLY_PAYLOAD"),
    "Existing user quick replies must remain intact");
  assert(webhook.includes("applyInboundAutomationPreference(conversation.id, messageText, quickReplyPayload)"),
    "The system STOP quick-reply payload must be handled without configured automation lookup");
  for (const helperName of ["sendStoryReplyMessage", "sendDirectInstagramMessage"]) {
    const helper = webhook.slice(webhook.indexOf("async function " + helperName + "("),
      webhook.indexOf("\\n}\\n", webhook.indexOf("async function " + helperName + "(")) + 2);
    assert(helper.includes("claimFirstAutomationStopOption(instagramAccountId, participantId)") &&
      helper.includes("AUTOMATION_STOP_QUICK_REPLY_PAYLOAD") &&
      helper.includes("releaseStopOption(true)") && helper.includes("releaseStopOption(false)"),
      helperName + " must offer STOP only on successful plain-text DM and release after failures");
  }
  assert(inbox.includes("isManualMessagingOptedOut(conversation.id)") &&
    !inbox.includes('action !== "mark_seen" && !conversation.isActive'),
    "Pausing bot must not block human operator's inbox reply");

  const uid = randomUUID();
  const user = await prisma.user.create({ data: {
    email: "stop-option-" + uid + "@example.invalid",
    name: "Stop quick reply test", password: "test",
  } });
  let conversationId: string | null = null;
  try {
    const account = await prisma.instagramAccount.create({ data: {
      userId: user.id, igUserId: "ig-stop-" + uid, igUsername: "stop_" + uid.slice(0, 8),
      accessToken: "test-only", isConnected: true,
    } });
    const participantId = "participant-" + uid;
    const conversation = await prisma.conversation.create({ data: {
      userId: user.id, instagramAccountId: account.id, igUserId: participantId,
      participantId, isActive: true,
    } });
    conversationId = conversation.id;
    await prisma.conversationMessage.create({ data: {
      conversationId, direction: "INBOUND", messageType: "TEXT", text: "قیمت",
    } });
    const check = () => getAutomatedMessageBlockReason({
      instagramAccountId: account.id, participantId,
    });
    assert.equal(await check(), null);
    assert.equal(await isManualMessagingOptedOut(conversationId), false);

    const releaseFailure = await claimFirstAutomationStopOption(account.id, participantId);
    assert(releaseFailure, "First eligible message must have STOP quick reply available");
    assert.equal(await claimFirstAutomationStopOption(account.id, participantId), null,
      "Two workers cannot offer the same button simultaneously");
    await releaseFailure(false);
    const releaseSuccess = await claimFirstAutomationStopOption(account.id, participantId);
    assert(releaseSuccess, "Failed Instagram send must permit another attempt");
    await releaseSuccess(true);
    assert.equal(await claimFirstAutomationStopOption(account.id, participantId), null,
      "Offer must remain recorded after completion and Redis lease release");

    assert.equal(await applyInboundAutomationPreference(
      conversationId, AUTOMATION_STOP_QUICK_REPLY_TITLE, AUTOMATION_STOP_QUICK_REPLY_PAYLOAD), true);
    assert.equal(await check(), "OPTED_OUT", "One tap pauses automated sends");
    assert.equal(await isManualMessagingOptedOut(conversationId), false,
      "Pausing robot must preserve permitted manual support responses");
    assert.equal(await applyInboundAutomationPreference(conversationId, "قیمت"), false);
    assert.equal(await check(), "OPTED_OUT", "Next inbound must not silently reset bot pause");

    assert.equal(await applyInboundAutomationPreference(conversationId, "فعال‌سازی پاسخ خودکار"), true);
    assert.equal(await check(), null);
    assert.equal(await isManualMessagingOptedOut(conversationId), false);

    assert.equal(await applyInboundAutomationPreference(conversationId, "دیگه پیام نده"), true);
    assert.equal(await isManualMessagingOptedOut(conversationId), true,
      "Explicit no-contact request blocks manual and automated outbound");
    assert.equal(await check(), "OPTED_OUT");
    assert.equal(await applyInboundAutomationPreference(conversationId, "فعال‌سازی پاسخ خودکار"), true);
    assert.equal(await check(), "OPTED_OUT",
      "Automation-only START cannot bypass an explicit full no-contact preference");
    assert.equal(await isManualMessagingOptedOut(conversationId), true);
    assert.equal(await applyInboundAutomationPreference(conversationId, "شروع مجدد پیام"), true);
    assert.equal(await check(), null);
    assert.equal(await isManualMessagingOptedOut(conversationId), false);

    const otherAccount = await prisma.instagramAccount.create({ data: {
      userId: user.id, igUserId: "ig-other-" + uid, igUsername: "other_" + uid.slice(0,8),
      accessToken: "test-only", isConnected: true,
    } });
    assert.equal(await getAutomatedMessageBlockReason({
      instagramAccountId: otherAccount.id, participantId, isPrivateReply: true,
    }), null, "Preferences must be account and recipient scoped");
  } finally {
    if (conversationId) await prisma.auditLog.deleteMany({
      where: { targetType: "CONVERSATION", targetId: conversationId },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
    await disconnectRedis();
  }
  console.log("PERSIAN_AUTOMATION_STOP_QUICK_REPLY_OK");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
