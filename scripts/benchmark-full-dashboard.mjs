/**
 * Authenticated dashboard navigation + resource audit.
 *
 * Usage (run in a secured test session, no secrets in output):
 * SMARTDIRECT_BASE_URL=https://smartdirect.vercel.app
 * SMARTDIRECT_STORAGE_STATE=.local-auth.json
 * SMARTDIRECT_AUDIT_RUNS=2
 * node scripts/benchmark-full-dashboard.mjs
 *
 * Records every static dashboard route for mobile + desktop and inventories
 * dynamic routes separately. GET-only page navigation; blocks HTTP mutations.
 * This does not benchmark create/edit/send/upload or Meta completion times.
 */
import { chromium } from "playwright";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const base = process.env.SMARTDIRECT_BASE_URL;
const auth = process.env.SMARTDIRECT_STORAGE_STATE;
if (!base || !auth) {
  console.error("Set SMARTDIRECT_BASE_URL and SMARTDIRECT_STORAGE_STATE.");
  process.exit(2);
}
const origin = new URL(base).origin;
const runs = Math.max(1, Math.min(5, Number(process.env.SMARTDIRECT_AUDIT_RUNS || 2)));
if (!Number.isInteger(runs)) throw new Error("Invalid SMARTDIRECT_AUDIT_RUNS");
const reportRoot = "performance-results";
const routeRoot = join("app", "dashboard");
async function pages(dir) {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) result.push(...await pages(p));
    else if (e.isFile() && e.name === "page.tsx") result.push(p);
  }
  return result;
}
function toPath(file) {
  const directory = relative(routeRoot, file).split(sep).slice(0, -1);
  return "/dashboard" + (directory.length ? "/" + directory.join("/") : "");
}
const allRoutes = (await pages(routeRoot)).map(toPath).sort();
const staticRoutes = allRoutes.filter(path => !path.includes("["));
const dynamicRoutes = allRoutes.filter(path => path.includes("["));
function percentile(data, fraction) {
  const sorted = data.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;
}
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const records = [];
const profiles = [
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true },
  { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false },
];
const waitMs = Math.max(500, Math.min(2500, Number(process.env.SMARTDIRECT_AUDIT_OBSERVE_MS || 900)));

