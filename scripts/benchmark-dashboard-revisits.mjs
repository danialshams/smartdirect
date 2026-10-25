/**
 * Read-only SPA revisit and artwork-request diagnostic using installed Chromium.
 * NO publish/send/create/edit/delete actions are performed.
 *
 * SMARTDIRECT_BASE_URL=https://smartdirect.vercel.app
 * SMARTDIRECT_STORAGE_STATE=.local-auth.json
 * node scripts/benchmark-dashboard-revisits.mjs
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
const loops = Math.max(1, Math.min(5, Number(process.env.SMARTDIRECT_REVISIT_RUNS || 2)));
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({ storageState: auth, viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const cardSelector = "a.daira-home__tool-card, a.daira-home__quick-card";
const records = [];
const imageResponses = [];

page.on("response", response => {
  const url = response.url();
  // Never persist URLs, query strings, account IDs, message content or cookies.
  if (url.includes("/dashboard-art/") || url.includes("%2Fdashboard-art%2F")) {
    imageResponses.push({ status: response.status() });
  }
});

async function waitForPath(path, timeout = 16000) {
  // A URL change can be complete while the page's load event is still pending.
  // Unlike waitForURL's default waitUntil:"load", this measures the route change.
  await page.waitForFunction(target => window.location.pathname === target, path, { timeout });
}

async function waitForHomeCards() {
  // The dashboard renders cards only after account state has hydrated.
  await page.locator(cardSelector).first().waitFor({ state: "visible", timeout: 16000 });
}

async function openHome() {
  const response = await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!response?.ok() || new URL(page.url()).pathname !== "/dashboard") {
    throw new Error("Dashboard requires a valid test-user session");
  }
  await waitForHomeCards();
}

try {
  await openHome();
  // Give initially visible static artwork an opportunity to settle. Never
  // count delayed first-load responses as evidence of a back-navigation refetch.
  await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  const routes = [...new Set(await page.locator(cardSelector).evaluateAll(nodes =>
    nodes.map(node => node.getAttribute("href")).filter(Boolean)
  ))].filter(path => path.startsWith("/dashboard/"));
  if (!routes.length) throw new Error("No dashboard tool links were available");

  for (let loop = 0; loop < loops; loop++) {
    for (const route of routes) {
      let stage = "home";
      try {
        if (new URL(page.url()).pathname !== "/dashboard") await openHome();
        await waitForHomeCards();

        const link = page.locator(cardSelector + '[href="' + route + '"]').first();
        if (!await link.isVisible()) {
          records.push({ loop, route, skipped: "No visible dashboard card" });
          continue;
        }

        stage = "outbound";
        const beforeText = await page.locator("main").first().innerText();
        const started = Date.now();
        // Wait only for the pathname. Waiting for the load event led to a
        // 20-second timeout even after the target URL had already changed.
        await Promise.all([
          waitForPath(route),
          link.click({ timeout: 10000 }),
        ]);
        const routeUrlMs = Date.now() - started;
        let routeTextMs = null;
        try {
          await page.waitForFunction(oldText => {
            const main = document.querySelector("main");
            return Boolean(main && main.innerText.trim() && main.innerText !== oldText);
          }, beforeText, { timeout: 7500 });
          routeTextMs = Date.now() - started;
        } catch {
          // A text change is not a data-ready condition and can be absent.
        }

        stage = "return";
        const firstReturnImageResponse = imageResponses.length;
        const returnAt = Date.now();
        // Native history return avoids page.goBack waiting for an unrelated
        // document lifecycle event. Next's client router handles popstate.
        await page.evaluate(() => window.history.back());
        await waitForPath("/dashboard");
        await waitForHomeCards();
        const homeReturnMs = Date.now() - returnAt;

        // Observe images after return without including this delay in timing.
        await page.waitForTimeout(400);
        const homeReturnArtResponses = imageResponses.length - firstReturnImageResponse;
        const record = { loop, route, routeUrlMs, routeTextMs, homeReturnMs, homeReturnArtResponses };
        records.push(record);
        console.log("REVISIT " + route + " loop=" + loop +
          " route=" + routeUrlMs + "ms home=" + homeReturnMs +
          "ms homeArtResponses=" + homeReturnArtResponses);
      } catch (error) {
        // Report a failed route and keep checking other routes. Do not record
        // error messages, which can contain sensitive navigation URLs.
        const errorType = error instanceof Error ? error.name : "UnknownError";
        records.push({ loop, route, failedAt: stage, errorType });
        console.warn("REVISIT_FAILED " + route + " loop=" + loop + " stage=" + stage + " error=" + errorType);
        try {
          await openHome();
        } catch {
          // If recovery fails, the next route will try to reopen Home.
        }
      }
    }
  }

  const byRoute = routes.map(route => {
    const attempts = records.filter(r => r.route === route);
    const rows = attempts.filter(r => typeof r.routeUrlMs === "number");
    const median = key => {
      const vals = rows.map(row => row[key]).filter(Number.isFinite).sort((a, b) => a - b);
      return vals.length ? vals[Math.floor((vals.length - 1) / 2)] : null;
    };
    return {
      route,
      attempts: attempts.length,
      samples: rows.length,
      failures: attempts.filter(r => r.failedAt).length,
      routeUrlMedianMs: median("routeUrlMs"),
      homeReturnMedianMs: median("homeReturnMs"),
      homeReturnArtResponsesTotal: rows.reduce((sum, row) => sum + row.homeReturnArtResponses, 0),
    };
  });
  await mkdir("performance-results", { recursive: true });
  const path = "performance-results/dashboard-revisits-" +
    new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await writeFile(path, JSON.stringify({
    measuredAt: new Date().toISOString(),
    origin, viewport: "390x844", loops,
    reportCaveats: [
      "Routes include only Home tool cards visible to the authorized test account.",
      "URL and text change do not mean the destination has fully loaded its data.",
      "homeReturnArtResponses counts response events shortly after returning Home, not transferred bytes or confirmed cache misses.",
      "No POST, PATCH, PUT, DELETE, upload, message send or publishing is executed.",
      "Failed routes are reported and the rest of the benchmark continues.",
    ],
    byRoute, records,
  }, null, 2));
  console.log("RESULT " + path);
  console.table(byRoute);
} finally {
  await browser.close();
}
