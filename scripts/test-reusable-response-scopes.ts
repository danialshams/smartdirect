import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partitionResponseMediaScope } from "../src/lib/automation/response-media-scope";
import { checkedUsagePlan, checkedUsageMedia, assertCoherentMixedScope } from "../src/lib/automation/saved-response-scope";
import { nestedReplyUses, editQuickReplyDestination, parseQuickReplyJson, reconcileActiveQuickReply, preserveUncheckedNestedReply } from "../src/lib/automation/nested-response-usage";
import { displayReusableAssetTitle } from "../src/lib/automation/reusable-titles";
import { validatePublicCommentReplies } from "../src/lib/automation/comment-reply-variants";

const duplicated = JSON.stringify({
  savedResponseId: "form-src", type: "FORM", question: "سؤال اول",
  quickReplies: [
    { title: "بله", payload: "yes", savedResponseId: "text-src", destinationType: "TEXT",
      destinationText: "متن قبلی", text: "متن قبلی" },
    { title: "نه", payload: "no", destinationType: "FORM", destinationQuestion: "مرحله دوم",
      destinationQuickReplies: [
        { title: "سبز", payload: "green", savedResponseId: "media-src", destinationType: "IMAGE",
          destinationMediaUrl: "https://example.test/old.jpg" },
      ] },
  ],
  destinationQuickReplies: [
    { title: "بله", payload: "yes", savedResponseId: "text-src", destinationType: "TEXT",
      destinationText: "متن قبلی" },
    { title: "نه", payload: "no", destinationType: "FORM", destinationQuestion: "مرحله دوم",
      destinationQuickReplies: [
        { title: "سبز", payload: "green", savedResponseId: "media-src", destinationType: "IMAGE",
          destinationMediaUrl: "https://example.test/old.jpg" },
      ] },
  ],
});
const uses = nestedReplyUses(duplicated);
assert.equal(uses.length, 3, "Mirrored compatibility arrays cannot double-count a saved reply.");
const extraLegacyBranch = nestedReplyUses(JSON.stringify({
  quickReplies: [{ payload: "first", savedResponseId: "a", destinationType: "TEXT" }],
  destinationQuickReplies: [
    { payload: "first", savedResponseId: "a", destinationType: "TEXT" },
    { payload: "second", savedResponseId: "b", destinationType: "TEXT" },
  ],
}));
assert.deepEqual(extraLegacyBranch.map((item) => item.savedResponseId), ["a", "b"]);
assert.deepEqual(uses.map((item) => item.savedResponseId), ["form-src", "text-src", "media-src"]);
const textUpdated = editQuickReplyDestination(duplicated, uses[1].path, "text-src", "apply",
  { messageType: "TEXT", text: "پاسخ جدید", mediaUrl: null, mediaId: null,
    showcaseId: null, formId: null, quickReplies: [] });
const parsedText = parseQuickReplyJson(textUpdated)!;
assert.equal((parsedText.quickReplies as Record<string, unknown>[])[0].text, "پاسخ جدید");
assert.equal((parsedText.destinationQuickReplies as Record<string, unknown>[])[0].destinationText, "پاسخ جدید");
assert.deepEqual(nestedReplyUses(textUpdated).map((item) => item.savedResponseId),
  ["form-src", "text-src", "media-src"]);
const detached = editQuickReplyDestination(textUpdated, uses[1].path, "text-src", "detach");
assert.deepEqual(nestedReplyUses(detached).map((item) => item.savedResponseId), ["form-src", "media-src"]);
assert.throws(() => editQuickReplyDestination(detached, uses[1].path, "text-src", "apply",
  { messageType: "TEXT", text: "نباید اعمال شود", mediaUrl: null,
    mediaId: null, showcaseId: null, formId: null, quickReplies: [] }));
const unknownLegacy = JSON.stringify({ payload: "old", nextMessageId: "legacy-next",
  savedResponseId: "text-src", type: "TEXT", text: "قدیمی", extra: { safe: true } });
const preserved = parseQuickReplyJson(editQuickReplyDestination(unknownLegacy, [], "text-src", "apply",
  { messageType: "TEXT", text: "جدید", mediaUrl: null, mediaId: null,
    showcaseId: null, formId: null, quickReplies: [] }))!;
assert.equal(preserved.nextMessageId, "legacy-next");
assert.deepEqual(preserved.extra, { safe: true });

