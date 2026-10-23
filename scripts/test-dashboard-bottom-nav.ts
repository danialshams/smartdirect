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
  ["/dashboard/reminders/private-id", "ویرایش یادآوری هوشمند"],
  ["/dashboard/unknown/private-id", "صفحه فعلی"],
];

for (const [route, expected] of cases) {
  assert.equal(getDashboardBottomPageTitle(route), expected, "Incorrect breadcrumb at " + route);
}

const shell = readFileSync("components/dashboard/DahboardShell.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");
assert(shell.includes('href="/dashboard" className="daira-bottom-nav__home-link"'), "Home link must remain navigable");
assert(shell.includes('className="daira-bottom-nav__current-page"'), "Current-page title missing");
assert(shell.includes('key={pathname}'), "Page transitions must restart the title animation");
assert(styles.includes("text-overflow:ellipsis"), "Long current-page labels must truncate");
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
console.log("DAIRA_BOTTOM_NAV_BREADCRUMB_OK", cases.length);
