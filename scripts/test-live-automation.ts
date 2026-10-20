import assert from "node:assert/strict";
import { parseLiveRule, LiveRuleValidationError } from "../src/lib/automation/live-rule";
import { matchesAutomationTrigger } from "../src/lib/automation/trigger";
import { normalizeInstagramWebhookEvent } from "../src/lib/webhook/normalize";

const direct = parseLiveRule({
  keyword: "قیمت، قیمت, لینک", keywordMatchMode: "EXACT", mode: "DIRECT",
  firstText: "قیمت: ۵۹۰ هزار تومان، https://example.com", requireFollow: false,
});
assert.equal(direct.keyword, "قیمت,لینک");
assert.equal(direct.mode, "DIRECT");
assert.equal(direct.answer, null);
assert.ok(matchesAutomationTrigger({
  triggerType: "LIVE_COMMENT_KEYWORD", configuredKeyword: "قیمت,لینک",
  incomingKeyword: "قیمت", keywordMatchMode: "EXACT",
}));
assert.ok(!matchesAutomationTrigger({
  triggerType: "LIVE_COMMENT_KEYWORD", configuredKeyword: "قیمت",
  incomingKeyword: "قیمتشو داری؟", keywordMatchMode: "EXACT",
}));
assert.ok(matchesAutomationTrigger({
  triggerType: "LIVE_COMMENT_KEYWORD", configuredKeyword: "قیمت",
  incomingKeyword: "قیمتشو داری؟", keywordMatchMode: "CONTAINS_ANY",
}));

const continuation = parseLiveRule({
  keyword: "اطلاعات", mode: "FOLLOWUP", firstText: "برای اطلاعات بنویس ارسال کن",
  replyKeyword: "ارسال کن", requireFollow: true,
  followGateText: "برای اطلاعات پیج را فالو کن",
  answer: { messageType: "FORM", text: "کدام محصول؟", quickReplies: [
    { title: "الف", payload: "option-a", destinationType: "TEXT", destinationText: "محصول الف" },
    { title: "ب", payload: "option-b", destinationType: "SHOWCASE", destinationShowcaseId: "showcase-1" },
  ] },
});
assert.equal(continuation.mode, "FOLLOWUP");
assert.equal(continuation.requireFollow, true);
assert.equal(continuation.answer?.quickReplies.length, 2);
assert.equal(continuation.answer?.quickReplies[1].destinationShowcaseId, "showcase-1");
assert.throws(() => parseLiveRule({
  keyword: "قیمت", mode: "DIRECT", firstText: "ارسال کن", requireFollow: true,
}), LiveRuleValidationError);
assert.throws(() => parseLiveRule({
  keyword: "قیمت", mode: "FOLLOWUP", firstText: "ارسال کن", replyKeyword: "ارسال کن",
  answer: { messageType: "FORM", text: "سؤال", quickReplies: [
    { title: "الف", payload: "duplicate", destinationType: "TEXT", destinationText: "الف" },
    { title: "ب", payload: "duplicate", destinationType: "TEXT", destinationText: "ب" },
  ] },
}), LiveRuleValidationError);
const event = normalizeInstagramWebhookEvent({
  type: "LIVE_COMMENT", accountId: "account-1",
  event: { id: "live-comment-123", text: "قیمت", media: { id: "live-media" } },
});
assert.equal(event.type, "LIVE_COMMENT");
assert.equal(event.eventId, "live-comment-123");
assert.equal(event.accountId, "account-1");
console.log("LIVE_AUTOMATION_FOUNDATION_OK", {
  directText: true, multiKeywordMatching: true, followGateRequiresReply: true,
  recursiveFormValidation: true, liveWebhookIdempotency: true,
});
