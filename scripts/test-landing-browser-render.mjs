/**
 * Zero-extra-dependency Chromium smoke test for the public landing page.
 * Validates the ACTUAL browser rendering strategy and menu transitions, rather
 * than testing strings in source code. Runs on the isolated CI runner after build.
 *
 * Chrome must be available on the runner; this is deliberately a hard failure
 * if a runner no longer has the browser, rather than silently skipping QA.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const port = 3198;
const debugPort = 19293;
let server;
let chrome;
let socket;
let profile;

async function waitFor(fn, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; }
    catch (error) { last = error; }
    await sleep(130);
  }
  throw new Error("Timed out waiting for browser readiness" + (last ? ": " + last.message : ""));
}

async function start() {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXTAUTH_URL: "http://127.0.0.1:" + port,
      NEXTAUTH_SECRET: "ci-only-placeholder-secret-with-more-than-32-characters",
      CRON_SECRET: "ci-only-placeholder-cron-secret-with-more-than-32-characters",
      DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/smartdirect?sslmode=disable",
      DIRECT_URL: "postgresql://user:password@127.0.0.1:5432/smartdirect?sslmode=disable",
      REDIS_DRIVER: "redis",
      REDIS_URL: "redis://127.0.0.1:6379"
    },
    stdio: "ignore"
  });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error("Next server exited " + server.exitCode);
    const response = await fetch("http://127.0.0.1:" + port + "/", {redirect: "manual"});
    return response.status === 200;
  });
  profile = await mkdtemp(join(tmpdir(), "daira-glass-chrome-"));
  const binary = process.env.CHROME_BIN || "/usr/bin/google-chrome";
  chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=" + profile, "--remote-debugging-port=" + debugPort,
    "--remote-allow-origins=*", "--window-size=1360,900",
    "http://127.0.0.1:" + port + "/"
  ], {stdio: "ignore"});
  const pages = await waitFor(async () => {
    if (chrome.exitCode !== null) throw new Error("Chrome exited " + chrome.exitCode);
    const response = await fetch("http://127.0.0.1:" + debugPort + "/json/list");
    const data = await response.json();
    return data.find(item => item.type === "page" && item.webSocketDebuggerUrl);
  });
  socket = new WebSocket(pages.webSocketDebuggerUrl);
  await once(socket, "open");
}

let id = 0;
const waiting = new Map();
function send(method, params = {}) {
  return new Promise((resolve,reject) => {
    const call = ++id;
    const timer = setTimeout(() => {waiting.delete(call); reject(new Error("CDP timeout " + method));}, 10000);
    waiting.set(call, {resolve, reject, timer});
    socket.send(JSON.stringify({id: call, method, params}));
  });
}
function bindSocket() {
  socket.addEventListener("message", event => {
    let result;
    try {result = JSON.parse(event.data);}
    catch {return;}
    if (!result.id || !waiting.has(result.id)) return;
    const job = waiting.get(result.id);
    waiting.delete(result.id);
    clearTimeout(job.timer);
    if (result.error) job.reject(new Error(JSON.stringify(result.error)));
    else job.resolve(result.result);
  });
}
async function evaluate(expression) {
  const output = await send("Runtime.evaluate", {
    expression, returnByValue:true, awaitPromise:true
  });
  if (output.exceptionDetails) throw new Error("Browser eval exception " + JSON.stringify(output.exceptionDetails));
  return output.result?.value;
}

try {
  await start();
  bindSocket();
  await send("Runtime.enable");
  await send("Page.enable");

  // The restored library must draw its real analytical SVG lens — not the
  // old CSS-only transparent imitation — and keep it live during scrolling.
  await waitFor(async () => (await evaluate('document.querySelector(".daira-library-liquid-header")?.dataset.glassStrategy')) === "svg");
  const startup=await waitFor(async()=>await evaluate(`(() => {
    const root=document.querySelector(".daira-library-liquid-header");
    const optical=root?.querySelector(':scope > div[style*="backdrop-filter"]');
    if(!root||!optical)return null;
    return {
      strategy:root.dataset.glassStrategy,
      filter:getComputedStyle(optical).backdropFilter,
      shadow:getComputedStyle(optical).boxShadow,
      border:getComputedStyle(root).borderTopWidth,
      glassCount:document.querySelectorAll('.daira-library-liquid-header').length,
      sceneCount:document.querySelectorAll('[data-liquid-glass-scene]').length,
      opticalMaps:root.querySelectorAll('feDisplacementMap').length,
      oldApproximation:!!root.querySelector('.ap-optical-native'),
      ctaIcons:document.querySelector(".ap-hero__cta")?.querySelectorAll("svg").length,
      materialColor:getComputedStyle(optical).backgroundColor,
      displacementScales:[...root.querySelectorAll("feDisplacementMap")].map(x=>Number(x.getAttribute("scale")))
    };
  })()`));
  assert.equal(startup.strategy,"svg","Use the real library native SVG lens, not a handmade filter");
  assert.match(startup.filter,/url\(/,"Liquid lens must refract LIVE backdrop pixels");
  assert.match(startup.shadow,/inset/,"Real glass volume must catch light, not be flat transparent acrylic");
  const depth=await evaluate(`(() => {
    const root=document.querySelector(".daira-library-liquid-header");
    const inner=root.querySelector(':scope > div[style*="backdrop-filter"]');
    const border=root.querySelector(".liquid-glass-border");
    return {shadow:getComputedStyle(inner).boxShadow, borderDisplay:border&&getComputedStyle(border).display};
  })()`);
  assert.match(depth.shadow,/inset/,"Library specular rim must not be suppressed by CSS");
  assert.equal(depth.borderDisplay,"block","Library refraction rim must be visible");
  assert.equal(startup.border,"0px","No white outline on header");
  assert.equal(startup.glassCount,1,"Exactly one native glass instance before scroll");
  assert.equal(startup.sceneCount,1,"iOS Safari must have official WebGL scene source");
  assert.ok(startup.opticalMaps>=1,"Actual library displacement stages must exist");
  assert.match(startup.shadow,/rgba/);
  assert.equal(startup.oldApproximation,false);
  assert.equal(startup.ctaIcons,0,"Free Start button should remain icon-free");
  const materialAlpha=Number(startup.materialColor.split(",").at(-1)?.replace(")","").trim());
  console.log("DAIRA MATERIAL",JSON.stringify({color:startup.materialColor,alpha:materialAlpha,scales:startup.displacementScales}));
  assert.ok(materialAlpha>=0 && materialAlpha<.1,
    "Native glass may have a fully clear backdrop; its edge optics supply the material");
  assert.ok(Math.max(...startup.displacementScales) >= 40,
    "The original library loupe must genuinely refract background pixels");
  assert.ok(Math.max(...startup.displacementScales) <= 160,
    "Avoid wildly oversized displacement over the shallow header");

  // Temporary public-landing visual diagnostics. The user reports no visually
  // discernible lens despite a positive filter CSS property test.
  const opticDebug=await evaluate(`(() => {
    const h=document.querySelector(".ap-header");
    const g=document.querySelector(".daira-library-liquid-header");
    const panel=g.querySelector(':scope > div[style*="backdrop-filter"]');
    const rect=g.getBoundingClientRect();
    const hero=document.querySelector(".ap-hero");
    const selectors=[".ap-header",".daira-library-liquid-header",".ap-hero",".ap-hero__ambient",".ap-site","main"];
    return {state:document.documentElement.dataset.dairaHero,
      size:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
      filter:panel.getAttribute("style"),computedFilter:getComputedStyle(panel).backdropFilter,
      map:g.querySelector("feImage")?.getAttribute("href")?.length,
      layers:selectors.map(s=>{const e=document.querySelector(s),v=getComputedStyle(e);
        return [s,v.position,v.zIndex,v.isolation,v.background,v.backgroundColor,v.filter,v.backdropFilter,v.opacity,v.overflow];}),
      center:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.className
    };
  })()`);
  console.log("DAIRA_DIAG_COMPUTED="+JSON.stringify(opticDebug));
  const shot=(await send("Page.captureScreenshot",{format:"jpeg",quality:58,captureBeyondViewport:false})).data;
  console.log("DAIRA_DIAG_SCREENSHOT_FIRST="+shot);

  // Prior regressions passed because only filter existence was tested.
  // An isolated sticky header is a backdrop root and hides all underlying
  // scrolling pixels from the genuine SVG filter. Assert actual CSS root.
  const roots=await evaluate(`(() => ({
    header:getComputedStyle(document.querySelector(".ap-header")).isolation,
    headerBackdrop:getComputedStyle(document.querySelector(".ap-header")).backdropFilter,
    headerFilter:getComputedStyle(document.querySelector(".ap-header")).filter,
    lens:getComputedStyle(document.querySelector(".daira-library-liquid-header")).isolation,
    blueFill:getComputedStyle(document.querySelector(':scope > div[style*="backdrop-filter"]')).backgroundColor
  }))()`);
  assert.equal(roots.header,"auto","An isolated sticky header prevents sampling the scrolling page");
  assert.equal(roots.headerBackdrop,"none",
    "CRITICAL: a parent's backdrop-filter forms a Backdrop Root that blocks the child lens from the page");
  assert.equal(roots.headerFilter,"none","Header parent must not create a filter backdrop root");
  assert.equal(roots.lens,"auto","A nested isolated lens also traps the backdrop");
  assert.ok(!roots.blueFill.includes("241, 249, 255"),"Header must not have a blue tint");

  // The animation must only START when fonts and hydration have finished, so
  // it is visibly scattered on actual first load, unlike a 640ms CSS animation
  // that usually finishes before a visitor can see it.
  await waitFor(async()=>(await evaluate("document.documentElement.dataset.dairaHero"))==="play");
  const hero=await evaluate(`(() => {
    const word=document.querySelector("[data-hero-word]");
    const style=getComputedStyle(word);
    return {name:style.animationName,duration:style.animationDuration,
      spread:parseFloat(style.getPropertyValue("--word-x"))};
  })()`);
  assert.match(hero.name,/daira-word-assemble/);
  assert.ok(parseFloat(hero.duration)>=1.0,"Headline must assemble visibly rather than instantly");
  assert.ok(Math.abs(hero.spread)>=100,"Words must actually start scattered");

  // Contrast fixture under the header catches regressions where an SVG
  // backdrop-filter reports a valid URL but has no visual pixels to sample.
  await evaluate(`(() => {
    const stripe=document.createElement("div");
    stripe.id="daira-ci-refraction-stripes";
    stripe.style.cssText="position:fixed;left:12px;right:12px;top:7px;height:62px;z-index:1;pointer-events:none;background:repeating-linear-gradient(90deg,#101827 0px,#101827 9px,#f5f8ff 9px,#f5f8ff 18px)";
    document.querySelector(".ap-site").appendChild(stripe);
  })()`);
  await sleep(260);
  const withGlass=(await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data;
  await evaluate(`(() => {
    const style=document.createElement("style");
    style.id="daira-ci-disable-refraction";
    style.textContent=':scope > div[style*="backdrop-filter"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
    document.head.appendChild(style);
  })()`);
  await sleep(140);
  const withoutGlass=(await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data;
  const diff=await evaluate(`(async () => {
    const decode=async data=>{
      const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
      const bitmap=await createImageBitmap(new Blob([bytes],{type:"image/png"}));
      const canvas=document.createElement("canvas");
      canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(bitmap,0,0);
      return {width:canvas.width,height:canvas.height,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data};
    };
    const a=await decode("${withGlass}");
    const b=await decode("${withoutGlass}");
    const rect=document.querySelector(".daira-library-liquid-header").getBoundingClientRect();
    const scale=a.width/innerWidth;
    const left=Math.floor((rect.left+23)*scale);
    const right=Math.floor((rect.right-23)*scale);
    const top=Math.floor((rect.top+14)*scale);
    const bottom=Math.floor((rect.bottom-14)*scale);
    let total=0,samples=0;
    for(let y=top;y<bottom;y+=2)for(let x=left;x<right;x+=2){
      const i=(y*a.width+x)*4;
      total+=Math.abs(a.pixels[i]-b.pixels[i])
        +Math.abs(a.pixels[i+1]-b.pixels[i+1])
        +Math.abs(a.pixels[i+2]-b.pixels[i+2]);
      samples++;
    }
    return {meanRGBDifference:total/(samples*3),samples};
  })()`);
  console.log("DAIRA LIVE OPTICAL PIXEL DELTA",JSON.stringify(diff));
  assert.ok(diff.meanRGBDifference>1.4,
    "SVG glass must VISIBLY refract stripe pixels, not merely report an enabled filter");
  await evaluate(`(() => {
    document.getElementById("daira-ci-disable-refraction")?.remove();
    document.getElementById("daira-ci-refraction-stripes")?.remove();
  })()`);


  await evaluate('window.scrollTo({top:1250,behavior:"instant"})');
  await waitFor(async()=>await evaluate('window.scrollY>600'));
  await waitFor(async()=>await evaluate('!!document.querySelector(".ap-backtop__blue-blur")'));
  const scrolled=await evaluate(`(() => {
    const h=document.querySelector(".daira-library-liquid-header");
    const b=document.querySelector(".ap-backtop__blue-blur");
    const action=document.querySelector(".ap-backtop__action");
    const overlay=document.querySelector(".ap-backtop");
    return {
      headerStrategy:h.dataset.glassStrategy,
      headerFilter:getComputedStyle(h.querySelector(':scope > div[style*="backdrop-filter"]')).backdropFilter,
      buttonColor:getComputedStyle(b).backgroundImage,
      buttonBlur:getComputedStyle(b).backdropFilter,
      arrowColor:getComputedStyle(action).color,
      svgStroke:getComputedStyle(action.querySelector("svg")).stroke,
      borderWidth:getComputedStyle(overlay,"::after").borderTopWidth,
      borderContent:getComputedStyle(overlay,"::after").content,
      glassCount:document.querySelectorAll('[data-liquid-glass]').length
    };
  })()`);
  assert.equal(scrolled.headerStrategy,"svg");
  assert.match(scrolled.headerFilter,/url\(/);
  assert.match(scrolled.buttonColor,/linear-gradient/);
  assert.match(scrolled.buttonBlur,/blur\(9px\)/);
  assert.equal(scrolled.arrowColor,"rgb(255, 255, 255)");
  assert.equal(scrolled.svgStroke,"rgb(255, 255, 255)");
  assert.equal(scrolled.borderContent,"none","Blue blurred button must have NO white border overlay");
  assert.equal(scrolled.glassCount,1,"Only the header needs an optical lens");
  // Ensure scroll-reveal content has settled before judging optical clarity.
  await sleep(900);
  const shotScrolled=(await send("Page.captureScreenshot",{format:"jpeg",quality:62,captureBeyondViewport:false})).data;
  console.log("DAIRA_DIAG_SCREENSHOT_SCROLLED="+shotScrolled);

  assert.equal(await evaluate('getComputedStyle(document.querySelector(".ap-backtop")).isolation'),"auto","Back button must not trap backdrop in an isolated stacking root");

  await evaluate('document.querySelector(".ap-menu-toggle").click()');
  await sleep(110);
  const mid=await evaluate(`(() => {
    const menu=document.querySelector(".ap-menu"),overlay=document.querySelector(".ap-menu-overlay");
    return {
      open:menu.classList.contains("ap-menu--open"),
      clip:getComputedStyle(menu).clipPath,
      filter:getComputedStyle(overlay).backdropFilter,
      count:document.querySelectorAll('[data-liquid-glass]').length
    };
  })()`);
  assert.equal(mid.open,true);
  assert.equal(mid.clip,"none");
  assert.match(mid.filter,/blur\(3px\)/);
  assert.equal(mid.count,1,"Opening menu must not create an extra lens");
  await sleep(310);
  await evaluate('document.querySelector(".ap-menu__top button").click()');
  await sleep(340);
  assert.equal(await evaluate('document.querySelector(".ap-menu").classList.contains("ap-menu--open")'),false);

  // A Firefox user-agent spoof inside Chromium does not test WebKit rendering.
  // The official shared scene makes WebGL background capture available on iOS.
  assert.equal(await evaluate("document.querySelectorAll('[data-liquid-glass-scene]').length"),1);
  console.log("DAIRA BROWSER PASS: original simple-liquid-glass loupe, native rim, real refraction, iOS scene, menu and backtop.");
} finally {
  try {socket?.close();} catch {}
  if (chrome && chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([once(chrome,"exit").catch(()=>{}),sleep(1200)]);
  }
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
