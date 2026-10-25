/**
 * Read-only dashboard navigation benchmark. No mutations or external telemetry.
 * Run on an authenticated production-like build:
 *   npm i --no-save playwright
 *   npx playwright install chromium
 *   SMARTDIRECT_BASE_URL=https://your-site.example SMARTDIRECT_STORAGE_STATE=.local-auth.json node scripts/benchmark-dashboard-navigation.mjs
 *
 * Storage state contains credentials: never commit or publish it.
 */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const base = process.env.SMARTDIRECT_BASE_URL;
const auth = process.env.SMARTDIRECT_STORAGE_STATE;
if (!base || !auth) {
  console.error("Set SMARTDIRECT_BASE_URL and SMARTDIRECT_STORAGE_STATE (Playwright storageState JSON).");
  process.exit(2);
}
const origin = new URL(base).origin;
const routes = [
  "/dashboard",
  "/dashboard/insights",
  "/dashboard/inbox",
  "/dashboard/publishing",
  "/dashboard/comment-automation",
  "/dashboard/story-automation",
  "/dashboard/tickets",
];
const runs = Math.max(1, Math.min(10, Number(process.env.SMARTDIRECT_BENCH_RUNS || 3)));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: auth, viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const entries = [];
const percentile = (arr, p) => arr.length ? arr.slice().sort((a,b)=>a-b)[Math.ceil(p*arr.length)-1] : null;
const snapshot = async () => page.evaluate(() => {
  const n = performance.getEntriesByType("navigation")[0];
  return { url: location.pathname, domContentLoadedMs: n ? Math.round(n.domContentLoadedEventEnd - n.startTime) : null,
    loadMs: n ? Math.round(n.loadEventEnd - n.startTime) : null,
    transferBytes: n?.transferSize ?? null };
});
try {
  for (let iteration = 0; iteration < runs; iteration++) {
    for (const route of routes) {
      const started = Date.now();
      const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("body").waitFor();
      const metrics = await snapshot();
      entries.push({ iteration, route, mode: "document-navigation",
        elapsedMs: Date.now() - started, status: response?.status() ?? null, ...metrics });
      if (page.url().includes("/login")) throw new Error("Auth redirected to /login. Provide valid storageState.");
    }
    // Measure SPA transitions only where genuine Next.js links exist in the rendered DOM.
    await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
    for (const route of routes.slice(1)) {
      const link = page.locator('a[href="' + route + '"]').first();
      if (await link.count() === 0) {
        entries.push({ iteration, route, mode: "client-navigation", skipped: "No visible matching link on dashboard" });
        continue;
      }
      const started = Date.now();
      await link.click({ timeout: 10000 });
      await page.waitForURL(url => url.pathname === route, { timeout: 15000 });
      entries.push({ iteration, route, mode: "client-navigation", urlChangeMs: Date.now() - started,
        caveat: "URL change is not content-ready or data-ready time" });
      await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
    }
  }
  const aggregate = routes.map(route => {
    const values = entries.filter(e => e.route === route && e.mode === "document-navigation" && e.elapsedMs != null).map(e => e.elapsedMs);
    return { route, samples: values.length, p50Ms: percentile(values, .5), p95Ms: percentile(values, .95) };
  });
  await mkdir("performance-results", { recursive: true });
  const path = "performance-results/dashboard-navigation-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await writeFile(path, JSON.stringify({ measuredAt: new Date().toISOString(), origin, viewport: "390x844", runs, aggregate, entries }, null, 2));
  console.log(JSON.stringify({ path, aggregate }, null, 2));
} finally {
  await browser.close();
}
