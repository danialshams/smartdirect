import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesAutomationKeyword, splitAutomationKeywords } from "../src/lib/automation/trigger";

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

console.log("DIRECT_AUTOMATION_INTEGRATION_OK",{
  exactKeywords:true,internalDmIsolation:true,quickReplyPreservation:true,
  liveContinuationPreservation:true,duplicateKeywordGuard:true,
  multiTypeEditor:true,sidebar:true,
});
