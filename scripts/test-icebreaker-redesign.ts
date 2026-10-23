import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (path: string) => readFileSync(path, "utf8");
const ice = load("components/dashboard/IceBreakerManager.tsx");
const menu = load("components/dashboard/PersistentMenuManager.tsx");
const response = load("components/dashboard/EntryPointFlowBuilder.tsx");
const api = load("app/api/instagram/ice-breakers/route.ts");

assert.ok(menu.includes('گزینه جدید <Plus size={17} aria-hidden="true" />'),
  "Direct-menu add icon must follow the label in RTL flex order");
assert.ok(ice.includes('پیام جدید <Plus size={17} aria-hidden="true" />'),
  "Ice-breaker create icon must match the direct-menu action order");

assert.ok(ice.includes('id="ice-breaker-heading"') &&
  ice.includes('aria-labelledby="ice-breaker-heading"') &&
  ice.includes('rounded-2xl border border-[var(--daira-border)] bg-white'),
  "Ice-breaker title must use a dedicated modern themed section");
assert.ok(ice.includes("dairaPalette.guide.background") && ice.includes('className="daira-guide-glass mb-3 flex items-start gap-3 rounded-xl border'),
  "Ice-breaker create/edit guides must use the same design palette as direct menu");
assert.ok(ice.includes("IceBreakerSkeleton") && ice.includes("daira-skeleton__bar") &&
  ice.includes('role="status" aria-label="در حال دریافت پیام‌های شروع گفتگو"'),
  "Ice-breaker loading state must use compact list-shaped skeletons");
assert.ok(!ice.includes("DashboardLoading") && !ice.includes("window.scrollTo({ top: document.body.scrollHeight"),
  "Remove legacy loading spinners and scrolling to page bottom after saving");
assert.ok(!ice.includes("igUsername}") && !ice.includes("پیش‌نمایش"),
  "Do not show account username or preview panel");
assert.ok(ice.includes("const MAX_QUESTIONS = 4;") && ice.includes("const MAX_LENGTH = 80;"),
  "Preserve Instagram ice-breaker constraints");
assert.ok(ice.includes("modernResponseFlow") && ice.includes("onResponseDirtyChange={setResponseDirty}")
  && ice.includes("dirty={canSaveChanges}"),
  "Use the modern reply editor and report meaningful response changes");
assert.ok(ice.includes("const canSaveChanges = !editor?.id || labelChanged || responseDirty;") &&
  ice.includes("const draftReady = Boolean(editor?.label.trim())"),
  "Disable edit Save until a response or message text actually changes");
assert.ok(ice.includes('canSave={draftReady && !saving}') &&
  response.includes('finalSaveDisabled={!dirty || !canSave}'),
  "Prevent empty ice-breaker titles from creating orphaned automations");
assert.ok(ice.includes('role="dialog" aria-modal="true"') &&
  ice.includes('setDeleteTarget(question)'),
  "Confirm destructive actions");
assert.ok(!ice.includes('method: "DELETE"') &&
  ice.includes('items: remaining.map((item)'),
  "Deleting a question should not delete a possibly shared automation");
assert.ok(ice.includes('items: updated.map((item)') &&
  api.includes('await setInstagramIceBreakers(') &&
  api.includes('await deleteInstagramIceBreakers('),
  "Preserve the API and Instagram synchronization contract");
assert.ok(ice.includes("This content is not shown in existing chats") === false,
  "Keep all UX copy in Persian");

console.log("ICEBREAKER_REDESIGN_REGRESSION_OK");
