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
  await waitFor(async () => (await evaluate('document.querySelector(".ap-header__backdrop")?.dataset.glassStrategy')) === "svg");
  const startup=await waitFor(async()=>await evaluate(`(() => {
    const root=document.querySelector(".ap-header__backdrop");
    const optical=root?.querySelector('div[style*="backdrop-filter"]');
    if(!root||!optical)return null;
    return {
      strategy:root.dataset.glassStrategy,
      filter:getComputedStyle(optical).backdropFilter,
      shadow:getComputedStyle(optical).boxShadow,
      border:getComputedStyle(root).borderTopWidth,
      glassCount:document.querySelectorAll('[data-liquid-glass]').length,
      sceneCount:document.querySelectorAll('[data-liquid-glass-scene]').length,
      opticalMaps:root.querySelectorAll('feDisplacementMap').length,
      oldApproximation:!!root.querySelector('.ap-optical-native'),
      ctaIcons:document.querySelector(".ap-hero__cta")?.querySelectorAll("svg").length
    };
  })()`));
  assert.equal(startup.strategy,"svg","Use genuine SVG LiquidGlass optical renderer");
  assert.match(startup.filter,/url\(/,"Liquid lens must refract LIVE backdrop pixels");
  assert.equal(startup.shadow,"none","Do not draw an unwanted internal rim");
  assert.equal(startup.border,"0px","No white outline on header");
  assert.equal(startup.glassCount,1,"Exactly one native glass instance before scroll");
  assert.equal(startup.sceneCount,0,"No heavy HTML snapshot scene");
  assert.ok(startup.opticalMaps>=1,"Actual library displacement stages must exist");
  assert.equal(startup.oldApproximation,false);
  assert.equal(startup.ctaIcons,0,"Free Start button should remain icon-free");
  // Prior regressions passed because only filter existence was tested.
  // An isolated sticky header is a backdrop root and hides all underlying
  // scrolling pixels from the genuine SVG filter. Assert actual CSS root.
  const roots=await evaluate(`(() => ({
    header:getComputedStyle(document.querySelector(".ap-header")).isolation,
    lens:getComputedStyle(document.querySelector(".ap-header__backdrop")).isolation,
    blueFill:getComputedStyle(document.querySelector(".ap-header__backdrop > div[style*='backdrop-filter']")).backgroundColor
  }))()`);
  assert.equal(roots.header,"auto","An isolated sticky header prevents sampling the scrolling page");
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
    style.textContent='.ap-header__backdrop > div[style*="backdrop-filter"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
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
    const rect=document.querySelector(".ap-header__backdrop").getBoundingClientRect();
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
  await waitFor(async()=>(await evaluate('document.querySelector(".ap-backtop__lens")?.dataset.glassStrategy'))==="svg");
  const scrolled=await evaluate(`(() => {
    const h=document.querySelector(".ap-header__backdrop");
    const b=document.querySelector(".ap-backtop__lens");
    const overlay=document.querySelector(".ap-backtop");
    return {
      headerStrategy:h.dataset.glassStrategy,
      buttonStrategy:b.dataset.glassStrategy,
      headerFilter:getComputedStyle(h.querySelector('div[style*="backdrop-filter"]')).backdropFilter,
      buttonFilter:getComputedStyle(b.querySelector('div[style*="backdrop-filter"]')).backdropFilter,
      borderWidth:getComputedStyle(overlay,"::after").borderTopWidth,
      borderColor:getComputedStyle(overlay,"::after").borderTopColor,
      glassCount:document.querySelectorAll('[data-liquid-glass]').length
    };
  })()`);
  assert.equal(scrolled.headerStrategy,"svg");
  assert.equal(scrolled.buttonStrategy,"svg");
  assert.match(scrolled.headerFilter,/url\(/);
  assert.match(scrolled.buttonFilter,/url\(/);
  assert.equal(scrolled.borderWidth,"2px","Button needs a white outer border");
  assert.match(scrolled.borderColor,/255, 255, 255/);
  assert.equal(scrolled.glassCount,2);
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
  assert.equal(mid.count,2,"Opening menu must not create an extra lens");
  await sleep(310);
  await evaluate('document.querySelector(".ap-menu__top button").click()');
  await sleep(340);
  assert.equal(await evaluate('document.querySelector(".ap-menu").classList.contains("ap-menu--open")'),false);

  // Emulate the WebKit/Gecko *selection path* in a separate navigation.
  // Chrome's filter primitives render the fallback for a predictable CI check.
  await send("Emulation.setUserAgentOverride",{userAgent:"Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0"});
  await send("Page.navigate",{url:"http://127.0.0.1:"+port+"/"});
  await waitFor(async () => (await evaluate('document.querySelector(".ap-header__backdrop")?.dataset.opticsMode')) === "mirror",14000);
  const fallback=await evaluate(`(() => {
    const s=document.querySelector(".ap-header__backdrop"),doc=s.querySelector(".ap-optical-document");
    return {
      mode:s.dataset.opticsMode,
      ready:!!doc,
      mainCount:doc?.querySelectorAll(":scope > main").length,
      sections:doc?.querySelectorAll(":scope > section.ap-showcase-capture").length,
      footer:!!doc?.querySelector(":scope > footer"),
      filter:getComputedStyle(s.querySelector(".ap-optical-mirror")).filter,
      border:getComputedStyle(s).borderTopWidth
    };
  })()`);
  assert.equal(fallback.mode,"mirror");
  assert.equal(fallback.mainCount,1);
  assert.equal(fallback.sections,8);
  assert.ok(fallback.footer);
  assert.match(fallback.filter,/url\(/);
  assert.equal(fallback.border,"0px");
  await evaluate('window.scrollTo({top:1350,behavior:"instant"})');
  await waitFor(async () => !!(await evaluate('document.querySelector(".ap-header__backdrop .ap-optical-document")?.style.transform.includes("-1350px")')));
  assert.equal(await evaluate('document.querySelector(".ap-header__backdrop").dataset.opticsMode'),"mirror");
  console.log("DAIRA BROWSER PASS: genuine SVG LiquidGlass refraction tracks live scroll, intentional white back-to-top border, no heavy scene or menu lens, prewarmed Firefox fallback.");
} finally {
  try {socket?.close();} catch {}
  if (chrome && chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([once(chrome,"exit").catch(()=>{}),sleep(1200)]);
  }
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
