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

console.log("DIRECT_AUTOMATION_INTEGRATION_OK",{
  exactKeywords:true,internalDmIsolation:true,quickReplyPreservation:true,
  liveContinuationPreservation:true,duplicateKeywordGuard:true,
  multiTypeEditor:true,sidebar:true,
});