const legacyForm = JSON.stringify({
  savedResponseId: "form-root", type: "FORM", text: "سؤال قدیمی",
  quickReplies: [{ id: "old-option", title: "ادامه", payload: "stay",
    nextMessageId: "next-stage", destinationType: "TEXT", destinationText: "قدیمی" }],
});
const safeForm = parseQuickReplyJson(editQuickReplyDestination(legacyForm, [],
  "form-root", "apply", {
    messageType: "FORM", text: "سؤال جدید", mediaUrl: null, mediaId: null,
    showcaseId: null, formId: null,
    quickReplies: [{ id: "new-id", title: "ادامه جدید", payload: "stay",
      nextMessageId: null, destinationType: "TEXT", destinationText: "متن جدید" }],
  }))!;
const safeOption = (safeForm.quickReplies as Record<string, unknown>[])[0];
assert.equal(safeOption.nextMessageId, "next-stage");
assert.equal(safeOption.id, "old-option");
assert.equal(safeOption.destinationText, "متن جدید");
assert.throws(() => editQuickReplyDestination(legacyForm, [], "form-root", "apply", {
  messageType: "FORM", text: "تغییر نامعتبر", mediaUrl: null, mediaId: null,
  showcaseId: null, formId: null,
  quickReplies: [{ title: "غلط", payload: "changed" }],
}));


assert.equal(assertCoherentMixedScope([["post1", "post2"]], [["post2", "post1"]]), true);
assert.equal(assertCoherentMixedScope([], [["post1"]]), false);
assert.equal(assertCoherentMixedScope([["post1"]], []), false);
assert.throws(() => assertCoherentMixedScope([["post1"]], [["post2"]]));
assert.throws(() => assertCoherentMixedScope([["a","b"], ["a","b"]], [["a"]]));

const activeForm = JSON.stringify({
  type: "FORM", question: "قدیمی", nextMessageId: "original-next",
  quickReplies: [{ id: "old-button", payload: "old-payload", title: "بلی",
    destinationType: "TEXT", destinationText: "سلام", nextMessageId: "old-stage" }],
});
const editedForm = reconcileActiveQuickReply(activeForm, JSON.stringify({
  type: "FORM", question: "سؤال جدید", nextMessageId: "unwanted-change",
  quickReplies: [{ id: "new-button", payload: "new-payload", title: "تأیید",
    destinationType: "TEXT", destinationText: "درود", nextMessageId: null }],
}));
const merged = JSON.parse(editedForm);
assert.equal(merged.question, "سؤال جدید");
assert.equal(merged.nextMessageId, "original-next");
assert.equal(merged.quickReplies[0].payload, "old-payload");
assert.equal(merged.quickReplies[0].id, "old-button");
assert.equal(merged.quickReplies[0].nextMessageId, "old-stage");
assert.equal(merged.quickReplies[0].destinationText, "درود");
assert.throws(() => reconcileActiveQuickReply(activeForm, JSON.stringify({
  type: "FORM", quickReplies: [],
})));
// A main FORM reply can be updated together with a nested reuse only when the
// content scope is complete; changes compose without dropping the old payload.
const originalFormRow = JSON.stringify({
  type: "FORM", question: "سؤال اولیه", payload: "keep-choice", savedResponseId: "common-form",
  quickReplies: [
    { type: "TEXT", title: "بله", payload: "yes", savedResponseId: "common-form",
      text: "متن قبلی", destinationText: "متن قبلی", nextMessageId: "step-3" },
  ],
});
const incomingFormRow = JSON.stringify({
  type: "FORM", question: "سؤال اصلاح‌شده", payload: "changed-payload",
  quickReplies: [
    { type: "TEXT", title: "بله", payload: "different", savedResponseId: "common-form",
      text: "متن مرحله اصلی", destinationText: "متن مرحله اصلی", nextMessageId: null },
  ],
});
const composedMain = reconcileActiveQuickReply(originalFormRow, incomingFormRow);
const composedNested = editQuickReplyDestination(composedMain, ["quickReplies", 0],
  "common-form", "apply", { messageType: "TEXT", text: "متن مقصد مشترک",
    mediaUrl: null, mediaId: null, showcaseId: null, formId: null, quickReplies: [] });
