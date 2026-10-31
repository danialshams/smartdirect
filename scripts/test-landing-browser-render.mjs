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
  await waitFor(async () => (await evaluate(`document.querySelector(".ap-header__backdrop")?.getAttribute("data-glass-strategy")`)) === "svg");
  const startup = await evaluate(`(() => {
    const root = document.querySelector(".ap-header__backdrop");
    const optical = [...root.children].find(child => child.style.backdropFilter || child.style.webkitBackdropFilter);
    const menu = document.querySelector(".ap-menu");
    return {
      strategy:root.dataset.glassStrategy,
      opticalFilter: optical && getComputedStyle(optical).backdropFilter,
      opticalShadow: optical && getComputedStyle(optical).boxShadow,
      opticalBorder:!!root.querySelector(".liquid-glass-border") && getComputedStyle(root.querySelector(".liquid-glass-border")).display,
      lenses:document.querySelectorAll("[data-liquid-glass]").length,
      menuFilter:getComputedStyle(menu.querySelector(".ap-menu__content")).backdropFilter
    };
  })()`);
  assert.equal(startup.strategy, "svg", "Chromium header must use live SVG refraction");
  assert.match(startup.opticalFilter, /url\(/i, "Live SVG filter must actually be on backdrop layer");
  assert.equal(startup.opticalShadow, "none", "No library inline white rim is allowed");
  assert.equal(startup.opticalBorder, "none", "No library border overlay is allowed");
  assert.equal(startup.lenses, 1, "Before scrolling, only the header is a LiquidGlass instance");
  assert.equal(startup.menuFilter, "none", "No nested menu blur allowed");

  await evaluate(`window.scrollTo({top:950,behavior:"instant"})`);
  await sleep(160);
  const scrolled = await evaluate(`(() => ({
    strategy:document.querySelector(".ap-header__backdrop")?.dataset.glassStrategy,
    y:window.scrollY,
    filter:getComputedStyle([...document.querySelector(".ap-header__backdrop").children].find(el => el.style.backdropFilter)).backdropFilter
  }))()`);
  assert.ok(scrolled.y > 200, "Scroll test did not actually move page");
  assert.equal(scrolled.strategy,"svg");
  assert.match(scrolled.filter,/url\(/);

  await evaluate(`document.querySelector(".ap-menu-toggle").click()`);
  await sleep(110);
  const menuMid = await evaluate(`(() => {
    const menu=document.querySelector(".ap-menu"), overlay=document.querySelector(".ap-menu-overlay");
    return {open:menu.classList.contains("ap-menu--open"),transform:getComputedStyle(menu).transform,
      clip:getComputedStyle(menu).clipPath,overlayFilter:getComputedStyle(overlay).backdropFilter,
      count:document.querySelectorAll("[data-liquid-glass]").length};
  })()`);
  assert.equal(menuMid.open,true);
  assert.equal(menuMid.clip,"none","Avoid animated clip-path repaint");
  assert.match(menuMid.overlayFilter,/blur\(3px\)/,"Backdrop blur is static");
  assert.equal(menuMid.count,1,"Opening menu must not mount a second WebGL/SVG lens");
  await sleep(300);
  await evaluate(`document.querySelector('.ap-menu__top button').click()`);
  await sleep(350);
  assert.equal(await evaluate(`document.querySelector(".ap-menu").classList.contains("ap-menu--open")`),false);
  console.log("DAIRA BROWSER PASS: real native SVG refraction while scrolling; no inner white rim; menu opens/closes without GPU lenses or animated backdrop-filter.");
} finally {
  try {socket?.close();} catch {}
  if (chrome && chrome.exitCode === null) chrome.kill("SIGTERM");
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (profile) await rm(profile,{recursive:true,force:true});
}
