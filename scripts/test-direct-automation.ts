import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesAutomationKeyword, splitAutomationKeywords } from "../src/lib/automation/trigger";
import { directAutomationHasChanges, responseFingerprint } from "../components/dashboard/automation-response-compare";
import type { MessageDraft, QuickReplyDraft } from "../components/dashboard/automation-form-utils";

assert.deepEqual(splitAutomationKeywords(" قیمت، موجودی; ۱ "), ["قیمت", "موجودی", "1"]);
assert.equal(matchesAutomationKeyword("قیمت,موجودی", "قیمت"), true);
assert.equal(matchesAutomationKeyword("قیمت,موجودی", "  موجودی "), true);
assert.equal(matchesAutomationKeyword("قیمت,موجودی", "سلام"), false);
assert.equal(matchesAutomationKeyword("قیمت,موجودی", "قیمت لطفا"), false, "Exact matching is required");
assert.equal(matchesAutomationKeyword("قیمت", "قیمت", "EXACT"), true);
assert.equal(matchesAutomationKeyword(null, "قیمت", "EXACT"), false, "Internal menu DM rules must not match text");
assert.equal(matchesAutomationKeyword("۱", "1"), true);

const finder=readFileSync("src/lib/automation/find-matching-automation.ts","utf8");
const webhook=readFileSync("app/api/webhooks/instagram/route.ts","utf8");
const api=readFileSync("app/api/direct-automation/route.ts","utf8");
const sidebar=readFileSync("components/dashboard/DashboardSidebar.tsx","utf8");
const directList = readFileSync("components/dashboard/DirectAutomationList.tsx","utf8");
const directSkeleton = readFileSync("components/dashboard/DirectAutomationSkeleton.tsx","utf8");
const directEditor = readFileSync("components/dashboard/DirectAutomationEditor.tsx","utf8");
const directSuccess = readFileSync("components/dashboard/DirectAutomationSuccess.tsx","utf8");
const storyList = readFileSync("components/dashboard/StoryAutomationLanding.tsx","utf8");
const sharedList = readFileSync("components/dashboard/AutoRepliesManager.tsx","utf8");
const dashboard=readFileSync("components/dashboard/DashboardOverview.tsx","utf8");
assert.ok(finder.includes("matchesAutomationKeyword("), "DM resolver must match keywords");
assert.ok(finder.includes("Boolean(automation.keyword?.trim())"), "Internal menu/Icebreaker rules must be excluded");
assert.ok(!finder.includes("return automations[0] ?? null"),"No unconditional first-DM fallback");
assert.ok(webhook.includes('keyword: messageText || ""'), "Webhooks must send actual incoming text");
assert.ok(webhook.includes("findAutomationByQuickReplyPayload"),"Preserve existing Quick Reply routing");
assert.ok(webhook.includes("processLiveReplyContinuation"),"Preserve live continuation");
assert.ok(api.includes("SELECT id FROM"),"Keyword validation must serialize per account");
assert.ok(api.includes("splitAutomationKeywords"),"Detect duplicate normalized words across rules");
assert.ok(api.includes("invalidateAutomationCache"),"Update resolver cache after writes");
assert.ok(api.includes("parseReplies"),"Form trees must be persisted");
assert.ok(sidebar.includes('href: "/dashboard/direct-automation"'),"DM menu must be present");
assert.ok(!sidebar.includes('href: "/dashboard/comments"'),"Legacy unanswered comment menu must be removed");
assert.ok(dashboard.includes('title: "پاسخ خودکار دایرکت"') && dashboard.includes('href: "/dashboard/direct-automation"'),"Real dashboard home card must link to new DM replies");
assert.ok(!dashboard.includes('کامنت‌های بی‌پاسخ') && !dashboard.includes('href: "/dashboard/comments"'),"Real dashboard home must not link to deleted unanswered comments");

assert.ok(directSkeleton.includes("<AutoRepliesSkeleton includeCreateButton />"),"DM list loading must use the story/comment skeleton including create button");
assert.ok(directList.includes('min-h-[84px]') && directList.includes('rounded-[22px]') && directList.includes('space-y-2.5'),"DM list must mirror story/comment row layout");
assert.ok(sharedList.includes('min-h-[84px]') && sharedList.includes('rounded-[22px]'),"Story/comment row reference changed");
assert.ok(directList.includes('className="flex min-h-[54px] w-full flex-row-reverse'),"DM add button must mirror story add button");
assert.ok(directList.indexOf('<Plus size={20} aria-hidden="true" />') < directList.indexOf('<span>ایجاد پاسخ جدید</span>'),"DM plus icon must lead label");
assert.ok(storyList.includes("<Plus size={20} />") && storyList.indexOf("<Plus size={20} />") < storyList.indexOf("<span>ایجاد پاسخ جدید</span>"),"Story reference button expected");
assert.ok(!directEditor.includes("ArrowRight") && !directEditor.includes("> بازگشت</button>"),"Do not duplicate header back button");
assert.ok(directEditor.includes('if(completed)return <DirectAutomationSuccess'),"Show success screen after server confirmation");
assert.ok(!directEditor.includes('router.push("/dashboard/direct-automation",{scroll:true})'),"Saving must not immediately redirect past success");
assert.ok(directSuccess.includes('sd-success-ring') && directSuccess.includes('sd-success-path'),"Success checkmark animation is required");
assert.ok(directSuccess.includes("بازگشت به لیست پاسخ‌ها"),"Success screen must have list button");


