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
      bound: document.querySelector(".daira-library-glass-frame")?.dataset.opticalSourceBound,
      sources: document.querySelectorAll("canvas[data-liquid-glass-backdrop]").length,
      scene: !!document.querySelector("[data-liquid-glass-scene]"),
      captures: Number(document.querySelector("[data-liquid-glass-scene]")?.getAttribute("data-liquid-glass-captures") ?? 0),
      edge: getComputedStyle(lens.querySelector(".liquid-glass-border")).display };
  });
  console.log("WEBKIT_FIRST="+JSON.stringify(first));
  // A scene can be ready while the library's deferred optical ref is not
  // mounted yet. Require the explicit source to bind and produce REAL optics
  // before exercising scrolling: otherwise a permanent missing-backdrop blur
  // could misleadingly pass a generic "no off strategy" test.
  await page.waitForFunction(() => {
    const lens=document.querySelector(".daira-library-liquid-header");
    const frame=document.querySelector(".daira-library-glass-frame");
    return frame?.dataset.opticalSourceBound === "true" &&
      frame?.dataset.glassReady === "true" &&
      frame?.dataset.opticalEverReady === "true" &&
      lens?.dataset.glassStrategy === "webgl";
  },null,{timeout:25000});

  const frames = await page.evaluate(async () => {
    const panel = document.querySelector(".daira-library-liquid-header");
    const samples = [];
    for (let i=0; i<75; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      window.scrollBy(0, 28);
      samples.push({
        y: scrollY,
        strategy: panel.dataset.glassStrategy,
        reason: panel.dataset.glassReason,
        ready: document.querySelector(".daira-library-glass-frame").dataset.glassReady,
        ever: document.querySelector(".daira-library-glass-frame").dataset.opticalEverReady,
        captures: Number(document.querySelector("[data-liquid-glass-scene]")?.dataset.liquidGlassCaptures ?? 0),
      });
    }
    return samples;
  });
  console.log("WEBKIT_SCROLL_FRAMES="+JSON.stringify(frames));
  // A real WebKit regression: do not generate new HTML snapshots merely
  // because the user scrolled across static page sections. The official
  // canvas must remain active and track scroll positions itself.
  await page.waitForTimeout(620);
  const settled = await page.evaluate(() => {
    const lens=document.querySelector(".daira-library-liquid-header");
    const optical=lens?.querySelector(':scope > div[style*="backdrop-filter"]');
    const frame=document.querySelector(".daira-library-glass-frame");
    return {
      y:scrollY,
      revisionNodes:document.querySelectorAll("[data-daira-glass-viewport-revision]").length,
      strategy:lens?.dataset.glassStrategy,
      reason:lens?.dataset.glassReason,
      bound:frame?.dataset.opticalSourceBound,
      ready:frame?.dataset.glassReady,
      nativeCanvas:!!lens?.querySelector("canvas[data-liquid-glass-webgl]") ||
        !!lens?.parentElement?.querySelector("canvas[data-liquid-glass-scene]"),
      opticalFilter:optical ? getComputedStyle(optical).backdropFilter : null,
      edgeShadow:getComputedStyle(frame).boxShadow,
      clip:getComputedStyle(frame).overflow,
      captures:Number(document.querySelector("[data-liquid-glass-scene]")?.dataset.liquidGlassCaptures??0)
    };
  });
  console.log("WEBKIT_SETTLED_CAPTURE="+JSON.stringify(settled));
  if (settled.revisionNodes !== 0) throw Error("Scrolling must not invalidate static cached captures");
  if (settled.strategy !== "webgl" || settled.bound !== "true" || !settled.nativeCanvas) {
    throw Error("Native WebGL renderer or its GPU presentation was lost");
  }
  if (settled.edgeShadow !== "none" || settled.clip !== "hidden") {
    throw Error("Visible white rim must be clipped without an outer shadow");
  }
  if (settled.captures < 2) throw Error("No real scene tiles captured during scroll");
  // Revisiting a previously captured region must preserve optical rendering
  // without replacing the GPU canvas with the old 5px frosted material.
  await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"}));
  await page.waitForTimeout(420);
  const revisited=await page.evaluate(() => {
    const lens=document.querySelector(".daira-library-liquid-header");
    const optical=lens?.querySelector(':scope > div[style*="backdrop-filter"]');
    return {
      y:scrollY, strategy:lens?.dataset.glassStrategy,
      nativeCanvas:!!lens?.querySelector("canvas[data-liquid-glass-webgl]") ||
        !!lens?.parentElement?.querySelector("canvas[data-liquid-glass-scene]"),
      filter:optical ? getComputedStyle(optical).backdropFilter : null,
      captures:Number(document.querySelector("[data-liquid-glass-scene]")?.dataset.liquidGlassCaptures??0),
      revisions:document.querySelectorAll("[data-daira-glass-viewport-revision]").length
    };
  });
  console.log("WEBKIT_REVISIT="+JSON.stringify(revisited));
  if (revisited.strategy!=="webgl" || !revisited.nativeCanvas || revisited.revisions) {
    throw Error("Backtracking must retain the same real WebGL renderer");
  }

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
  if (frames.some(x=>x.ready !== "true" || x.ever !== "true")) {
    throw Error("Native optics must never flash back to CSS blur after first successful frame");
  }
  const firstActive = frames.findIndex(x=>x.strategy==="webgl");
  if (firstActive<0 || frames.slice(firstActive+1).some(x=>x.strategy!=="webgl")) {
    throw Error("WebGL renderer was destroyed and reinitialized between live scroll frames: "
      +JSON.stringify(frames.map(x=>x.strategy)));
  }
  console.log("WEBKIT_CONTINUOUS_GPU_FRAMES_PASS="+(frames.length-firstActive));
  // Previous audit only used 28px scroll steps. A real flick sends the
  // viewport thousands of pixels across multiple uncached feature tiles.
  // Exercise that path, including returning to an already visited area.
  const jumps = [];
  for (const target of [0, 3600, 850, 6200]) {
    await page.evaluate(top => window.scrollTo({top,behavior:"instant"}), target);
    await page.waitForTimeout(270);
    jumps.push(await page.evaluate(() => ({
      y:scrollY,
      strategy:document.querySelector(".daira-library-liquid-header")?.dataset.glassStrategy,
      bound:document.querySelector(".daira-library-glass-frame")?.dataset.opticalSourceBound,
      captures:Number(document.querySelector("[data-liquid-glass-scene]")?.dataset.liquidGlassCaptures??0),
      gsapShown:document.querySelectorAll("[data-gsap-shown='true']").length,
      // Capture cadence is NOT a proxy for freshness. Fingerprint the actual
      // 2D backdrop source consumed by native WebGL at each jump.
      backdrop: (() => {
        const canvas=document.querySelector("canvas[data-liquid-glass-backdrop]");
        if (!canvas || !canvas.width || !canvas.height) return null;
        try {
          const ctx=canvas.getContext("2d");
          const row=Math.max(0,Math.floor(canvas.height/2)-30);
          const pixels=ctx.getImageData(0,row,canvas.width,Math.min(60,canvas.height-row)).data;
          let hash=2166136261;
          const step=Math.max(4,Math.floor(pixels.length/2400/4)*4);
          for(let i=0;i<pixels.length;i+=step) {
            hash=Math.imul(hash ^ pixels[i],16777619);
            hash=Math.imul(hash ^ pixels[i+1],16777619);
            hash=Math.imul(hash ^ pixels[i+2],16777619);
          }
          return hash>>>0;
        } catch { return "unreadable"; }
      })(),
    })));
  }
  console.log("WEBKIT_FAST_JUMPS="+JSON.stringify(jumps));
  if(jumps.some(x=>x.strategy!=="webgl"||x.bound!=="true")) {
    throw Error("Rapid scroll must retain the native refractive WebGL engine");
  }
  await page.waitForFunction(() => {
    const frame=document.querySelector(".daira-library-glass-frame");
    return frame?.dataset.glassReady==="true";
  },null,{timeout:10000});
  console.log("WEBKIT_FAST_SCROLL_RECOVERY_PASS");
  console.log("WEBKIT_SCROLL_PASS");
} catch (error) {
  console.error("WEBKIT_SCROLL_ERROR", error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(()=>{});
  app.kill("SIGTERM");
}
