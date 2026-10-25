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
assert(automationManager.includes("writeAutoRepliesCache(activeAccount.id, nextItems)"),
  "Reply deletion must invalidate the currently selected account cache");


// The read-only browser diagnostic must not mistake pending "load" events
// for failed client-side route transitions or abort the whole benchmark.
const revisit=readFileSync("scripts/benchmark-dashboard-revisits.mjs","utf8");
assert(revisit.includes("waitForPath(route)"),"Benchmark must await pathname independently of load");
assert(revisit.includes("window.location.pathname === target"),"Benchmark must poll the URL without load-event dependency");
assert(!revisit.includes("page.waitForURL("),"Benchmark must not wait for load after SPA navigation");
assert(revisit.includes("homeReturnArtResponses"),"Art observations should be measured only after Home return");
assert(revisit.includes("failedAt: stage"),"Per-route failures must be reported rather than terminating the run");
assert(revisit.includes("window.history.back()"),"Benchmark must return through native history");

console.log("DASHBOARD_HOME_REVISIT_CACHE_OK");