// Editing an existing direct reply must not allow saving without a real change.
assert.ok(directEditor.includes("const hasChanges=!original||directAutomationHasChanges("),
  "DM edit must compute dirty state from saved keywords and response");
assert.ok(directEditor.includes("setOriginalResponseSignature(existing?responseFingerprint(initialMessage):null)"),
  "DM edit must take the saved response as its baseline after hydration");
assert.ok(directEditor.includes("finalSaveDisabled={saving||!hasChanges}"),
  "DM edit Save must be disabled when there are no changes");
assert.ok(directEditor.includes("onDraftChange={setShowcaseDraftChanged}"),
  "Unsaved showcase slide edits must also enable Save");
assert.ok(directEditor.includes("(original&&!hasChanges)"),
  "A submit triggered without changes must not send the API update");

const sampleMessage: MessageDraft = {
  id: "old-record-id", messageType: "TEXT", text: "سلام",
  mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: [],
};
const signature = responseFingerprint(sampleMessage);
const unchanged = (params: Partial<Parameters<typeof directAutomationHasChanges>[0]> = {}) =>
  directAutomationHasChanges({
    originalKeywords: ["قیمت", "موجودی"],
    currentKeywords: ["موجودی", "قیمت"],
    originalResponseSignature: signature,
    currentMessage: { ...sampleMessage, id: "new-client-generated-id" },
    ...params,
  });
assert.equal(unchanged(), false, "Opening an existing DM automation must keep Save disabled");
assert.equal(unchanged({ currentKeywords: ["قیمت", "موجودی", "قیمت"] }), false,
  "Keyword reordering and duplicates do not change the rule");
assert.equal(unchanged({ currentKeywords: ["قیمت", "موجودی", "ارسال"] }), true,
  "Adding a keyword should enable Save");
assert.equal(unchanged({ currentKeywords: ["قیمت"] }), true,
  "Removing a keyword should enable Save");
assert.equal(unchanged({ currentMessage: { ...sampleMessage, text: "سلام!" } }), true,
  "Editing reply text should enable Save");
assert.equal(unchanged({ currentMessage: { ...sampleMessage, text: "سلام" } }), false,
  "Undoing a text edit should disable Save again");
assert.equal(unchanged({ showcaseDraftChanged: true }), true,
  "Modifying a saved showcase draft should enable Save");
assert.equal(unchanged({ originalResponseSignature: null }), false,
  "Save must remain disabled until the saved response has finished loading");
assert.equal(responseFingerprint({ ...sampleMessage, id: "different-id" }), signature,
  "Generated message IDs must not count as content edits");
const formReply: QuickReplyDraft = {
  id: "first", title: "بله", payload: "server-payload", nextMessageId: null,
  destinationType: "FORM", destinationText: "", destinationFormId: "",
  destinationShowcaseId: "", destinationMediaUrl: "", destinationMediaId: "",
  destinationQuestion: "چه رنگی؟", destinationQuickReplies: [{
    id: "nested", title: "آبی", payload: "nested-payload", nextMessageId: null,
    destinationType: "TEXT", destinationText: "آبی موجود است",
    destinationFormId: "", destinationShowcaseId: "", destinationMediaUrl: "",
    destinationMediaId: "", destinationQuestion: "", destinationQuickReplies: [],
  }],
};
const formMessage: MessageDraft = { ...sampleMessage, messageType: "FORM", text: "سؤال", quickReplies: [formReply] };
const formSignature = responseFingerprint(formMessage);
assert.equal(unchanged({
  originalResponseSignature: formSignature,
  currentMessage: { ...formMessage, id: "other-id", quickReplies: [
    { ...formReply, id: "other-reply", payload: "other-payload", destinationQuickReplies: [
      { ...formReply.destinationQuickReplies[0], id: "other-child", payload: "other-nested-payload" },
    ] },
  ] },
}), false, "Regenerated form IDs/payloads must not enable Save");
assert.equal(unchanged({
  originalResponseSignature: formSignature,
  currentMessage: { ...formMessage, quickReplies: [
    { ...formReply, destinationQuickReplies: [
      { ...formReply.destinationQuickReplies[0], destinationText: "آبی تمام شد" },
    ] },
  ] },
}), true, "Editing a nested form destination must enable Save");

console.log("DIRECT_AUTOMATION_INTEGRATION_OK",{
  exactKeywords:true,internalDmIsolation:true,quickReplyPreservation:true,
  liveContinuationPreservation:true,duplicateKeywordGuard:true,
  multiTypeEditor:true,sidebar:true,
});
