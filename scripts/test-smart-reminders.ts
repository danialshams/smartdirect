import assert from "node:assert/strict";
import { reminderBlockReason, reminderWindowValidAt } from "../src/lib/automation/smart-reminder-policy";

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

console.log("SMART_REMINDERS_POLICY_TEST_OK", {
  twentyFourHourRule: true, noHumanAgentBypass: true, userReplyCancellation: true,
  outboundSupersession: true, noPrivateReplyWithoutDM: true,
});