const finalForm = parseQuickReplyJson(composedNested)!;
assert.equal(finalForm.question, "سؤال اصلاح‌شده");
assert.equal(finalForm.payload, "keep-choice");
const finalButton = (finalForm.quickReplies as Record<string, unknown>[])[0];
assert.equal(finalButton.payload, "yes");
assert.equal(finalButton.nextMessageId, "step-3");
assert.equal(finalButton.text, "متن مقصد مشترک");
assert.equal(finalButton.savedResponseId, "common-form");
assert.equal(assertCoherentMixedScope([[]], [[]]), true);
assert.equal(assertCoherentMixedScope([["p1"]], [["p1"]]), true);
assert.throws(() => assertCoherentMixedScope([["p1"]], [["p2"]]));


// Unchecking a nested destination must preserve its original response body,
// even when its parent FORM is being updated at the same time.
const beforeUnchecked = JSON.stringify({
  type: "FORM", quickReplies: [{ type: "TEXT", payload: "fixed",
    savedResponseId: "child-source", text: "متن قبلی", destinationText: "متن قبلی" }],
  destinationQuickReplies: [{ type: "TEXT", payload: "fixed",
    savedResponseId: "child-source", text: "متن قبلی", destinationText: "متن قبلی" }],
});
const afterParentEdit = JSON.stringify({
  type: "FORM", quickReplies: [{ type: "TEXT", payload: "fixed",
    savedResponseId: "child-source", text: "متن جدید فرم", destinationText: "متن جدید فرم" }],
  destinationQuickReplies: [{ type: "TEXT", payload: "fixed",
    savedResponseId: "child-source", text: "متن جدید فرم", destinationText: "متن جدید فرم" }],
});
const untouched = parseQuickReplyJson(preserveUncheckedNestedReply(
  beforeUnchecked, afterParentEdit, ["quickReplies", 0], "child-source"))!;
for (const row of [untouched.quickReplies, untouched.destinationQuickReplies]) {
  const node = (row as Record<string, unknown>[])[0];
  assert.equal(node.text, "متن قبلی");
  assert.equal(node.destinationText, "متن قبلی");
  assert.equal(node.savedResponseId, null);
}
const detachedMirrors = parseQuickReplyJson(editQuickReplyDestination(
  beforeUnchecked, ["quickReplies", 0], "child-source", "detach"))!;
assert.equal((detachedMirrors.quickReplies as Record<string, unknown>[])[0].savedResponseId, null);
assert.equal((detachedMirrors.destinationQuickReplies as Record<string, unknown>[])[0].savedResponseId, null);

const checked = checkedUsagePlan([
  { messageId: "m1", mediaIds: ["post-1", "post-2", "post-3"] },
  { messageId: "m2", mediaIds: [] },
], [
  { messageId: "m1", mediaIds: ["post-1", "post-3"], expectedMessageUpdatedAt: "v1", expectedAutomationUpdatedAt: "v1" },
  { messageId: "m2", mediaIds: [], expectedMessageUpdatedAt: "v2", expectedAutomationUpdatedAt: "v2" },
]);
assert.deepEqual(checked[0].remaining, ["post-2"]);
assert.equal(checked[0].split, true);
assert.deepEqual(checked[1].selected, []);
assert.equal(checked[1].split, false);
assert.deepEqual(checkedUsageMedia(["one","two"], ["one","two"]).remaining, []);
assert.throws(() => checkedUsageMedia(["one"], ["another"]));
assert.throws(() => checkedUsageMedia(["one"], []));
assert.throws(() => checkedUsagePlan([{ messageId: "one", mediaIds: [] }], [
  { messageId: "one", mediaIds: [], expectedMessageUpdatedAt: "1", expectedAutomationUpdatedAt: "1" },
  { messageId: "one", mediaIds: [], expectedMessageUpdatedAt: "1", expectedAutomationUpdatedAt: "1" },
]));
assert.throws(() => checkedUsagePlan([], [
  { messageId: "not-owned", mediaIds: [], expectedMessageUpdatedAt: "1", expectedAutomationUpdatedAt: "1" },
]));

const scopedRoute = readFileSync("app/api/saved-responses/[id]/apply/route.ts", "utf8");
assert(scopedRoute.includes("prisma.$transaction"), "Applying reply changes must be atomic.");
assert(scopedRoute.includes("mixedForks.set(automationId, { id: clone.id, replyMap })"));
assert(scopedRoute.includes('const directOwner = type === "FORM"') &&
  scopedRoute.includes("draftText = reconcileActiveQuickReply(original.replyText, encodeReply(quickReplies[index]))"),
  "FORM parent and nested edits must be composed on one original Quick Reply snapshot.");
