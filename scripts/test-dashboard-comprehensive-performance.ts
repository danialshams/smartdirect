import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const file=(path:string)=>readFileSync(path,"utf8");
const shell=file("components/dashboard/DahboardShell.tsx");
assert(shell.includes('dynamic(() => import("./DashboardOverview")') &&
  shell.includes('loading: () => <DashboardHomeSkeleton />') &&
  !shell.includes('import DashboardOverview from "./DashboardOverview"'),
  "Home-only artwork, counters and cards must be split from every non-home route's shared shell");
assert(shell.includes('<DashboardOverview user={user} instagramAccounts={instagramAccounts} isActive={isHome} />'),
  "The Home retains its existing design, data props and visible-route revalidation gate");

// The shared segment's loading fallback must never render a second Home or
// shell skeleton before the destination route's own loading state.
const dashboardLoading=file("app/dashboard/loading.tsx");
assert(dashboardLoading.includes("export default function DashboardLoading()") &&
  /return\\s+null\\s*;/.test(dashboardLoading) &&
  !dashboardLoading.includes("<DashboardHomeSkeleton") &&
  !dashboardLoading.includes('from "next/navigation"') &&
  !dashboardLoading.includes('className="daira-app-shell"'),
  "Dashboard segment loading fallback must stay silent; never flash generic Home chrome before a page-specific skeleton");
assert(file("app/dashboard/comment-automation/loading.tsx").includes("AutoRepliesRouteLoading") &&
  file("app/dashboard/story-automation/loading.tsx").includes("AutoRepliesRouteLoading") &&
  file("app/dashboard/publishing/loading.tsx").includes('view="create"') &&
  file("app/dashboard/comment-automation/new/loading.tsx").includes("Skeleton"),
  "Existing route-specific skeletons must remain available without an intermediate dashboard fallback");

const automationList=file("components/dashboard/AutoRepliesManager.tsx");
const publishApi=file("app/api/instagram/publishing/route.ts");
assert(automationList.includes('/api/instagram/publishing'+"\\u0024"+'{accountQuery}&view=automation-cards') ||
  automationList.includes('&view=automation-cards'),
  "Automation cards should request a compact publishing view");
assert(publishApi.includes('searchParams.get("view") === "automation-cards" && Boolean(accountId)') &&
  publishApi.includes('select: { type: true, publicUrl: true }') &&
  publishApi.includes('commentAutomationId: true, storyReplyAutomationId: true') &&
  publishApi.includes('commentTriggerKeywords: true, storyReplyTriggerKeywords: true') &&
  publishApi.includes('instagramMediaId: true') &&
  publishApi.includes('const where = { userId: session.user.id'),
  "Compact publication responses must retain card, media verification and tenant ownership fields");
assert(publishApi.includes('include: { media: { orderBy: { sortOrder: "asc" } }, instagramAccount:') &&
  publishApi.includes('after(() => validatePublishedJobsInBackground('),
  "Normal publishing queue and background remote validation behavior must remain unchanged");

const media=file("app/api/instagram/media/route.ts");
const profile=file("app/api/instagram/profile/route.ts");
const history=file("app/api/instagram/insights/history/route.ts");
assert(media.includes("select: { id: true }") &&
  media.includes("userId: session.user.id") && media.includes("isConnected: true"),
  "Media account verification must remain tenant-scoped with a minimal select");
assert(!profile.includes("accessToken: true") &&
  profile.includes("getCachedInstagramProfile(account.id)") &&
  profile.includes("userId: session.user.id"),
  "Cached public profile data should not fetch unneeded token columns");
assert(!history.includes("accessToken: true") &&
  history.includes("userId: session.user.id") &&
  history.includes("instagramInsightSnapshot.findMany"),
  "History lookup must not select Meta tokens");

function collect(dir:string):string[] {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const path=join(dir,entry.name);
    return entry.isDirectory() ? collect(path) : entry.name==="page.tsx" ? [path] : [];
  });
}
const pageRoot=join("app","dashboard");
const pages=collect(pageRoot).map(path=>"/dashboard"+(
  relative(pageRoot,path).split(sep).slice(0,-1).length
   ? "/"+relative(pageRoot,path).split(sep).slice(0,-1).join("/")
   : ""
));
assert.equal(new Set(pages).size,pages.length,"Each dashboard path must be unique");
const staticPages=pages.filter(path=>!path.includes("["));
const dynamicPages=pages.filter(path=>path.includes("["));
assert.equal(pages.length,37,"Expand the coverage inventory when adding dashboard pages");
assert.equal(staticPages.length,29);
assert.equal(dynamicPages.length,8);

const audit=file("scripts/benchmark-full-dashboard.mjs");
assert(audit.includes('const staticRoutes = allRoutes.filter(path => !path.includes("["))') &&
  audit.includes('const dynamicRoutes = allRoutes.filter(path => path.includes("["))') &&
  audit.includes('name: "mobile"') &&
  audit.includes('name: "desktop"') &&
  audit.includes('waitUntil: "domcontentloaded"') &&
  audit.includes("observedCls") &&
  audit.includes("lcpP50Ms") &&
  audit.includes("apiGroupCounts") &&
  audit.includes("imageTransferBytes") &&
  audit.includes("await context.route") &&
  audit.includes('!["GET", "HEAD", "OPTIONS"].includes(request.method())') &&
  audit.includes("storageState: auth"),
  "Read-only authenticated benchmark must inventory all routes, guard mutations and report web metrics");
assert(!audit.includes("request.postData()") &&
  !audit.includes("request.headers()") &&
  !audit.includes("await page.screenshot("),
  "Performance reports must not accidentally persist request bodies or screenshots of private user content");

const appConfig=file("next.config.ts");
const browserAudit=file("scripts/benchmark-full-dashboard.mjs");
const dashboardHeader=file("components/dashboard/DashboardHeader.tsx");
assert(appConfig.includes('source: "/dashboard-art/:path*"') &&
  appConfig.includes('source: "/daira-header-logo-original.png"') &&
  (appConfig.match(/public, max-age=300, s-maxage=3600, stale-while-revalidate=86400/g) || []).length===2 &&
  dashboardHeader.includes('src="/daira-header-logo-original.png"') &&
  dashboardHeader.includes("unoptimized priority"),
  "Reuse public artwork and the exact approved unoptimized logo across pages, never private account media.");
assert(!appConfig.includes('source: "/api/') &&
  !appConfig.includes('source: "/api/instagram/media-proxy'),
  "Public asset cache headers must never cover private APIs or Meta media.");
assert(browserAudit.includes("const artContext = await browser.newContext(") &&
  browserAudit.includes("const cold = await loadPublicArtwork()") &&
  browserAudit.includes("const warm = await loadPublicArtwork()") &&
  browserAudit.includes("artworkCache,") &&
  browserAudit.includes("Intercepting dashboard API requests disables Chromium HTTP cache") &&
  !browserAudit.includes("artContext.route("),
  "Public artwork cache must be measured without route interception, separate from protected route navigation.");

console.log("DASHBOARD_COMPREHENSIVE_PERFORMANCE_GUARDS_OK",{
  allDashboardRoutes:pages.length,staticRoutes:staticPages.length,dynamicRoutes:dynamicPages.length,
});
