import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (name: string) => readFileSync(name, "utf8");
const accountContext = file("components/dashboard/DashboardAccountContext.tsx");
const shell = file("components/dashboard/DahboardShell.tsx");
const accountWrapper = file("components/dashboard/DashboardAccountsClient.tsx");
const list = file("components/dashboard/AutoRepliesManager.tsx");
const automationApi = file("app/api/automations/route.ts");
const insights = file("app/dashboard/insights/InsightsDashboard.tsx");
const inboxApi = file("app/api/instagram/inbox/route.ts");
const polling = file("components/dashboard/SupportNotifications.tsx");
const redis = file("src/lib/cache/redis-cache.ts");
const publish = file("components/dashboard/publishing/PublishingDashboardV2.tsx");
const create = file("components/dashboard/AutomationCreationFlow.tsx");
const batches = file("src/lib/automation/batch-messages.ts");

assert(accountContext.includes("export function useDashboardAccounts()") &&
  shell.includes("accounts={instagramAccounts}") &&
  !accountWrapper.includes('fetch("/api/instagram/accounts"'),
  "All dashboard entry points should reuse server-verified account data.");
for (const path of [
  "components/dashboard/DirectAutomationEditor.tsx",
  "components/dashboard/ShareMentionEditor.tsx",
  "components/dashboard/LiveAutomationEditor.tsx",
  "components/dashboard/SmartRemindersList.tsx",
  "components/dashboard/SmartReminderEditor.tsx",
  "components/dashboard/DirectAutomationList.tsx",
  "components/dashboard/LiveAutomationList.tsx",
  "components/dashboard/ShareMentionManager.tsx",
]) {
  assert(!file(path).includes('fetch("/api/instagram/accounts"'),
    path + ": redundant account request should not block first render.");
}
assert(automationApi.includes('searchParams.get("view") === "list"') &&
  automationApi.includes('select: {') &&
  list.includes('&view=list') &&
  list.includes('scope !== "stories" ? fetch('),
  "Automation cards must request metadata and story-only lists must avoid media round-trips.");
assert(insights.includes('const historyUrl =') &&
  insights.includes("syncPromise = (async () =>") &&
  insights.indexOf('syncPromise = (async () =>') < insights.indexOf('const response = await fetch(historyUrl') &&
  insights.includes('void syncPromise.then(async syncWarning =>'),
  "Analytics history must load independently of the slow Meta sync, then revalidate silently.");
assert(inboxApi.includes('const freshConversations = visibleConversations;') &&
  !inboxApi.includes('const freshConversations = await prisma.conversation.findMany') &&
  inboxApi.includes('const [unread, lastInboundRows, handoffMap] = await Promise.all(['),
  "Inbox lists must avoid duplicate queries and execute independent lookups concurrently.");
assert(automationApi.includes('select: { messageType: true }'),
  "Metadata-only DM list must keep its response-type search without nested response graphs.");
assert(redis.includes('const pendingLoads = new Map') &&
  redis.includes('const pending = pendingLoads.get(key);'),
  "Redis cache misses must coalesce inside each process.");
// Each support SSE event must only refresh the visible support-ticket list once.
assert(polling.includes('source.addEventListener("support", () => { window.dispatchEvent(new Event("support:changed")); void load("event"); });') &&
  polling.includes('reason !== "event" && !first && latest && latest.id !== original'),
  "SSE notifications must not duplicate support:changed list revalidation.");
assert(polling.includes('realtimeConnected = true') &&
  polling.includes('!realtimeConnected') &&
  publish.includes('Date.now() - lastIdlePoll < 30_000') &&
  publish.includes('current.hour === nextClock.hour && current.minute === nextClock.minute'),
  "Support SSE and publishing idle states must not continuously poll or trigger redraws.");
assert(batches.includes('prepareAutomationMessages') &&
  batches.includes('instagramAccountId') && batches.includes('userId') &&
  automationApi.includes('messages: { create: preparedMessages }') &&
  create.includes('messages: batchMessages') &&
  publish.includes('messages: preparedMessages'),
  "Create actions must validate and persist nested responses atomically in one request.");
console.log("DASHBOARD_PERFORMANCE_REGRESSION_OK");
