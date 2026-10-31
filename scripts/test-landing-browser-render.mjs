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

  // Native Chromium must render the LIVE backdrop without capture queues.
  await waitFor(async () => (await evaluate('document.querySelector(".ap-header__backdrop")?.dataset.opticsMode')) === "native");
  const startup = await waitFor(async () => await evaluate(`(() => {
    const s = document.querySelector(".ap-header__backdrop");
    const pane=s?.querySelector(".ap-optical-native");
    if (!s || !pane) return null;
    return {
      mode:s.dataset.opticsMode,
      filter:pane ? getComputedStyle(pane).backdropFilter : "MISSING_NATIVE_NODE: "+s.outerHTML.slice(0,650),
      border:getComputedStyle(s).borderTopWidth,
      shadow:getComputedStyle(s).boxShadow,
      libraryInstances:document.querySelectorAll("[data-liquid-glass]").length,
      sceneInstances:document.querySelectorAll("[data-liquid-glass-scene]").length,
      words:document.querySelectorAll("[data-hero-word]").length,
      headerMapReady:document.getElementById("daira-header-map")?.getAttribute("data-map-prepared"),
      backtopMapReady:document.getElementById("daira-backtop-map")?.getAttribute("data-map-prepared"),
      ctaIconCount:document.querySelector(".ap-hero__cta")?.querySelectorAll("svg").length
    };
  })()`));
  assert.equal(startup.mode, "native");
  assert.match(startup.filter,/url\(/,"Native lens must sample live page pixels");
  assert.equal(startup.border,"0px");
  assert.equal(startup.shadow,"none");
  assert.equal(startup.libraryInstances,0);
  assert.equal(startup.sceneInstances,0);
  assert.equal(startup.words,7);
  assert.equal(startup.headerMapReady,"true","Lens distortion map must be generated before glass appears");
  assert.equal(startup.backtopMapReady,"true");
  assert.equal(startup.ctaIconCount,0,"Free Start CTA must be text only");
  console.log("NATIVE OPTICS DOM READY",JSON.stringify(startup));

  // Refraction must remain active across previously uncaptured sections.
  await evaluate('window.scrollTo({top:1250,behavior:"instant"})');
  await waitFor(async () => await evaluate('window.scrollY>600'));
  await waitFor(async () => (await evaluate('document.querySelector(".ap-backtop__lens")?.dataset.opticsMode')) === "native");
  const scroll = await evaluate(`(() => ({
    header:document.querySelector(".ap-header__backdrop").dataset.opticsMode,
    button:document.querySelector(".ap-backtop__lens")?.dataset.opticsMode,
    filter:getComputedStyle(document.querySelector(".ap-header__backdrop .ap-optical-native")).backdropFilter,
    buttonBorder:getComputedStyle(document.querySelector(".ap-backtop__lens")).borderWidth,
    buttonShadow:getComputedStyle(document.querySelector(".ap-backtop__lens")).boxShadow,
    buttonFilter:getComputedStyle(document.querySelector(".ap-backtop__lens .ap-optical-native")).backdropFilter
  }))()`);
  assert.equal(scroll.header,"native");
  assert.equal(scroll.button,"native");
  assert.match(scroll.filter,/url\(/);
  assert.equal(scroll.buttonBorder,"0px");
  assert.equal(scroll.buttonShadow,"none");
  assert.match(scroll.buttonFilter,/blur\(2\.4px\)/);
  assert.match(scroll.buttonFilter,/daira-optical-backtop/);

  await evaluate('document.querySelector(".ap-menu-toggle").click()');
  await sleep(110);
  const mid=await evaluate(`(() => {
    const menu=document.querySelector(".ap-menu"),overlay=document.querySelector(".ap-menu-overlay");
    return {
      open:menu.classList.contains("ap-menu--open"),
      clip:getComputedStyle(menu).clipPath,
      filter:getComputedStyle(overlay).backdropFilter,
      libraryCount:document.querySelectorAll("[data-liquid-glass]").length
    };
  })()`);
  assert.equal(mid.open,true);
  assert.equal(mid.clip,"none");
  assert.match(mid.filter,/blur\(3px\)/);
  assert.equal(mid.libraryCount,0);
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
  console.log("DAIRA BROWSER PASS: live Chromium SVG backdrop, no white borders or snapshot scenes, lightweight menu, full-page prewarmed mirror visible only after readiness and tracking scroll.");
} finally {
  try {socket?.close();} catch {}
  if (chrome && chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([once(chrome,"exit").catch(()=>{}),sleep(1200)]);
  }
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