assert(scopedRoute.includes("baseText = reconcileActiveQuickReply(fresh.replyText, encodeReply(quickReplies[index]))"),
  "Partial mixed FORM updates must reconcile the cloned root before editing nested replies.");
assert(scopedRoute.includes("preserveUncheckedNestedReply(originalData.get(rootId)?.replyText"),
  "Unselected nested form branches must keep their old content after parent edits.");
assert(scopedRoute.includes("const copiedId = mixedForks.get(automationId)?.replyMap.get(link.quickReplyId)"),
  "Nested Quick Reply rows on a new selected-media fork must be deferred until composition.");

assert(scopedRoute.includes("const mainFork = mixedForks.get(automationId)"),
  "Nested and primary edits must reuse the same fork for a partially selected automation.");
assert(scopedRoute.includes("if (!lockedMixed.has(automationId))"),
  "A mixed non-fork edit must avoid double-locking its automation.");

assert(scopedRoute.includes("updatedAt: expected"), "Template edits require optimistic version checks.");
assert(scopedRoute.includes("commentAutomationId: clone.id"), "Selected publishing jobs must follow their cloned comment automation.");
assert(scopedRoute.includes("nextMessageId: reply.nextMessageId ? remap.get(reply.nextMessageId)! : null") &&
  scopedRoute.includes("if (reply.nextMessageId && !remap.has(reply.nextMessageId))"),
  "Cloned quick replies must never point to old sibling automation messages.");
const picker = readFileSync("components/dashboard/publishing/ReusableResponseLibrary.tsx", "utf8");
assert(picker.includes("quickReplyId: usage.quickReplyId, nodePath: usage.nodePath || []"),
  "Nested scope selections must carry the exact root row ID and immutable JSON path.");
assert(picker.includes("GlassModalPresence open={scopeOpen}") && picker.includes("selectedScopes()"),
  "Reusable response editing must require explicit checked destinations.");

const all = partitionResponseMediaScope(["post-1","reel-2","post-3"], ["post-1","reel-2","post-3"]);
assert.equal(all.splitShared, false);
assert.deepEqual(all.untouchedIds, []);
assert.deepEqual(all.appliedExistingIds, ["post-1","reel-2","post-3"]);

const subset = partitionResponseMediaScope(["post-1","reel-2","post-3"], ["post-1","post-3"]);
assert.equal(subset.splitShared, true);
assert.deepEqual(subset.appliedExistingIds, ["post-1","post-3"]);
assert.deepEqual(subset.untouchedIds, ["reel-2"]);

const withNew = partitionResponseMediaScope(["post-1","reel-2"], ["post-1","post-4"]);
assert.deepEqual(withNew.addedIds, ["post-4"]);
assert.deepEqual(withNew.untouchedIds, ["reel-2"]);
assert.deepEqual(partitionResponseMediaScope(["a","b"], []).appliedExistingIds, []);

assert.equal(displayReusableAssetTitle("FORM","کفش"), "فرم کفش");
assert.equal(displayReusableAssetTitle("FORM","فرم کفش"), "فرم کفش");
assert.equal(displayReusableAssetTitle("SHOWCASE","کفش"), "ویترین کفش");
assert.equal(displayReusableAssetTitle("SHOWCASE","ویترین کفش"), "ویترین کفش");
assert.throws(() => validatePublicCommentReplies(["سلام", "سلام", "درود"]));
assert.throws(() => validatePublicCommentReplies(["كفش", "کفش", "درود"]));

const library = readFileSync("components/dashboard/publishing/ReusableResponseLibrary.tsx", "utf8");
assert(library.includes("GlassModalPresence") && library.includes("allowedTypes.includes(item.messageType)"));
assert(library.includes('method: approved || manualEdit ? "PATCH" : "POST"') &&
       library.includes('"/api/saved-responses/" + encodeURIComponent(editingId) + "/apply"'),
  "Explicit shared edits must use scoped PATCH while new templates use POST.");
