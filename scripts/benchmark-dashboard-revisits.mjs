/**
 * Read-only SPA revisit and static-art measurement using installed Chromium.
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
const browser = await chromium.launch({headless: true, channel:"chromium"});
const context = await browser.newContext({storageState: auth,viewport:{width:390,height:844}});
const page = await context.newPage();
const cardSelector = "a.daira-home__tool-card, a.daira-home__quick-card";
const records = [];
const imageResponses = [];
page.on("response",response=>{
  const url = response.url();
  // Count only artwork requests. Do not persist URLs, messages, or account IDs.
  if (url.includes("/dashboard-art/") || url.includes("%2Fdashboard-art%2F")) {
    imageResponses.push({status:response.status()});
  }
});
async function openHome() {
  const response = await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded",timeout:30000});
  if (!response?.ok() || new URL(page.url()).pathname!=="/dashboard") {
    throw new Error("Dashboard requires a valid test-user session");
  }
  await page.locator(cardSelector).first().waitFor({state:"visible",timeout:16000});
}
try {
  await openHome();
  // Collect the exact links rendered for this test user, not a guessed list
  // of pages inaccessible to their role.
  const routes = [...new Set(await page.locator(cardSelector).evaluateAll(nodes=>
    nodes.map(node=>node.getAttribute("href")).filter(Boolean)
  ))].filter(path=>path.startsWith("/dashboard/"));
  if (!routes.length) throw new Error("No dashboard tool links were available");

  for (let loop=0;loop<loops;loop++) {
    for (const route of routes) {
      // Always navigate using an actual visible dashboard card (SPA path).
      if (new URL(page.url()).pathname!=="/dashboard") await openHome();
      const link=page.locator(cardSelector+'[href="'+route+'"]').first();
      if (!await link.isVisible()) {
        records.push({loop,route,skipped:"No visible dashboard card"});continue;
      }
      const beforeText=await page.locator("main").first().innerText();
      const firstImages=imageResponses.length;
      const started=Date.now();
      await link.click({timeout:10000});
      await page.waitForURL(url=>url.pathname===route,{timeout:20000});
      const routeUrlMs=Date.now()-started;
      let routeTextMs=null;
      try {
        await page.waitForFunction(oldText=>{
          const main=document.querySelector("main");
          return Boolean(main && main.innerText.trim() && main.innerText!==oldText);
        },beforeText,{timeout:10000});
        routeTextMs=Date.now()-started;
      } catch {}
      const returnAt=Date.now();
      await page.goBack({waitUntil:"domcontentloaded",timeout:20000});
      await page.waitForURL(url=>url.pathname==="/dashboard",{timeout:12000});
      await page.locator(cardSelector).first().waitFor({state:"visible",timeout:12000});
      const homeReturnMs=Date.now()-returnAt;
      const artResponseCount=imageResponses.length-firstImages;
      const record={loop,route,routeUrlMs,routeTextMs,homeReturnMs,artResponseCount};
      records.push(record);
      console.log("REVISIT "+route+" loop="+loop+" route="+routeUrlMs+"ms home="+homeReturnMs+"ms artResponses="+artResponseCount);
    }
  }
  const byRoute=routes.map(route=>{
    const rows=records.filter(r=>r.route===route && r.routeUrlMs!==undefined);
    const median=key=>{
      const vals=rows.map(row=>row[key]).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
      return vals.length?vals[Math.floor(vals.length/2)]:null;
    };
    return {route,samples:rows.length,routeUrlMedianMs:median("routeUrlMs"),
      homeReturnMedianMs:median("homeReturnMs"),
      artResponsesTotal:rows.reduce((sum,row)=>sum+row.artResponseCount,0)};
  });
  await mkdir("performance-results",{recursive:true});
  const path="performance-results/dashboard-revisits-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";
  await writeFile(path,JSON.stringify({measuredAt:new Date().toISOString(),origin,
    viewport:"390x844",loops,reportCaveats:[
      "The test only covers Home tool card destinations visible to this account.",
      "URL change and text change do not mean data fully loaded.",
      "A response event does not uniquely establish cache hit/miss; artResponseCount is diagnostic only.",
      "All operations are navigation GETs. No mutation performance is measured."
    ],byRoute,records},null,2));
  console.log("RESULT "+path);
  console.table(byRoute);
} finally {
  await browser.close();
}
