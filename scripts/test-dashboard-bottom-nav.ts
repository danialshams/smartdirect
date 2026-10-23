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
console.log("DAIRA_BOTTOM_NAV_BREADCRUMB_OK", cases.length);
