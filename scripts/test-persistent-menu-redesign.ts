import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePersistentMenuUrl } from "../src/lib/instagram/persistent-menu-url";

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
assert.ok(!menu.includes("پیش‌نمایش منو") && !menu.includes("lg:grid-cols-[minmax(0,1fr)_280px]"),
  "Preview panel and old two-column layout must be removed");
assert.ok(menu.includes('aria-labelledby="persistent-menu-heading"') && menu.includes('id="persistent-menu-heading"'),
  "Menu title must be inside its own semantic styled section");
assert.ok(!menu.includes("RefreshCw") && !menu.includes("به‌روزرسانی منوی دایرکت"),
  "Redundant refresh action must not be displayed");
assert.ok(!menu.includes("گزینهٔ") && menu.includes("گزینه جدید"),
  "Direct-menu labels must use the plain Persian spelling");
assert.ok(menu.includes("items.map((item, index)"), "Existing ordered menu items must remain visible");
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

assert.ok(menu.includes('onBlur={() => setEditor(') && menu.includes('normalizePersistentMenuUrl(editor.url)'),
  "The editor should normalize a link on blur and validate its normalized form");
assert.ok(!menu.includes("آدرس مقصد را با https://") && !menu.includes('placeholder="https://example.com"'),
  "Users should not need to know or type the scheme");
assert.ok(route.includes('const normalizedUrl = isWebUrl ? normalizePersistentMenuUrl(')
  && route.includes('WEB_URL_PREFIX}\${normalizedUrl!}'),
  "The backend must normalize URLs before saving links and Meta payloads");
const validCases: Array<[string, string]> = [
  ["example.com", "https://example.com"],
  ["www.example.com", "https://www.example.com"],
  ["example.com/path?x=1", "https://example.com/path?x=1"],
  ["example.com:8080/test", "https://example.com:8080/test"],
  [" https://example.com/a ", "https://example.com/a"],
  ["http://example.com/path", "http://example.com/path"],
  ["https://Example.com/Case", "https://Example.com/Case"],
  ["//example.com/path", "https://example.com/path"],
];
for (const [input, output] of validCases) {
  assert.equal(normalizePersistentMenuUrl(input), output, "Unexpected URL normalization for " + input);
}
for (const invalid of ["", "not-a-site", "www", "ftp://example.com", "javascript:alert(1)",
  "https://", "https://user:pass@example.com", "example .com"]) {
  assert.equal(normalizePersistentMenuUrl(invalid), null, "Unsafe/invalid URL accepted: " + invalid);
}

console.log("PERSISTENT_MENU_REDESIGN_REGRESSION_OK");
