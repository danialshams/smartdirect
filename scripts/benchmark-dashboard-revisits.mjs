/**
 * Read-only authenticated return-navigation audit. Uses the installed full
 * Chromium, retains the same browser context/cache across route samples, but
 * isolates each route in a fresh Page so a broken history transition does not
 * poison every subsequent sample.
 *
 * All actions are GET/navigation only. No account changes or writes.
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
const cardSelector = "a.daira-home__tool-card, a.daira-home__quick-card";
const records = [];
let routes = [];
const isArt = url => url.includes("/dashboard-art/") || url.includes("%2Fdashboard-art%2F");

async function readyHome(page) {
  const response = await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded", timeout: 15000 });
  if (!response?.ok() || new URL(page.url()).pathname !== "/dashboard") {
    throw new Error("Dashboard not accessible with this test session.");
  }
  await page.locator(cardSelector).first().waitFor({ state: "visible", timeout: 12000 });
  // The Home cards can be visible before the Next.js client-side router has
  // hydrated. Avoid clicking an SSR link during that brief window.
  await page.waitForTimeout(250);
}

async function runOne(loop, route) {
  const page = await context.newPage();
  let stage = "home";
  let returnArtResponses = 0;
  const onResponse = response => {
    if (stage === "return" && isArt(response.url())) returnArtResponses++;
  };
  page.on("response", onResponse);
  try {
    await readyHome(page);
    // Select by exact href. The selector is based on routes read from the
    // authenticated Home, not user input.
    const card = page.locator('a[href="' + route + '"]').first();
    if (!await card.isVisible()) {
      records.push({ loop, route, skipped: "Card not visible after hydration" });
      return;
    }
    stage = "outbound";
    const previousText = await page.locator("main").first().innerText();
    const start = Date.now();
    await Promise.all([
      page.waitForURL(url => url.pathname === route, { waitUntil: "commit", timeout: 10000 }),
      card.click({ timeout: 7000, noWaitAfter: true }),
    ]);
    const routeUrlMs = Date.now() - start;

    let textChangeMs = null;
    try {
      await page.waitForFunction(text => {
        const main = document.querySelector("main");
        return main && main.innerText.trim() && main.innerText !== text;
      }, previousText, { timeout: 3500 });
      textChangeMs = Date.now() - start;
    } catch {
      // Text changes do not prove data readiness.
    }

    stage = "return";
    const backStart = Date.now();
    await Promise.all([
      page.waitForURL(url => url.pathname === "/dashboard", { waitUntil: "commit", timeout: 10000 }),
      page.evaluate(() => window.history.back()),
    ]);
    await page.locator(cardSelector).first().waitFor({ state: "visible", timeout: 10000 });
    const homeReturnMs = Date.now() - backStart;
    await page.waitForTimeout(300);
    // Resource Timing also includes cached image responses; transferSize on a
    // same-origin image normally helps separate cache reuse from new transfer.
    const artTransferBytes = await page.evaluate(() =>
      performance.getEntriesByType("resource")
        .filter(entry => entry.name.includes("/dashboard-art/") ||
          entry.name.includes("%2Fdashboard-art%2F"))
        .reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
    );
    const record = { loop, route, routeUrlMs, textChangeMs, homeReturnMs, returnArtResponses, artTransferBytes };
    records.push(record);
    console.log("REVISIT " + route + " loop=" + loop +
      " route=" + routeUrlMs + "ms home=" + homeReturnMs +
      "ms homeArtResponses=" + returnArtResponses);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    records.push({ loop, route, failedAt: stage, errorType, finalPath: new URL(page.url()).pathname });
    console.warn("REVISIT_FAILED " + route + " loop=" + loop + " stage=" + stage +
      " error=" + errorType + " currentPath=" + new URL(page.url()).pathname);
  } finally {
    page.off("response", onResponse);
    await page.close().catch(() => {});
  }
}

try {
  const discoveryPage = await context.newPage();
  try {
    await readyHome(discoveryPage);
    routes = [...new Set(await discoveryPage.locator(cardSelector).evaluateAll(nodes =>
      nodes.map(n => n.getAttribute("href")).filter(Boolean)
    ))].filter(route => route.startsWith("/dashboard/"));
  } finally {
    await discoveryPage.close();
  }
  if (!routes.length) throw new Error("No Home tool links were available to this test account.");

  for (let loop = 0; loop < loops; loop++) {
    for (const route of routes) await runOne(loop, route);
  }

  const byRoute = routes.map(route => {
    const attempts = records.filter(r => r.route === route);
    const samples = attempts.filter(r => Number.isFinite(r.routeUrlMs));
    const median = key => {
      const v = samples.map(r => r[key]).filter(Number.isFinite).sort((a, b) => a - b);
      return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
    };
    return {
      route, attempts: attempts.length, samples: samples.length,
      failures: attempts.filter(r => r.failedAt).length,
      routeUrlMedianMs: median("routeUrlMs"),
      homeReturnMedianMs: median("homeReturnMs"),
      homeReturnArtResponsesTotal: samples.reduce((sum, r) => sum + r.returnArtResponses, 0),
      artworkTransferBytesMedian: median("artTransferBytes"),
    };
  });
  const report = {
    measuredAt: new Date().toISOString(), origin, viewport: "390x844", loops,
    reportCaveats: [
      "A fresh Page is used for each route; browser context and asset cache are reused.",
      "Route URL and text changes are not measurements of full application readiness.",
      "Art response events and Resource Timing transferSize do not always establish cache misses.",
      "Read-only GET/navigation only: no create, edit, send, upload, publish or delete.",
      "Timeouts are reported per route without aborting subsequent samples."
    ],
    byRoute, records,
  };
  await mkdir("performance-results", { recursive: true });
  const output = "performance-results/dashboard-revisits-" +
    new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log("RESULT " + output);
  console.table(byRoute);
} finally {
  await browser.close();
}
