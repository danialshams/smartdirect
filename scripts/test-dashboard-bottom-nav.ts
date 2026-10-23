import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDashboardBottomPageTitle } from "../components/dashboard/dashboard-bottom-nav-labels";

const cases: Array<[string, string]> = [
  ["/dashboard", "خانه"],
  ["/dashboard/", "خانه"],
  ["/dashboard/profile", "پروفایل پیج"],
  ["/dashboard/tickets", "پشتیبانی"],
  ["/dashboard/tickets/new", "تیکت جدید"],
  ["/dashboard/tickets/ticket-id", "جزئیات تیکت"],
  ["/dashboard/insights", "تحلیل پیج"],
  ["/dashboard/publishing", "انتشار محتوا"],
  ["/dashboard/publishing/job-id", "ویرایش انتشار محتوا"],
  ["/dashboard/inbox", "صندوق دایرکت"],
  ["/dashboard/comment-automation", "پاسخ خودکار کامنت"],
  ["/dashboard/comment-automation/new", "ایجاد پاسخ خودکار کامنت"],
  ["/dashboard/comment-automation/new/configure", "ایجاد پاسخ خودکار کامنت"],
  ["/dashboard/comment-automation/private-id", "ویرایش پاسخ خودکار کامنت"],
  ["/dashboard/story-automation/private-id", "ویرایش پاسخ خودکار استوری"],
  ["/dashboard/direct-automation/new", "ایجاد پاسخ خودکار دایرکت"],
  ["/dashboard/live-automation/private-id", "ویرایش پاسخ خودکار لایو"],
  ["/dashboard/share-mention", "پاسخ به اشتراک‌گذاری"],
  ["/dashboard/share-mention/", "پاسخ به اشتراک‌گذاری"],
  ["/dashboard/share-mention/new", "ایجاد پاسخ به اشتراک‌گذاری"],
  ["/dashboard/share-mention/private-id", "ویرایش پاسخ به اشتراک‌گذاری"],
  ["/dashboard/reminders/private-id", "ویرایش یادآوری هوشمند"],
  ["/dashboard/unknown/private-id", "صفحه فعلی"],
];

for (const [route, expected] of cases) {
  assert.equal(getDashboardBottomPageTitle(route), expected, "Incorrect breadcrumb at " + route);
}