// Never include raw API URL, path params, query strings, account names,
// cookies, response bodies or header values in this report.
function apiGroup(url) {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean);
    if (p[0] !== "api") return null;
    const group = p[1] || "root";
    const safe = new Set(["instagram", "dashboard", "automations", "live-automation", "smart-reminders",
      "share-mention", "direct-automation", "forms", "showcases", "saved-responses",
      "storage", "subscription", "admin", "auth", "other"]);
    return "/api/" + (safe.has(group) ? group : "other");
  } catch { return null; }
}
function summarize(records, profile, route) {
  const rows = records.filter(r => r.profile === profile && r.route === route && r.status === "ok");
  return {
    route,
    profile,
    successfulRuns: rows.length,
    attemptedRuns: records.filter(r => r.profile === profile && r.route === route).length,
    firstMainP50Ms: percentile(rows.map(r => r.firstMainMs), 0.5),
    firstMainP95Ms: percentile(rows.map(r => r.firstMainMs), 0.95),
    ttfbP50Ms: percentile(rows.map(r => r.ttfbMs), 0.5),
    lcpP50Ms: percentile(rows.map(r => r.lcpMs), 0.5),
    observedClsMax: rows.length ? Math.max(...rows.map(r => r.observedCls || 0)) : null,
    apiRequestsP50: percentile(rows.map(r => r.apiRequests), 0.5),
    imageBytesTransferredP50: percentile(rows.map(r => r.imageTransferBytes), 0.5),
  };
}
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      storageState: auth, viewport: profile.viewport, isMobile: profile.isMobile,
      reducedMotion: "no-preference",
    });
    // Render measurements must not create/delete/send/publish data. Some app
    // pages may trigger side-effect APIs on mount; abort non-GET API calls.
    await context.route("**/api/**", async route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && apiGroup(request.url()) && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        await route.abort("blockedbyclient");
      } else {
        await route.continue();
      }
    });
    try {
      for (let round = 0; round < runs; round++) {
        for (const route of staticRoutes) {
          const page = await context.newPage();
          await page.addInitScript(() => {
            window.__sdAudit = { lcp: null, layoutShifts: [] };
            try {
              new PerformanceObserver(list => {
                for (const entry of list.getEntries()) window.__sdAudit.lcp = Math.round(entry.startTime);
              }).observe({ type: "largest-contentful-paint", buffered: true });
            } catch {}
            try {
              new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                  if (!entry.hadRecentInput) window.__sdAudit.layoutShifts.push({
                    t: entry.startTime, score: entry.value,
                  });
                }
              }).observe({ type: "layout-shift", buffered: true });
            } catch {}
          });
          const started = Date.now();
          try {
            const response = await page.goto(origin + route, {
              waitUntil: "domcontentloaded", timeout: 20000,
            });
            const finalPath = new URL(page.url()).pathname;
            if (!response?.ok() || finalPath !== route) {
              records.push({ profile: profile.name, round, route, status: "skipped-or-redirected",
                httpStatus: response?.status() ?? null, actualPath: finalPath === route ? "requested" : "other" });
              continue;
            }
            await page.locator("main").first().waitFor({ state: "visible", timeout: 12000 });
            const firstMainMs = Date.now() - started;
            await page.waitForTimeout(waitMs);
            const metrics = await page.evaluate(() => {
              const nav = performance.getEntriesByType("navigation")[0];
              const resources = performance.getEntriesByType("resource");
              const requests = resources.filter(r => r.initiatorType === "fetch" ||
                r.initiatorType === "xmlhttprequest");
              const images = resources.filter(r => r.initiatorType === "img" ||
                r.name.includes("/dashboard-art/") || r.name.includes("%2Fdashboard-art%2F"));
              // CLS session window, maximum 5 seconds with <=1-second gaps.
              const shifts = window.__sdAudit?.layoutShifts || [];
              let cls = 0;
              for (let i = 0; i < shifts.length; i++) {
                let sum = shifts[i].score, previous = shifts[i].t;
                for (let j = i + 1; j < shifts.length; j++) {
                  if (shifts[j].t - previous > 1000 || shifts[j].t - shifts[i].t > 5000) break;
                  sum += shifts[j].score; previous = shifts[j].t;
                }
                cls = Math.max(cls, sum);
              }
              return {
                ttfbMs: nav ? Math.round(nav.responseStart - nav.startTime) : null,
                fcpMs: performance.getEntriesByType("paint")
                  .find(r => r.name === "first-contentful-paint")?.startTime ?? null,
                lcpMs: window.__sdAudit?.lcp ?? null,
                observedCls: Number(cls.toFixed(6)),
                apiRequests: requests.length,
                imageResponses: images.length,
                imageTransferBytes: Math.round(images.reduce((sum, r) => sum + (r.transferSize || 0), 0)),
              };
            });
            const apiCounts = {};
            for (const entry of await page.evaluate(() =>
              performance.getEntriesByType("resource")
                .filter(r => r.initiatorType === "fetch" || r.initiatorType === "xmlhttprequest")
                .map(r => r.name))) {
              const key = apiGroup(entry);
              if (key) apiCounts[key] = (apiCounts[key] || 0) + 1;
            }
            records.push({ profile: profile.name, round, route, status: "ok",
              httpStatus: response.status(), firstMainMs, ...metrics, apiGroupCounts: apiCounts });
            console.log("AUDIT " + profile.name + " #" + round + " " + route +
              " main=" + firstMainMs + "ms cls=" + metrics.observedCls +
              " api=" + metrics.apiRequests);
          } catch (error) {
            records.push({ profile: profile.name, round, route, status: "failed",
              errorType: error instanceof Error ? error.name : "UnknownError" });
            console.warn("AUDIT_FAILED " + profile.name + " " + route);
          } finally {
            await page.close().catch(() => {});
          }
        }
      }
    } finally {
      await context.close();
    }
  }

  const aggregate = profiles.flatMap(profile =>
    staticRoutes.map(route => summarize(records, profile.name, route)));
  const report = {
    kind: "browser-page-navigation-read-only-guarded",
    measuredAt: new Date().toISOString(), origin,
    totalKnownPageRoutes: allRoutes.length, staticRoutesTested: staticRoutes.length,
    dynamicRoutesNotTested: dynamicRoutes,
    profiles: profiles.map(p => p.name), runsPerProfile: runs,
    caveats: [
      "Authenticated storageState must be provided locally, never checked into source control.",
      "Client non-GET API calls are blocked, so some page readiness may differ from normal user operation.",
      "GET handlers may themselves synchronize Meta or update server-side caches; this is not guaranteed side-effect-free.",
      "Dynamic :id pages need account-specific fixture IDs and are reported as not tested.",
      "First visible main includes shell/skeleton; not proof of usable data readiness.",
      "Observed LCP/CLS use a bounded sampling window and are not CrUX field Core Web Vitals.",
      "An image response/resource entry is not proof of a cache miss; transferSize is best-effort.",
      "No create, edit, delete, send, publish or upload completion latency measured.",
    ],
    aggregate, records,
  };
  await mkdir(reportRoot, { recursive: true });
  const filename = reportRoot + "/dashboard-full-route-audit-" +
    new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await writeFile(filename, JSON.stringify(report, null, 2));
  console.log("RESULT " + filename);
  console.table(aggregate);
} finally {
  await browser.close();
}
