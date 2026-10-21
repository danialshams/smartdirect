import assert from "node:assert/strict";
import { reminderBlockReason, reminderWindowValidAt } from "../src/lib/automation/smart-reminder-policy";
import { selectableForReminder, smartReminderOptionName } from "../src/lib/automation/smart-reminder-options";

const inbound = new Date("2026-10-20T08:00:00.000Z");
const outbound = new Date("2026-10-20T08:01:00.000Z");
const at = (minutes: number) => new Date(inbound.getTime() + minutes * 60_000);

assert.equal(reminderWindowValidAt(inbound, at(60)), true, "Normal reminders inside the 24h window are allowed");
assert.equal(reminderWindowValidAt(inbound, at(23 * 60)), true);
assert.equal(reminderWindowValidAt(inbound, at(24 * 60 - 4)), false, "Keep five-minute safety margin");
assert.equal(reminderWindowValidAt(inbound, at(24 * 60)), false);
assert.equal(reminderWindowValidAt(inbound, at(48 * 60)), false, "Human Agent exception must never allow automation");

const base = { anchorAt: outbound, lastInboundAt: inbound, latestOutboundMatches: true, now: at(120) };
assert.equal(reminderBlockReason(base), null, "Unanswered DM within allowed window may receive a reminder");
assert.equal(reminderBlockReason({ ...base, lastInboundAt: at(90) }), "CONVERSATION_CHANGED", "Any later user reply cancels the reminder");
assert.equal(reminderBlockReason({ ...base, latestOutboundMatches: false }), "CONVERSATION_CHANGED", "Newer outbound messages supersede old reminders");
assert.equal(reminderBlockReason({ ...base, lastInboundAt: null }), "CONVERSATION_CHANGED", "A comment private reply does not open the DM window");
assert.equal(reminderBlockReason({ ...base, anchorAt: null }), "CONVERSATION_CHANGED");
assert.equal(reminderBlockReason({ ...base, now: at(24 * 60 + 30) }), "INSTAGRAM_24H_WINDOW_CLOSED");

const candidate = (triggerType: string, keyword: string | null, keywordMatchMode = "EXACT", mediaId: string | null = null) =>
  ({ triggerType, keyword, keywordMatchMode, mediaId });
assert.equal(selectableForReminder(candidate("DM", null)), false, "Internal keywordless DM replies must not flood the selector");
assert.equal(selectableForReminder(candidate("DM", "اطلاعات")), true);
assert.equal(selectableForReminder(candidate("STORY_REPLY_KEYWORD", "قیمت")), true);
assert.equal(selectableForReminder(candidate("COMMENT_KEYWORD", "کفش")), true, "Comment replies with DM content are selectable");
assert.equal(selectableForReminder(candidate("COMMENT_KEYWORD", null, "CONTAINS_ANY")), true, "Comment match-any rules are selectable");
assert.equal(selectableForReminder(candidate("COMMENT_KEYWORD", "کفش", "EXACT", "__smartdirect_live_comments_v1__")), false, "Live private replies are excluded");
assert.equal(smartReminderOptionName(candidate("COMMENT_KEYWORD", "کفش, قیمت؛سفارش")), "پاسخ خودکار کامنت — کفش، قیمت، سفارش");
assert.equal(smartReminderOptionName(candidate("COMMENT_KEYWORD", null, "CONTAINS_ANY")), "پاسخ خودکار کامنت — هر کامنتی");
assert.equal(smartReminderOptionName(candidate("STORY_REPLY_KEYWORD", "قیمت")), "پاسخ خودکار استوری — قیمت");

console.log("SMART_REMINDERS_POLICY_TEST_OK", {
  twentyFourHourRule: true, noHumanAgentBypass: true, userReplyCancellation: true,
  outboundSupersession: true, noPrivateReplyWithoutDM: true, optionLabelsAndEligibility: true,
});
