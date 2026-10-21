import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const menu = read("components/dashboard/PersistentMenuManager.tsx");
const builder = read("components/dashboard/EntryPointFlowBuilder.tsx");
const setup = read("components/dashboard/publishing/PublishingStoryAutomationSetup.tsx");
const route = read("app/api/instagram/persistent-menu/route.ts");

assert.ok(menu.includes("dairaPalette.guide.background") && menu.includes("var(--daira-primary)"),
  "Menu needs Daira guide colors and the current design tokens");
assert.ok(menu.includes("MenuSkeleton") && menu.includes('role="status" aria-label="در حال دریافت گزینه‌های منوی دایرکت"'),
  "Menu loading should use a shaped skeleton instead of a spinner");
assert.ok(menu.includes('id="persistent-menu-editor"') && menu.includes('rounded-2xl border border-[var(--daira-border)]'),
  "Editor must be embedded into the modern responsive page");
assert.ok(menu.includes("پیش‌نمایش منو") && menu.includes("items.map((item, index)"),
  "Menu should provide a live list and preview");
assert.ok(menu.includes('modernResponseFlow') && menu.includes('responseTypeTitle="نوع پاسخ"'),
  "Menu must use the same response-selection flow as story automation");
assert.ok(builder.includes('storyCreateMode={modernResponseFlow}') && setup.includes("<StoryReplyFormEditor"),
  "Menu response flow should support the modern nested branching form editor");
assert.ok(menu.includes('canSave={draftReady && !saving}') && builder.includes('finalSaveDisabled={!dirty || !canSave}'),
  "Incomplete title should not create an orphaned response automation");
assert.ok(menu.includes('type: draft.type') && menu.includes('url: draft.type === "web_url"'),
  "Editing URL and reply actions should be driven from local draft state");
assert.ok(!menu.includes('window.scrollTo({ top: document.body.scrollHeight'),
  "Saving must not forcibly scroll the page");
assert.ok(menu.includes('setDeleteTarget(item)') && menu.includes('role="dialog" aria-modal="true"'),
  "Menu deletion should require accessible confirmation");
assert.ok(menu.includes('if (!response.ok || !result.success)') && menu.includes('await loadItems(true)'),
  "The list should refresh only following successful backend synchronization");
assert.ok(route.includes('await setInstagramPersistentMenu(') && route.includes('await deleteInstagramPersistentMenu('),
  "Menu synchronization to Instagram must be preserved");
console.log("PERSISTENT_MENU_REDESIGN_REGRESSION_OK");