const editRoute = readFileSync("app/api/automations/[id]/comment-edit/route.ts", "utf8");
assert(editRoute.includes("partitionResponseMediaScope(oldMediaIds, mediaIds)"));
assert(editRoute.includes("const remaining = scope.untouchedIds;"));
const pick = readFileSync("components/dashboard/AutomationCreationFlow.tsx", "utf8");
assert(!pick.includes("<GlassModalPresence open={editScopeOpen}") && pick.includes("linkMediaOnly:true"),
  "Comment response editing applies to all associated media; existing replies are linked rather than copied.");
assert(pick.includes("linkMediaOnly:true") &&
  !pick.includes("const copyNested =") && !pick.includes("ایجاد پاسخ مستقل"),
  "Choosing a previous rule must attach the existing reply to additional media.");
const api = readFileSync("app/api/automations/[id]/route.ts", "utf8");
assert(api.includes("isActive: Boolean") || api.includes("Boolean(isActive)"),
  "Each independent reply must still support its own activation state.");
const storyMatch = readFileSync("src/lib/automation/trigger.ts", "utf8");
assert(storyMatch.includes('if (triggerType === "COMMENT_KEYWORD")') &&
  storyMatch.includes('Story replies are account-wide'),
  "Story keyword matches must ignore media, while comment replies remain media-scoped.");
const storyCreate = readFileSync("components/dashboard/StoryAutomationCreate.tsx", "utf8");
assert(storyCreate.includes('StoryAutomationConfigure'),"New story replies must open without selecting media.");
const detachedMigration = readFileSync("prisma/migrations/20261025000000_detach_shared_reply_links/migration.sql", "utf8");
assert(detachedMigration.includes('SET "savedResponseId" = NULL'),"Previously linked replies must lose template dependencies.");
const menu = readFileSync("components/dashboard/EntryPointFlowBuilder.tsx","utf8");
assert(menu.includes("hideReusableLibrary") && menu.includes("responseFingerprint"), "Menu and icebreaker reply edits must remain detectable without response names.");
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert(schema.includes("savedResponseId       String?"), "Automation messages must reference their source template.");
assert(schema.includes('appliedMessages     AutomationMessage[] @relation("AppliedReusableResponse")'));
const migration = readFileSync("prisma/migrations/20261024153500_saved_response_provenance/migration.sql", "utf8");
assert(migration.includes("ON DELETE SET NULL"), "Deleting a saved template must not delete active replies.");
const messagesApi = readFileSync("app/api/automations/[id]/messages/route.ts", "utf8");
const directApi = readFileSync("app/api/direct-automation/route.ts", "utf8");
assert(messagesApi.includes("validateSavedResponseOrigin") && directApi.includes("validateSavedResponseOrigin"),
  "Account ownership must be checked before linking saved replies.");
const savedResponsesApi = readFileSync("app/api/saved-responses/route.ts", "utf8");
assert(savedResponsesApi.includes("where: { savedResponseId: { in: sourceIds }, automation: { instagramAccountId } }"),
  "Usage lookup must be restricted to the selected Instagram account.");
const nestedForm = readFileSync("components/dashboard/publishing/StoryReplyFormEditor.tsx","utf8");
assert(!nestedForm.includes("<ReusableResponseLibrary") && nestedForm.includes('reply.destinationType === "TEXT"'),
  "Nested branches must edit their own independent content without a shared response picker.");
assert(library.includes('mode !== "existing"'), "Nested reply lists must fetch lazily, not on every mount.");
console.log("REUSABLE_RESPONSES_SCOPED_EDIT_AND_NAME_TESTS_OK");

const commentEditor=readFileSync("components/dashboard/AutomationCreationFlow.tsx","utf8");
const storyCron=readFileSync("app/api/cron/cleanup-story-automations/route.ts","utf8");
assert(commentEditor.includes("Edits to an automation apply to every post/reel using its response.") &&
  !commentEditor.includes("editingMediaId ? [editingMediaId]"),
  "Editing a connected comment automation must update every attached post and reel.");
assert(storyCron.includes('!automation.mediaId.startsWith("pending:")'),
  "Scheduled story automations must not activate before their Instagram publication.");

const linkRoute=readFileSync("app/api/automations/[id]/route.ts","utf8");
const shareReuse=readFileSync("components/dashboard/ShareMentionEditor.tsx","utf8");
assert(linkRoute.includes("body.activateOnLink === true") &&
  commentEditor.includes("activateOnLink:true") && shareReuse.includes("activateOnLink:true"),
  "Create from previous reply must activate the existing linked rule rather than leaving a newly attached reply inactive.");
