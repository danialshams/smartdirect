import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getDashboardHomeSnapshot,setDashboardHomeSnapshot} from "../src/lib/dashboard/home-summary-cache";

const keyA = "qa-user-a:account-a";
const keyB = "qa-user-b:account-a";
const sample = { unreadConversations: 2, pendingPublishing: 1, activeAutomations: 3 };
const other = { unreadConversations: 0, pendingPublishing: 4, activeAutomations: 0 };
const now=1_000_000;
assert.equal(getDashboardHomeSnapshot(keyA,now),null);
setDashboardHomeSnapshot(keyA,sample,now);
assert.deepEqual(getDashboardHomeSnapshot(keyA,now+5_000)?.value,sample);
assert.equal(getDashboardHomeSnapshot(keyB,now+5_000),null,"Cross-user summary leakage");
setDashboardHomeSnapshot(keyB,other,now);
assert.deepEqual(getDashboardHomeSnapshot(keyA,now+10_000)?.value,sample);
assert.deepEqual(getDashboardHomeSnapshot(keyB,now+10_000)?.value,other);
assert.equal(getDashboardHomeSnapshot(keyA,now+121_000),null,"Expired summary not evicted");
assert.equal(getDashboardHomeSnapshot(keyB,now-1),null,"Invalid clock must expire");
for(let i=0;i<18;i++)setDashboardHomeSnapshot("test-user:account-"+i,sample,now);
assert.equal(getDashboardHomeSnapshot("test-user:account-0",now),null,"Cache must remain bounded");
assert.deepEqual(getDashboardHomeSnapshot("test-user:account-17",now)?.value,sample);

const src=readFileSync("components/dashboard/DashboardOverview.tsx","utf8");
assert(src.includes("getDashboardHomeSnapshot"),"Dashboard must reuse snapshot on revisit");
assert(src.includes("setDashboardHomeSnapshot"),"Successful responses must update snapshot");
assert(src.includes('cache: "no-store"'),"API remains authoritative");
assert(src.includes("controller.abort()"),"Account changes must cancel pending requests");
const api=readFileSync("app/api/dashboard/home-summary/route.ts","utf8");
assert(api.includes('private, no-store'),"Sensitive dashboard API response must not be publicly cached");
const automationManager=readFileSync("components/dashboard/AutoRepliesManager.tsx","utf8");
assert(!automationManager.includes('fetch("/api/instagram/accounts"'),"Deletion must not refetch known accounts");
assert(automationManager.includes("writeAutoRepliesCache(activeAccount.id, scope, nextItems)"),
  "Reply deletion and toggle must refresh the current account-and-scope cache");
assert(automationManager.includes("type ReplyScope =") &&
  automationManager.includes("accountId}:${scope}") &&
  automationManager.includes("readAutoRepliesCache(initialAccountId, scope)") &&
  automationManager.includes("readAutoRepliesCache(account.id, scope)") &&
  automationManager.includes("writeAutoRepliesCache(account.id, scope, nextItems)"),
  "Story-only, comment-only, and combined automation responses must not overwrite each other's revisit snapshot");
assert(automationManager.includes("const nextItems = itemsRef.current.map(entry =>") &&
  automationManager.includes("if (activeAccount) writeAutoRepliesCache(activeAccount.id, scope, nextItems);"),
  "A successful Story activation change must update the visible list and its scoped revisit cache");


// The diagnostic must not reuse a potentially stale hydrated Home DOM
// between samples; navigation and history observe URL changes without load.
const revisit=readFileSync("scripts/benchmark-dashboard-revisits.mjs","utf8");
assert(revisit.includes("await context.newPage()"),"Each route must receive an isolated page");
assert(revisit.includes('waitUntil: "commit"'),"Route timing must not await a full load event");
assert(revisit.includes("noWaitAfter: true"),"Link clicks must not await document load");
assert(revisit.includes("returnArtResponses"),"Track artwork events during Home return only");
assert(revisit.includes("failedAt: stage"),"Report per-route failures and continue");
assert(revisit.includes("window.history.back()"),"Use native history for Home return");

const homeSkeleton=readFileSync("components/dashboard/DashboardHomeSkeleton.tsx","utf8");
const overview=readFileSync("components/dashboard/DashboardOverview.tsx","utf8");
assert(homeSkeleton.includes("Array.from({ length: 8 }"),"Home skeleton must reserve all eight live automation tiles");
assert(homeSkeleton.includes('title="مدیریت پیج"'),"Home skeleton heading must match the real Home");
assert(!homeSkeleton.includes('title="ابزارهای تکمیلی"'),"Do not render a removed section in Home skeleton");
assert(overview.includes("const automationTools:"),"Validate skeleton against Home tools");
const repliesSkeleton=readFileSync("components/dashboard/AutoRepliesSkeleton.tsx","utf8");
assert(repliesSkeleton.includes("daira-automation-list-card"),"Automation list skeleton must match live card geometry");
assert(repliesSkeleton.includes("h-14 w-14"),"Automation skeleton must reserve live thumbnails");
assert(repliesSkeleton.includes("Array.from({ length: 1 }") &&
  !repliesSkeleton.includes("Array.from({ length: 3 }"),
  "Cold comment/story skeleton should not reserve three cards before an empty list resolves.");
assert(automationManager.includes("const controller = new AbortController();") &&
  (automationManager.match(/signal: controller\.signal/g) || []).length >= 4 &&
  automationManager.includes("controller.abort();"),
  "Route exit and account switch must abort all four parallel automation list requests.");



console.log("DASHBOARD_HOME_REVISIT_CACHE_OK");
