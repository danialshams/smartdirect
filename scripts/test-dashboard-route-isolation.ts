import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const routes = [
  { slug: "inbox", module: "DashboardInboxClient", heavy: "InstagramInbox", mode: "inbox" },
  { slug: "profile", module: "DashboardProfileClient", heavy: "InstagramProfileDashboard", mode: "profile" },
  { slug: "ice-breaker", module: "DashboardIceBreakerClient", heavy: "IceBreakerManager", mode: "ice-breaker" },
  { slug: "persistent-menu", module: "DashboardPersistentMenuClient", heavy: "PersistentMenuManager", mode: "persistent-menu" },
];
const shared = read("components/dashboard/useDashboardPageAccounts.ts");
assert(shared.includes("useDashboardAccountId") && shared.includes("useDashboardAccounts"));
assert(shared.includes("Number(right.id === selectedId) - Number(left.id === selectedId)"));
for (const { slug, module, heavy } of routes) {
  const page = read("app/dashboard/" + slug + "/page.tsx");
  const wrapper = read("components/dashboard/" + module + ".tsx");
  assert(page.includes("import " + module + " from"), slug + ": missing isolated route import");
  assert(page.includes("<" + module + " />"), slug + ": missing route rendering");
  assert(!page.includes("DashboardAccountsClient"), slug + ": generic module still bundled");
  assert(wrapper.includes('import ' + heavy + ' from'), slug + ": expected feature module absent");
  assert(wrapper.includes("useDashboardPageAccounts()"), slug + ": server-verified account hook absent");
  assert(!wrapper.includes('fetch('), slug + ": new blocking network request added");
}
const inbox = read("components/dashboard/DashboardInboxClient.tsx");
const profile = read("components/dashboard/DashboardProfileClient.tsx");
const ice = read("components/dashboard/DashboardIceBreakerClient.tsx");
const persistent = read("components/dashboard/DashboardPersistentMenuClient.tsx");
assert(inbox.includes("accountsLoading={false}"));
assert(ice.includes("accountsLoading={false}"));
assert(persistent.includes("accountsLoading={false}"));
assert(profile.includes("accounts.find((account) => account.isConnected)"));
console.log("DASHBOARD_ROUTE_ISOLATION_OK");