const shell = readFileSync("components/dashboard/DahboardShell.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");
const shareManager = readFileSync("components/dashboard/ShareMentionManager.tsx", "utf8");
assert(/href="\/dashboard\/share-mention\/new"[^>]*flex-row-reverse/.test(shareManager), "Share create button must match RTL icon ordering of other automation lists");
const picker = readFileSync("components/dashboard/ContentSelectionDialog.tsx", "utf8");
assert(picker.includes("h-[min(92dvh,720px)]") && picker.includes("sm:h-[min(86dvh,720px)]"), "Content picker must have a stable viewport-bounded height across filters");
assert(shell.includes('href="/dashboard" className="daira-bottom-nav__home-link"'), "Home link must remain navigable");
assert(shell.includes('className="daira-bottom-nav__current-page"'), "Current-page title missing");
assert(shell.includes('key={pathname}'), "Page transitions must restart the title animation");
assert(styles.includes("text-overflow:ellipsis"), "Long current-page labels must truncate");
// Glass must be a reversible visual-only experiment; don't change any navigation logic.
assert(shell.includes("daira-bottom-nav--liquid") && shell.includes("daira-bottom-nav-backdrop--liquid"), "Glass dock must be enabled on shell and backdrop");
assert(styles.includes(".daira-bottom-nav--liquid") && styles.includes("backdrop-filter:blur(14px) saturate(116%)"), "Glass surfaces need a lightly transparent backdrop");
assert(shell.includes("daira-header-backdrop--liquid"), "Header backdrop must not occlude glass");
const dashboardHeader = readFileSync("components/dashboard/DashboardHeader.tsx", "utf8");
assert(dashboardHeader.includes("daira-home__header--liquid"), "Main header must share the glass treatment");
assert(styles.includes(".daira-home__header--liquid") && styles.includes(".daira-home__header--liquid .daira-home__back"), "Header frame and controls need coherent glass styling");
assert(styles.includes(".daira-home__header--liquid::after,") && styles.includes(".daira-bottom-nav--liquid::after"), "Under-glass content must disappear gradually inside both bars");
assert(styles.includes("rgba(246,249,254,0) 0%") && styles.includes("rgba(246,249,254,.66) 100%"), "Under-glass content should gradually disappear at the LOWER internal edge");
assert(styles.includes("rgba(255,255,255,.52)") && styles.includes("rgba(249,251,255,.24)"), "Glass overall surface should be slightly clearer");
assert(dashboardHeader.includes('className="daira-home__header-wrap"') && dashboardHeader.includes("daira-liquid-corner-guard--header") && shell.includes("daira-liquid-corner-guard--nav"), "Header guard must share the exact header dimensions and nav guard must remain");
assert(styles.includes(".daira-home__header-wrap .daira-liquid-corner-guard--header") && styles.includes("height:100%;") && styles.includes("z-index:1600"), "Header guard must track the actual rendered header rather than fixed pixel heights");
assert(styles.includes("border-bottom-color:rgba(255,255,255,.97)") && styles.includes("inset 0 -1px 0 rgba(255,255,255,.91)"), "Glass dock must retain a white contour all the way around its bottom edge");
assert(styles.includes("rgba(246,249,254,.82) 100%"), "Header internal lower edge must obscure scrolling cards");
assert(styles.includes(".daira-liquid-corner-guard::before") && styles.includes(".daira-liquid-corner-guard::after"), "Both lower corners need anti-bleed coverage");
assert(styles.includes("circle var(--daira-glass-corner) at top right") && styles.includes("circle var(--daira-glass-corner) at top left"), "Guard masks must cover only outside of the rounded corners");
assert(styles.includes("z-index:1495") && styles.includes("z-index:1600"), "Exterior masks should stay behind each bar and above scrolling content");
assert(styles.includes(".daira-liquid-corner-guard--nav") && styles.includes("--daira-glass-corner:24px"), "Mobile nav corner guard must follow mobile radius");
assert(styles.includes("height:max(8px,env(safe-area-inset-top,0px))") && styles.includes("height:calc(8px + env(safe-area-inset-bottom,0px))"), "Outside the glass, backdrops must only cover safe-area gaps");
assert(!styles.includes("radial-gradient(ellipse at 12% -42%"), "Old colored internal glow must be removed");
assert(styles.includes(".daira-bottom-nav--liquid .daira-bottom-nav__item.is-active"), "Active icon and text need a readable liquid-glass state");
assert(styles.includes(".daira-bottom-nav--liquid .daira-bottom-nav__breadcrumb"), "Inner-page breadcrumb must match liquid-glass dock");
assert(styles.includes(".daira-bottom-nav--liquid .daira-support-nav-badge"), "Support unread badges must stay legible on glass");
assert(styles.includes("@supports not ((backdrop-filter:blur(1px))") && styles.includes("@media(prefers-reduced-transparency:reduce)"), "Glass dock must have transparency accessibility and browser fallbacks");
assert(styles.includes("@media(prefers-reduced-motion:reduce)"), "Reduced-motion support missing");
assert(shell.includes("!isAutomationCreateFlow"), "Existing automation action dock must remain unobstructed");
const overview = readFileSync("components/dashboard/DashboardOverview.tsx", "utf8");
assert(shell.includes('icon: Headset'), "Support tab must use the headset icon");
assert(shell.includes('dir="ltr" className="daira-bottom-nav__breadcrumb"'), "Breadcrumb must be left-to-right");
assert(shell.includes("<ChevronRight"), "Separator must point in the left-to-right direction");
assert(styles.includes(".daira-bottom-nav__breadcrumb { direction:ltr;"), "Breadcrumb CSS must be left-to-right");
assert.equal((overview.match(/<section className="daira-home__section"/g) || []).length, 2, "Dashboard must have exactly two tool sections");
assert(overview.includes(">پاسخ‌های هوشمند</h2>"), "Smart responses section must be present");
assert(overview.includes(">مدیریت پیج</h2>"), "Page management section must be present");
assert(!overview.includes("دسترسی سریع</h2>") && !overview.includes(">ابزارهای تکمیلی</h2>"), "Old homepage headings must be removed");
const toolKeys = ["comment", "story", "direct", "live", "menu", "icebreaker", "reminders"];
for (const key of toolKeys) {
  assert(overview.includes(`{ key: "${key}"`), `Missing smart response tool: ${key}`);
}
assert(!overview.includes("extraTools.map"), "Supplementary tools must appear within smart responses");
assert(styles.includes(".daira-home__tool-grid--automation .daira-home__tool-card:last-child:nth-child(odd)"), "Odd mobile row should span both columns");
assert(shell.includes('className="daira-bottom-nav__center"'), "Both navigation states must share a persistent parent");
assert(shell.includes("aria-hidden={!isHome}") && shell.includes("aria-hidden={isHome}"), "Inactive navigation should be hidden to screen readers");
assert(shell.includes("tabIndex={isHome ? 0 : -1}") && shell.includes("tabIndex={isHome ? -1 : 0}"), "Only the visible home link may take keyboard focus");
assert(styles.includes(".daira-bottom-nav__center-home { position:absolute;"), "Home view must stay mounted through a reverse transition");
assert(styles.includes(".daira-bottom-nav--contextual .daira-bottom-nav__breadcrumb { opacity:1;"), "Breadcrumb must be visible on inner pages");
assert(styles.includes(".daira-bottom-nav__breadcrumb { direction:ltr;position:absolute;"), "Breadcrumb must not pop during navigation");
assert(styles.includes("420ms cubic-bezier(.22,1,.36,1)"), "Breadcrumb transition must be smooth");
assert(styles.includes(".daira-bottom-nav__center-home, .daira-bottom-nav__breadcrumb { transition:none; }"), "Reduced motion must disable both transitions");
console.log("DAIRA_BOTTOM_NAV_BREADCRUMB_OK", cases.length);
