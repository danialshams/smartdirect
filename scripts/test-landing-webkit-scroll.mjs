/**
 * Real WebKit (not a Chromium user-agent spoof) mobile scroll regression.
 * Runs locally in the GitHub runner against the just-built Next.js branch.
 */
import { webkit } from "playwright";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const app = spawn("./node_modules/.bin/next", ["start", "-p", "3198"], {
  stdio: "ignore", env: { ...process.env, PORT: "3198" }
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) throw Error("Next.js exited during WebKit audit");
    try { const response = await fetch("http://127.0.0.1:3198/"); if (response.ok) { ready = true; break; } }
    catch {}
    await sleep(250);
  }
  if (!ready) throw Error("Next.js local server not ready");
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3198/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator(".daira-library-liquid-header").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const first = await page.evaluate(() => {
    const lens = document.querySelector(".daira-library-liquid-header");
    return { strategy: lens?.dataset.glassStrategy, reason: lens?.dataset.glassReason,
      stable: document.querySelector(".ap-site")?.dataset.sceneCaptureStable,
      ready: document.querySelector(".daira-library-glass-frame")?.dataset.glassReady,
      scene: !!document.querySelector("[data-liquid-glass-scene]"),
      captures: Number(document.querySelector("[data-liquid-glass-scene]")?.getAttribute("data-liquid-glass-captures") ?? 0),
      edge: getComputedStyle(lens.querySelector(".liquid-glass-border")).display };
  });
  console.log("WEBKIT_FIRST="+JSON.stringify(first));
  const frames = await page.evaluate(async () => {
    const panel = document.querySelector(".daira-library-liquid-header");
    const samples = [];
    for (let i=0; i<75; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      window.scrollBy(0, 28);
      if (i % 5 === 0) samples.push({
        y: scrollY,
        strategy: panel.dataset.glassStrategy,
        reason: panel.dataset.glassReason,
        ready: document.querySelector(".daira-library-glass-frame").dataset.glassReady,
        captures: Number(document.querySelector("[data-liquid-glass-scene]")?.dataset.liquidGlassCaptures ?? 0),
      });
    }
    return samples;
  });
  console.log("WEBKIT_SCROLL_FRAMES="+JSON.stringify(frames));
  const snapshot = await page.screenshot({type:"jpeg",quality:54});
  console.log("WEBKIT_SCROLL_IMAGE="+snapshot.toString("base64"));
  const stable = first.stable === "true";
  if (!stable) throw Error("Safari screenshot-reveal animation suppression not engaged");
  if (first.edge !== "none") throw Error("Separate white border is still visible");
  if (frames.at(-1).y-frames[0].y < 1300) throw Error("Did not actually scroll content in WebKit");
  const modes = new Set(frames.map(x=>x.strategy));
  if (![...modes].some(x=>x==="webgl")) {
    throw Error("WebKit is not refracting in real WebGL: "+JSON.stringify({first, modes:[...modes]}));
  }
  if (frames.some(x=>x.strategy==="off")) throw Error("WebKit optical renderer was disabled while scrolling");
  const firstActive = frames.findIndex(x=>x.strategy==="webgl");
  if (firstActive<0 || frames.slice(firstActive+1).some(x=>x.strategy!=="webgl")) {
    throw Error("WebGL renderer was destroyed and reinitialized between live scroll frames: "
      +JSON.stringify(frames.map(x=>x.strategy)));
  }
  console.log("WEBKIT_CONTINUOUS_GPU_FRAMES_PASS="+(frames.length-firstActive));
  console.log("WEBKIT_SCROLL_PASS");
} catch (error) {
  console.error("WEBKIT_SCROLL_ERROR", error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(()=>{});
  app.kill("SIGTERM");
}
