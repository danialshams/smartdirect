/**
 * Read-only follow-up diagnostic after the October 25 dashboard baseline.
 * Uses the full Chromium browser already installed (no headless-shell download).
 * No application code, account data, cookies, text, or URLs containing queries
 * are sent or written to this report.
 *
 * SMARTDIRECT_BASE_URL=https://example.test
 * SMARTDIRECT_STORAGE_STATE=.local-auth.json
 * SMARTDIRECT_DIAGNOSTIC_RUNS=5
 * node scripts/benchmark-dashboard-diagnostics.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.SMARTDIRECT_BASE_URL;
const auth = process.env.SMARTDIRECT_STORAGE_STATE;
if (!base || !auth) {
  console.error("Set SMARTDIRECT_BASE_URL and SMARTDIRECT_STORAGE_STATE.");
  process.exit(2);
}
const origin = new URL(base).origin;
const runs = Math.max(2, Math.min(10, Number(process.env.SMARTDIRECT_DIAGNOSTIC_RUNS || 5)));
const docRoutes = [
  "/dashboard",
  "/dashboard/comment-automation",
  "/dashboard/story-automation",
  "/dashboard/inbox",
  "/dashboard/insights",
  "/dashboard/publishing",
  "/dashboard/tickets",
];
const spaRoutes = [
  "/dashboard/comment-automation",
  "/dashboard/story-automation",
  "/dashboard/inbox",
  "/dashboard/insights",
  "/dashboard/publishing",
  "/dashboard/tickets",
];
const percentile = (list, p) => {
  const values = [...list].filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  return values.length ? values[Math.ceil(p * values.length) - 1] : null;
};
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  storageState: auth, viewport: { width: 390, height: 844 },
  reducedMotion: "no-preference"
});
const page = await context.newPage();
const results = [];
await page.addInitScript(() => {
  // Store structural shift sources only. No user text or element identifiers.
  window.__smartdirectPerf = { lcp: null, shifts: [] };
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__smartdirectPerf.lcp = Math.round(e.startTime);
    }).observe({type: "largest-contentful-paint", buffered: true});
  } catch {}
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        const sources = (e.sources || []).slice(0, 3).map(s => {
          const n = s.node;
          if (!n || n.nodeType !== 1) return {tag: "unknown"};
          return {
            tag: n.tagName.toLowerCase(),
            className: (n.classList?.[0] || "").slice(0, 75),
            previousY: Math.round(s.previousRect?.y ?? 0),
            currentY: Math.round(s.currentRect?.y ?? 0),
            previousHeight: Math.round(s.previousRect?.height ?? 0),
            currentHeight: Math.round(s.currentRect?.height ?? 0),
          };
        });
        window.__smartdirectPerf.shifts.push({
          atMs: Math.round(e.startTime),
          score: Number(e.value.toFixed(6)),
          sources
        });
      }
    }).observe({type: "layout-shift", buffered: true});
  } catch {}
});
async function openHome() {
  const response = await page.goto(origin + "/dashboard", {waitUntil: "domcontentloaded", timeout: 30000});
  if (!response?.ok() || new URL(page.url()).pathname !== "/dashboard") {
    throw new Error("Home not accessible with provided test account (status " + response?.status() + ")");
  }
  // A mere DOMContentLoaded is too early; the first benchmark skipped almost
  // all home tool links because account/context hydration had not finished.
  const cards = page.locator("a.daira-home__tool-card, a.daira-home__quick-card");
  try {
    await cards.first().waitFor({state: "visible", timeout: 16000});
    return {ready: true, cardCount: await cards.count()};
  } catch {
    return {ready: false, cardCount: await cards.count()};
  }
}
try {
  for (let round = 0; round < runs; round++) {
    for (const route of docRoutes) {
      const start = Date.now();
      const response = await page.goto(origin + route, {waitUntil: "domcontentloaded", timeout: 30000});
      await page.locator("main").first().waitFor({state: "visible", timeout: 15000});
      const firstMainMs = Date.now() - start;
      if (!response?.ok() || new URL(page.url()).pathname !== route) {
        throw new Error("Unexpected status/redirect on " + route + " (" + response?.status() + ")");
      }
      await page.waitForLoadState("load", {timeout: 20000}).catch(() => {});
      await page.waitForTimeout(1200);
      const timing = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0];
        const fetches = performance.getEntriesByType("resource").filter(e =>
          e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest");
        const shifts = window.__smartdirectPerf?.shifts || [];
        return {
          ttfbMs: n ? Math.round(n.responseStart - n.startTime) : null,
          domContentLoadedMs: n ? Math.round(n.domContentLoadedEventEnd - n.startTime) : null,
          lcpMs: window.__smartdirectPerf?.lcp ?? null,
          // Summed shift scores over the short observation window; not necessarily
          // a full Core Web Vitals max-session-window CLS score.
          observedCls: Number(shifts.reduce((sum, s) => sum + s.score, 0).toFixed(6)),
          shifts: shifts.slice(0, 20),
          fetchCount: fetches.length,
          slowestFetchMs: fetches.length ? Math.round(Math.max(...fetches.map(e => e.duration))) : null,
        };
      });
      results.push({round, mode: "document", route, firstMainMs, ...timing});
      console.log("DOC " + round + " " + route + " TTFB=" + timing.ttfbMs +
        "ms LCP=" + timing.lcpMs + "ms CLS=" + timing.observedCls);
    }

    for (const route of spaRoutes) {
      const home = await openHome();
      if (!home.ready) {
        results.push({round, mode: "spa", route,
          skipped: "Home tool cards did not appear after hydration (check active Instagram account)"});
        continue;
      }
      const link = page.locator('a[href="' + route + '"]').first();
      if (!(await link.count()) || !(await link.isVisible())) {
        results.push({round, mode: "spa", route, skipped: "No visible exact link after home hydration"});
        continue;
      }
      const initialMainText = await page.locator("main").first().innerText();
      const start = Date.now();
      await link.click({timeout: 10000});
      await page.waitForURL(url => url.pathname === route, {timeout: 15000});
      const urlChangeMs = Date.now() - start;
      let textChangeMs = null;
      try {
        await page.waitForFunction(previous => {
          const main = document.querySelector("main");
          return main && main.innerText.trim().length > 0 && main.innerText !== previous;
        }, initialMainText, {timeout: 12000});
        textChangeMs = Date.now() - start;
      } catch {}
      results.push({
        round, mode: "spa", route, urlChangeMs, textChangeMs,
        note: "Text change is not a reliable data-ready marker",
      });
      console.log("SPA " + round + " " + route + " url=" + urlChangeMs + "ms text=" + textChangeMs + "ms");
    }
  }
  const summary = docRoutes.map(route => {
    const docs = results.filter(r => r.mode === "document" && r.route === route);
    const spa = results.filter(r => r.mode === "spa" && r.route === route);
    const stats = (rows, key) => ({
      samples: rows.filter(r => Number.isFinite(r[key])).length,
      p50: percentile(rows.map(r => r[key]), .5),
      p95: percentile(rows.map(r => r[key]), .95),
    });
    return {
      route,
      ttfbMs: stats(docs, "ttfbMs"),
      firstMainMs: stats(docs, "firstMainMs"),
      lcpMs: stats(docs, "lcpMs"),
      observedCls: stats(docs, "observedCls"),
      spaUrlChangeMs: stats(spa, "urlChangeMs"),
      spaTextChangeMs: stats(spa, "textChangeMs"),
    };
  });
  const report = {
    measuredAt: new Date().toISOString(),
    origin, viewport: "390x844", runs,
    caveat: "5-run p95 is the maximum observation; text change and visible main are not data-ready metrics.",
    summary, results,
  };
  await mkdir("performance-results", {recursive: true});
  const output = "performance-results/dashboard-diagnostics-" +
    new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log("DIAGNOSTIC_RESULT=" + output);
  console.table(summary.map(r => ({
    route: r.route, ttfbP50: r.ttfbMs.p50, lcpP50: r.lcpMs.p50,
    clsP50: r.observedCls.p50, spaP50: r.spaUrlChangeMs.p50
  })));
} finally {
  await browser.close();
}
