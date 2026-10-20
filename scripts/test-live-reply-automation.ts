import assert from "node:assert/strict";
import { validateLiveReplyInput, liveReplyOptionsOverlap, LiveReplyValidationError } from "../src/lib/automation/live-reply-validation";
import { matchesAutomationTrigger, matchesAutomationKeyword, splitAutomationKeywords } from "../src/lib/automation/trigger";

function base() {
  return {
    keyword: "قیمت، لینک", matchMode: "EXACT",
    initialText: "سلام! اطلاعات قیمت: https://example.com",
    requireFollow: false,
    followGateText: "",
    followupEnabled: false,
  };
}

const direct = validateLiveReplyInput(base());
assert.equal(direct.keyword, "قیمت,لینک");
assert.equal(direct.message, null);
assert.ok(direct.initialText.includes("https://"));
assert.equal(matchesAutomationKeyword(direct.keyword, "قیمت", "EXACT"), true);
assert.equal(matchesAutomationKeyword(direct.keyword, "غیر قیمت", "EXACT"), false);
assert.equal(matchesAutomationKeyword(direct.keyword, "غیر قیمت", "CONTAINS_ANY"), true);

const anyComment = validateLiveReplyInput({ ...base(), keyword: "", matchMode: "CONTAINS_ANY" });
assert.equal(anyComment.keyword, "");
assert.equal(anyComment.matchMode, "CONTAINS_ANY");
assert.equal(matchesAutomationKeyword(anyComment.keyword, "سلام!", anyComment.matchMode), true);
assert.equal(matchesAutomationKeyword(anyComment.keyword, "سلام قیمت", anyComment.matchMode), true);
assert.equal(matchesAutomationKeyword(anyComment.keyword, "", anyComment.matchMode), false);
assert.equal(matchesAutomationKeyword(anyComment.keyword, "سلام!", "EXACT"), false);
const oldSubstringRule = validateLiveReplyInput({ ...base(), keyword: "قیمت", matchMode: "CONTAINS_ANY" });
assert.equal(oldSubstringRule.keyword, "قیمت");
assert.equal(matchesAutomationKeyword(oldSubstringRule.keyword, "قیمت رو بگید", oldSubstringRule.matchMode), true);
assert.equal(matchesAutomationTrigger({
  triggerType: "COMMENT_KEYWORD", configuredKeyword: direct.keyword, incomingKeyword: "قیمت",
  automationMediaId: "__smartdirect_live_comments_v1__", incomingMediaId: "1789938130",
}), false, "Live rules must not match regular post comments");
assert.equal(liveReplyOptionsOverlap("قیمت,خرید", "قیمت،لینک"), true);
assert.equal(liveReplyOptionsOverlap("قیمت,خرید", "تخفیف،لینک"), false);
assert.equal(liveReplyOptionsOverlap("قیمت", "قیمت‌ها", "EXACT", "EXACT"), false);
assert.equal(liveReplyOptionsOverlap("قیمت", "قیمت‌ها", "CONTAINS_ANY", "EXACT"), true);
assert.equal(liveReplyOptionsOverlap("قیمت‌ها", "قیمت", "EXACT", "CONTAINS_ANY"), true);
assert.equal(liveReplyOptionsOverlap("لینک", "قیمت", "CONTAINS_ANY", "EXACT"), false);
assert.equal(liveReplyOptionsOverlap("", "", "CONTAINS_ANY", "CONTAINS_ANY"), true);
assert.equal(liveReplyOptionsOverlap("", "قیمت", "CONTAINS_ANY", "EXACT"), false);
assert.equal(liveReplyOptionsOverlap("قیمت", "", "EXACT", "CONTAINS_ANY"), false);
assert.deepEqual(splitAutomationKeywords("قیمت\nقیمت،ارسال"), ["قیمت", "قیمت", "ارسال"]);

const follow = validateLiveReplyInput({
  ...base(), requireFollow: true, followGateText: "ابتدا فالو کن.",
  followupEnabled: true, followupKeyword: "ارسال کن",
  message: { id: "message_1", messageType: "IMAGE", text: "",
    mediaUrl: "https://example.com/photo.jpg", mediaId: "", showcaseId: "", formId: "", quickReplies: [] },
});
assert.equal(follow.requireFollow, true);
assert.equal(follow.followGateButtonText, "بررسی فالو", "Legacy live rules keep the default follow-check label");
assert.equal(follow.message?.messageType, "IMAGE");
const followWithCustomLabel = validateLiveReplyInput({
  ...base(), requireFollow: true, followGateText: "اول پیج را فالو کن.", followGateButtonText: "فالو کردم",
});
assert.equal(followWithCustomLabel.followGateButtonText, "فالو کردم");
assert.equal(follow.followupKeyword, "ارسال کن");

const opt = (id: string) => ({
  id, title: id, payload: "payload_" + id, nextMessageId: null,
  destinationType: "TEXT", destinationText: "پاسخ", destinationQuestion: "",
  destinationFormId: "", destinationShowcaseId: "", destinationMediaUrl: "",
  destinationMediaId: "", destinationQuickReplies: [],
});
const form = validateLiveReplyInput({
  ...base(), followupEnabled: true, followupKeyword: "ارسال کن",
  message: { id: "message_form", messageType: "FORM", text: "کدام گزینه؟",
    mediaUrl: "", mediaId: "", showcaseId: "", formId: "",
    quickReplies: [opt("first"), opt("second")] },
});
assert.equal(form.message?.quickReplies.length, 2);
const nested = validateLiveReplyInput({
  ...base(), followupEnabled: true, followupKeyword: "ارسال کن",
  message: { id: "message_form", messageType: "FORM", text: "اول؟",
    mediaUrl: "", mediaId: "", showcaseId: "", formId: "",
    quickReplies: [
      { ...opt("first"), destinationType: "FORM", destinationQuestion: "دوم؟",
        destinationQuickReplies: [opt("nested_a"), opt("nested_b")] },
      opt("second"),
    ] },
});
assert.equal(nested.message?.quickReplies[0].destinationQuickReplies.length, 2);

for (const bad of [
  { ...base(), keyword: "" },
  { ...base(), initialText: "" },
  { ...base(), requireFollow: true, followGateText: "" },
  { ...base(), requireFollow: true, followGateText: "فالو کن", followGateButtonText: "" },
  { ...base(), requireFollow: true, followGateText: "فالو کن", followGateButtonText: "یک عنوان بسیار طولانی و نامعتبر برای دکمه" },
  { ...base(), followupEnabled: true, followupKeyword: "" },
  { ...base(), followupEnabled: true, followupKeyword: "ارسال کن", message: {
    id: "", messageType: "VIDEO", text: "", mediaUrl: "", mediaId: "",
    showcaseId: "", formId: "", quickReplies: [],
  } },
  { ...base(), followupEnabled: true, followupKeyword: "ارسال کن", message: {
    id: "", messageType: "FORM", text: "سؤال", mediaUrl: "", mediaId: "",
    showcaseId: "", formId: "", quickReplies: [opt("only")],
  } },
]) assert.throws(() => validateLiveReplyInput(bad), LiveReplyValidationError);

console.log("LIVE_AUTOMATION_VALIDATION_TEST_OK", {
  directText: true, commentIsolation: true, keywordMatching: true, anyLiveComment: true, catchAllConflict: true, legacySubstringCompatibility: true,
  followGate: true, customizableFollowCheckLabel: true, richMediaFollowup: true, nestedForms: true, invalidInputRejected: true,
});
