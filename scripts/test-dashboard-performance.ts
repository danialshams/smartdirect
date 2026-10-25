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

const contentAnalytics = file("components/dashboard/InstagramContentAnalytics.tsx");
assert(contentAnalytics.includes("useDashboardAccountSelection()") &&
  contentAnalytics.includes("username: account.igUsername") &&
  !contentAnalytics.includes('fetch(\n                            "/api/instagram/accounts"') &&
  !contentAnalytics.includes("loadAccounts()") &&
  contentAnalytics.includes("signal: AbortSignal") &&
  contentAnalytics.includes("const controller = new AbortController()") &&
  contentAnalytics.includes("if (!signal.aborted) {") &&
  contentAnalytics.includes("setData(result as AnalyticsData)") &&
  contentAnalytics.includes("return () => controller.abort()") &&
  contentAnalytics.includes('getDashboardListSnapshot<AnalyticsData>("content-analytics:" + accountId)') &&
  contentAnalytics.includes('setDashboardListSnapshot("content-analytics:" + selectedAccountId, [result as AnalyticsData])') &&
  contentAnalytics.includes("const visibleData = loadedAccountId === accountId ? data : null") &&
  contentAnalytics.includes("if (!cached) {") &&
  contentAnalytics.includes("setLoading(!cached)"),
  "Content analytics should use layout-verified account data and abort stale responses rather than blocking on a duplicate accounts API.");

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
assert(polling.includes('connection.addEventListener("support", () => {') &&
  polling.includes('window.dispatchEvent(new Event("support:changed"));') &&
  polling.includes('reason !== "event" && !first && latest && latest.id !== original') &&
  polling.includes("pendingRealtimeRefresh.current = true") &&
  polling.includes('void load("event");'),
  "SSE notifications must be single-dispatch and queue a summary recheck when the first is in-flight.");
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
const publishApi = file("app/api/instagram/publishing/route.ts");
const validationStart = publishApi.indexOf("const [conflict, ownedCover, tracked] = await Promise.all([");
const conflictCheck = publishApi.indexOf("if (conflict) {", validationStart);
const coverCheck = publishApi.indexOf("if (reelOptions?.coverStorageKey && !ownedCover)", validationStart);
const mediaCheck = publishApi.indexOf("const trackedKeys = new Set(tracked.map", validationStart);
assert(validationStart >= 0 && conflictCheck > validationStart && coverCheck > conflictCheck &&
  mediaCheck > coverCheck && publishApi.includes("userId: session.user.id") &&
  publishApi.includes("expiresAt: { gt: validAt }"),
  "Publishing must parallelize independent ownership checks without altering error precedence or media security.");

const automationDetailApi = file("app/api/automations/[id]/route.ts");
assert(automationDetailApi.includes('const needsStoryActivation = nextTriggerType === "STORY_REPLY_KEYWORD" && isActive === true') &&
  automationDetailApi.includes('!needsStoryActivation ? { include: automationInclude } : {}') &&
  automationDetailApi.includes('await activateStoryReply(id, existingAutomation.instagramAccountId)') &&
  automationDetailApi.includes('? await prisma.automation.findUniqueOrThrow({ where: { id }, include: automationInclude })') &&
  automationDetailApi.includes(': updated;'),
  "Regular automation edits must return the updated graph without a redundant Prisma read; story activation still needs its final read.");
// Cached profile images still require per-request ownership checks, but
// the already verified account/token must be reused inside the image resolver.
const mediaProxy = file("app/api/instagram/media-proxy/route.ts");
const helper = mediaProxy.split("async function fetchInstagramImageUrl(")[1]?.split("export async function GET")[0] || "";
assert(helper.includes("accessToken: string") &&
  !helper.includes("prisma.instagramAccount.findFirst") &&
  !helper.includes("getValidInstagramAccessToken") &&
  mediaProxy.includes("userId: session.user.id") &&
  mediaProxy.includes("fetchInstagramImageUrl(\n        accountId,\n        mediaAccessToken!,"),
  "Profile proxy must reuse its authenticated account token without repeating DB/token lookups.");
assert(mediaProxy.includes("private, max-age=300, stale-while-revalidate=60") &&
  mediaProxy.includes("isAllowedInstagramHost(targetUrl.hostname)"),
  "Private image cache and strict allowlist must remain unchanged.");

console.log("DASHBOARD_PERFORMANCE_REGRESSION_OK");
