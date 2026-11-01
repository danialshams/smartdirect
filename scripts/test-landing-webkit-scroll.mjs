/**
 * Real WebKit (not a Chromium user-agent spoof) mobile scroll regression.
 * Runs locally in the GitHub runner against the just-built Next.js branch.
 */
import { webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

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
  await mkdir("artifacts/landing-webkit", { recursive: true });
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
      captures: Number(document.querySelector(".daira-static-reflection")?.getAttribute("data-liquid-glass-captures") ?? 0),
      edge: getComputedStyle(lens.querySelector(".liquid-glass-border")).display };
  });
  console.log("WEBKIT_FIRST="+JSON.stringify(first));
  await page.waitForFunction(() => document.querySelector(".daira-static-reflection")?.dataset.dairaGlassCaptureController==="static",null,{timeout:12000});
  await page.waitForFunction(() => [...document.querySelectorAll(".daira-optical-tile img")].length===10 && [...document.querySelectorAll(".daira-optical-tile img")].every(img=>img.complete && img.naturalWidth>0),null,{timeout:15000});
  const mirror=await page.evaluate(() => {
    const page=document.querySelector(".ap-site[data-liquid-glass-scene]");
    const source=document.querySelector(".daira-static-reflection");
    const liveSections=[...page.children].filter(node=>node.matches("main, .ap-showcase-capture, footer.ap-footer--extended"));
    const reflectionSections=[...source.children].filter(node=>node.matches("main, .ap-showcase-capture, footer.ap-footer--extended"));
    return {
      pageSections:liveSections.length,reflectionSections:reflectionSections.length,
      sameTop:liveSections.every((el,i)=>Math.abs(el.getBoundingClientRect().top-reflectionSections[i].getBoundingClientRect().top)<3),
      sameHeight:liveSections.every((el,i)=>Math.abs(el.getBoundingClientRect().height-reflectionSections[i].getBoundingClientRect().height)<3),
      imageTiles:source.querySelectorAll(".daira-optical-tile img").length,
      imagesReady:[...source.querySelectorAll(".daira-optical-tile img")].every(img=>img.complete && img.naturalWidth>0),
      sourceMatches:[...source.querySelectorAll(".daira-optical-tile img")].every((img,i)=>
        img.getAttribute("src")===`/landing-reflection/mobile-${i}.jpg`),
      sourceInert:source.inert && source.getAttribute("aria-hidden")==="true",
      noDuplicateIds:!source.querySelector("[id]"),
      noHiddenHero:[...source.querySelectorAll("[data-hero-word]")].every(el=>getComputedStyle(el).opacity==="1"),
      sourceRootIsSeparate:source!==page && !page.contains(source)
    };
  });
  console.log("WEBKIT_STATIC_REFLECTION="+JSON.stringify(mirror));
  if(mirror.pageSections<9 || mirror.pageSections!==mirror.reflectionSections || !mirror.sameTop ||
    !mirror.sameHeight || mirror.imageTiles!==mirror.pageSections || !mirror.imagesReady || !mirror.sourceMatches ||
    !mirror.sourceInert || !mirror.noDuplicateIds || !mirror.noHiddenHero || !mirror.sourceRootIsSeparate) {
    throw Error("Raster reflection source must be loaded, aligned and inaccessible");
  }

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
    let previousTimestamp = 0;
    for (let i=0; i<75; i++) {
      const timestamp = await new Promise(resolve => requestAnimationFrame(resolve));
      const frameMs = previousTimestamp ? timestamp - previousTimestamp : 0;
      previousTimestamp = timestamp;
      window.scrollBy(0, 28);
      samples.push({ frameMs,
        y: scrollY,
        strategy: panel.dataset.glassStrategy,
        reason: panel.dataset.glassReason,
        ready: document.querySelector(".daira-library-glass-frame").dataset.glassReady,
        ever: document.querySelector(".daira-library-glass-frame").dataset.opticalEverReady,
        captures: Number(document.querySelector(".daira-static-reflection")?.dataset.liquidGlassCaptures ?? 0),
      });
    }
    return samples;
  });
  console.log("WEBKIT_SCROLL_FRAMES="+JSON.stringify(frames));
  const times=frames.map(f=>f.frameMs).filter(ms=>ms>0).sort((a,b)=>a-b);
  const quantile=q=>Math.round((times[Math.min(times.length-1,Math.floor(q*(times.length-1)))]??0)*10)/10;
  const frameTiming={p50:quantile(.50),p95:quantile(.95),max:quantile(1),sampleCount:times.length};
  console.log("WEBKIT_FRAME_TIMING="+JSON.stringify(frameTiming));
  await writeFile("artifacts/landing-webkit/frame-timing.json",JSON.stringify(frameTiming,null,2));

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
      captures:Number(document.querySelector(".daira-static-reflection")?.dataset.liquidGlassCaptures??0)
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
  const featureScreenshot=await page.screenshot({type:"jpeg",quality:63});
  await writeFile("artifacts/landing-webkit/feature-with-real-glass.jpg",featureScreenshot);
  // A regression previously kept the WebGL strategy alive but displayed a
  // nearly white header because <picture> data was not embedded in the
  // foreignObject. Check ACTUAL output pixels in an area where the original
  // live scene shows the pink Instagram preview behind the lens.
  const opticsPixel=await page.evaluate(async data => {
    const image=new Image();
    image.src="data:image/jpeg;base64,"+data;
    await image.decode();
    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx) throw Error("Screenshot sampler unavailable");
    ctx.drawImage(image,0,0);
    return [...ctx.getImageData(520,78,1,1).data].slice(0,3);
  },featureScreenshot.toString("base64"));
  console.log("WEBKIT_ACTUAL_GLASS_PINK_PIXEL="+JSON.stringify(opticsPixel));
  if(opticsPixel[0]-opticsPixel[1]<25 || opticsPixel[1]>220) {
    throw Error("WebGL header lost the real pink content behind it: white/matte reflection regression");
  }
  console.log("WEBKIT_OPTICS_PINK_REFRACTION_PASS");


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
      captures:Number(document.querySelector(".daira-static-reflection")?.dataset.liquidGlassCaptures??0),
      revisions:document.querySelectorAll("[data-daira-glass-viewport-revision]").length
    };
  });
  console.log("WEBKIT_REVISIT="+JSON.stringify(revisited));
  if (revisited.strategy!=="webgl" || !revisited.nativeCanvas || revisited.revisions) {
    throw Error("Backtracking must retain the same real WebGL renderer");
  }

  const snapshot = await page.screenshot({type:"jpeg",quality:54});
  await writeFile("artifacts/landing-webkit/hero-with-real-glass.jpg",snapshot);
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
      captures:Number(document.querySelector(".daira-static-reflection")?.dataset.liquidGlassCaptures??0),
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
  const pixels=new Set(jumps.map(x=>x.backdrop).filter(x=>typeof x==="number"));
  if (pixels.size<2) {
    throw Error("Fast scrolling left the backdrop canvas completely frozen: "+JSON.stringify(jumps));
  }
  console.log("WEBKIT_BACKDROP_PIXELS_UPDATED_PASS="+pixels.size);
  if(jumps.some(x=>x.strategy!=="webgl"||x.bound!=="true")) {
    throw Error("Rapid scroll must retain the native refractive WebGL engine");
  }
  await page.waitForFunction(() => {
    const frame=document.querySelector(".daira-library-glass-frame");
    return frame?.dataset.glassReady==="true";
  },null,{timeout:10000});
  // The former "ghost fix" hid the REAL WebGL lens and rendered a blur
  // substitute for every fast scroll. This must never happen again.
  await page.evaluate(() => window.scrollTo({top:1050,behavior:"instant"}));
  await page.waitForTimeout(180);
  const fastLens=await page.evaluate(() => {
    const frame=document.querySelector(".daira-library-glass-frame");
    const lens=document.querySelector(".daira-library-liquid-header");
    return {
      strategy:lens?.dataset.glassStrategy,
      visible:getComputedStyle(lens).opacity,
      ready:frame?.dataset.glassReady,
      forcedMatte:frame?.dataset.glassFastStale,
      gsap:document.querySelector(".ap-site")?.dataset.gsapMotion
    };
  });
  console.log("WEBKIT_FAST_NATIVE_LENS="+JSON.stringify(fastLens));
  if(fastLens.strategy!=="webgl" || fastLens.visible==="0" || fastLens.forcedMatte==="true" || fastLens.gsap!=="true") {
    throw Error("Fast scrolling must retain the true optical lens without forcing a blur substitute");
  }
  console.log("WEBKIT_NATIVE_OPTICS_UNINTERRUPTED_PASS");
  console.log("WEBKIT_FAST_SCROLL_RECOVERY_PASS");
  console.log("WEBKIT_SCROLL_PASS");
  // Verify the desktop responsive optical images, real WebGL lens and
  // alignment without expensive repeated full-page screenshot exports.
  await page.setViewportSize({width:1280,height:900});
  await page.waitForFunction(() => {
    const sections=[...document.querySelectorAll(".daira-optical-tile img")];
    const live=[...document.querySelector(".ap-site[data-liquid-glass-scene]").children]
      .filter(el=>el.matches("main, .ap-showcase-capture, footer.ap-footer--extended"));
    return sections.length===10 && sections.every((img,i)=>
      img.getAttribute("src")===`/landing-reflection/desktop-${i}.jpg` &&
      img.complete && img.naturalWidth>0 &&
      Math.abs(img.closest(".daira-optical-tile").getBoundingClientRect().top-live[i].getBoundingClientRect().top)<3);
  },null,{timeout:15000});
  await page.evaluate(() => window.scrollTo({top:2100,behavior:"instant"}));
  await page.waitForTimeout(500);
  const visibleCopies=await page.evaluate(() => {
    return [...document.querySelectorAll(".ap-social-grid > .ap-social-card")]
      .filter(card => {
        const rect=card.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      })
      .map(card => ({
        name:card.querySelector("h3")?.textContent?.trim() ?? "",
        alpha:Number(getComputedStyle(card.querySelector(".ap-social-card__copy")).opacity),
        started:!!card.dataset.gsapStarted
      }));
  });
  console.log("WEBKIT_VISIBLE_FEATURE_COPIES="+JSON.stringify(visibleCopies));
  if(!visibleCopies.length || visibleCopies.some(card=>card.alpha<.3)) {
    throw Error("A visible feature card is blank after Safari viewport resize or scroll jump");
  }
  await writeFile("artifacts/landing-webkit/desktop-with-real-glass.jpg",await page.screenshot({type:"jpeg",quality:78}));
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(() => [...document.querySelectorAll(".daira-optical-tile img")].every((img,i)=>
    img.getAttribute("src")===`/landing-reflection/mobile-${i}.jpg` && img.complete && img.naturalWidth>0),null,{timeout:15000});
  await page.waitForTimeout(250);

  console.log("WEBKIT_RESPONSIVE_OPTICS_PASS");

} catch (error) {
  console.error("WEBKIT_SCROLL_ERROR", error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(()=>{});
  app.kill("SIGTERM");
}
