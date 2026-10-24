import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partitionResponseMediaScope } from "../src/lib/automation/response-media-scope";
import { displayReusableAssetTitle } from "../src/lib/automation/reusable-titles";
import { validatePublicCommentReplies } from "../src/lib/automation/comment-reply-variants";

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
assert(library.includes('method: editingId ? "PATCH" : "POST"'));
const editRoute = readFileSync("app/api/automations/[id]/comment-edit/route.ts", "utf8");
assert(editRoute.includes("partitionResponseMediaScope(oldMediaIds, mediaIds)"));
assert(editRoute.includes("const remaining = scope.untouchedIds;"));
const pick = readFileSync("components/dashboard/AutomationCreationFlow.tsx", "utf8");
assert(pick.includes("editScopeIds") && pick.includes("GlassModalPresence open={editScopeOpen}"));
assert(pick.includes("mediaIds: targetIds"), "Reusing a story reply must pass its selected story to the API.");
const api = readFileSync("app/api/automations/[id]/route.ts", "utf8");
assert(api.includes("...previousIds, ...targetIds"), "Reusing a response must preserve existing media links.");
const menu = readFileSync("components/dashboard/EntryPointFlowBuilder.tsx","utf8");
assert(menu.includes("responseName.trim() !== originalNameRef.current"), "Name-only edits must be detected.");
console.log("REUSABLE_RESPONSES_SCOPED_EDIT_AND_NAME_TESTS_OK");
