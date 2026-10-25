import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getDashboardListSnapshot, setDashboardListSnapshot, clearDashboardListSnapshot,
  DASHBOARD_LIST_MEMORY_TTL_MS,
} from "../src/lib/dashboard/list-snapshot-cache";

const now=1_000_000;
const a="dm-rules:qa-a", b="dm-rules:qa-b", c="smart-reminders:qa-a";
assert.equal(getDashboardListSnapshot(a,now),null);
setDashboardListSnapshot(a,[{id:"one",isActive:true}],now);
setDashboardListSnapshot(b,[{id:"two",isActive:false}],now);
setDashboardListSnapshot(c,[],now);
assert.deepEqual(getDashboardListSnapshot(a,now+50),[{id:"one",isActive:true}]);
assert.deepEqual(getDashboardListSnapshot(b,now+50),[{id:"two",isActive:false}]);
assert.deepEqual(getDashboardListSnapshot(c,now+50),[],"An empty list must be a valid cached snapshot");
const read=getDashboardListSnapshot<{id:string}>(a,now+50)!;
read.pop();
assert.equal(getDashboardListSnapshot(a,now+50)?.length,1,"Returned arrays must not mutate cached snapshots");
assert.equal(getDashboardListSnapshot(a,now+DASHBOARD_LIST_MEMORY_TTL_MS),null,"Cache must expire");
assert.equal(getDashboardListSnapshot(b,now-1),null,"Clock skew must expire");
for(let i=0;i<27;i++)setDashboardListSnapshot("qa:"+i,[i],now);
assert.equal(getDashboardListSnapshot("qa:0",now),null,"Bounded eviction");
assert.deepEqual(getDashboardListSnapshot("qa:26",now),[26]);
clearDashboardListSnapshot("qa:26");
assert.equal(getDashboardListSnapshot("qa:26",now),null,"Explicit invalidation");

const file=(p:string)=>readFileSync(p,"utf8");
for(const path of [
  "components/dashboard/DirectAutomationList.tsx",
  "components/dashboard/SmartRemindersList.tsx",
  "components/dashboard/ShareMentionManager.tsx",
]){
  const content=file(path);
  assert(content.includes("getDashboardListSnapshot"),path+" must restore on revisit");
  assert(content.includes("setDashboardListSnapshot"),path+" must update after successful fetches and writes");
  assert(content.includes('cache: "no-store"')||content.includes('cache:"no-store"'),
    path+" API requests must revalidate against the server");
  assert(content.includes("controller.abort()"),path+" must cancel old account reads");
}
const flow=file("components/dashboard/AutomationCreationFlow.tsx");
const helper=file("src/lib/dashboard/automation-read.ts");
assert(flow.split("readAccountAutomations(account.id)").length===3,
  "Comment automation builder's two GET consumers must share a pending request");
assert(helper.includes("const pending = new Map") && helper.includes("pending.delete(accountId)"),
  "Automation in-flight requests must not persist after response");
assert(helper.includes('cache: "no-store"') && helper.includes('credentials: "include"'),
  "API authorization and no-store policy must be preserved");
console.log("DASHBOARD_LIST_REVISIT_AND_COALESCING_OK");
