import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overview = readFileSync("components/dashboard/DashboardOverview.tsx", "utf8");
const skeleton = readFileSync("components/dashboard/DashboardHomeSkeleton.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

assert(overview.includes('className={"daira-home__quick-card daira-home__quick-card--" + tool.key + (status || (summaryStatus === "loading" && tool.key !== "insights")'), "Inbox and publishing cards must reserve a badge slot");
assert(overview.includes('<span>{status.text}</span>'), "Status text should be a separate child of the badge");
const descriptionEnd = overview.indexOf('<span className="daira-home__quick-desc">{tool.description}</span>');
const badgeStart = overview.indexOf('className={"daira-home__status daira-home__status--"');
assert(descriptionEnd !== -1 && badgeStart > descriptionEnd && overview.slice(descriptionEnd,badgeStart).includes("</span>"), "Badge must be outside the card copy");
for (const selector of [".daira-home__account-connected,", ".daira-home__automation-count,", ".daira-home__status {"]) assert(styles.includes(selector), "Missing badge icon-order selector: " + selector);
assert(styles.includes("flex-direction:row-reverse;"), "Badge icon must be visually ahead of its label in RTL");
assert(styles.includes(".daira-home__quick-card--status > :is(.daira-home__status,.daira-home__status-skeleton)"), "Live and loading badges must share pinned placement");
assert(styles.includes("top:10px;") && styles.includes("left:10px;"), "Badges must sit top-left");
assert(styles.includes(".daira-home__quick-card--publishing.daira-home__quick-card--status"), "Mobile publishing must reserve room above image");
assert(styles.includes(".daira-home__quick-card--inbox.daira-home__quick-card--status"), "Mobile inbox must reserve room above text");
assert(skeleton.includes('index === 1 ? " daira-home__quick-card--publishing"'), "Publishing skeleton must match real card");
assert(skeleton.includes('index < 2 ? " daira-home__quick-card--status"'), "Skeleton badges must use pinned slot");
console.log("DASHBOARD_HOME_BADGES_RTL_POSITION_OK");
