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
  // The library reports its SVG strategy before the parent React frame has
  // committed data-glass-ready=true. Until then CSS intentionally shows a
  // neutral live blur; asserting URL refraction in that transient frame makes
  // the smoke test timing-dependent on runner speed. Wait for the real optical
  // layer itself, not just diagnostics, and fail if it never becomes ready.
  await waitFor(async () => await evaluate(`(() => {
    const frame=document.querySelector(".daira-library-glass-frame");
    const lens=document.querySelector(".daira-library-liquid-header");
    const optical=lens?.querySelector(':scope > div[style*="backdrop-filter"]');
    return frame?.dataset.glassReady==="true" &&
      lens?.dataset.glassStrategy==="svg" &&
      !!optical && getComputedStyle(optical).backdropFilter.includes("url(");
  })()`), 12000);
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
  assert.equal(startup.shadow,"none","Secondary white inset shadow must not paint an acrylic perimeter");
  const depth=await evaluate(`(() => {
    const root=document.querySelector(".daira-library-liquid-header");
    const inner=root.querySelector(':scope > div[style*="backdrop-filter"]');
    const border=root.querySelector(".liquid-glass-border");
    return {shadow:getComputedStyle(inner).boxShadow, borderDisplay:border&&getComputedStyle(border).display};
  })()`);
  assert.equal(depth.shadow,"none","Bright white inner CSS rim must be removed without touching real refraction");
  assert.equal(depth.borderDisplay,"none","Extra white border gradient is decorative, not the actual lens");
  assert.equal(startup.border,"0px","No white outline on header");
  assert.equal(startup.glassCount,1,"Exactly one native glass instance before scroll");
  const glassShell=await evaluate(`(() => {
    const shell=document.querySelector(".daira-library-glass-frame");
    const layer=shell?.querySelector(".daira-library-glass-live-fallback");
    const lens=shell?.querySelector(".daira-library-liquid-header");
    return {shell:!!shell, ready:shell?.dataset.glassReady,
      fallback:getComputedStyle(layer).opacity, rect:shell?.getBoundingClientRect().toJSON(),
      lensRect:lens?.getBoundingClientRect().toJSON()};
  })()`);
  assert.equal(glassShell.shell,true,"Fallback and lens must share the exact geometry");
  assert.equal(glassShell.ready,"true","On Chromium the native live lens must be ready");
  await waitFor(async()=>await evaluate(
    'getComputedStyle(document.querySelector(".daira-library-glass-live-fallback")).opacity==="0"'
  ),1800);
  assert.equal(await evaluate('document.querySelector(".daira-library-glass-frame").dataset.glassReady'),"true",
    "The real SVG filter must be ready before fallback disappears");
  assert.ok(Math.abs((glassShell.lensRect.width-glassShell.rect.width)-3.2)<.75,
    "The lens must slightly overscan the clipped shell to hide only the white fringe");

  assert.equal(startup.sceneCount,1,"iOS Safari must have official WebGL scene source");
  assert.ok(startup.opticalMaps>=1,"Actual library displacement stages must exist");
  assert.equal(startup.shadow,"none");
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
    blueFill:getComputedStyle(document.querySelector('.daira-library-liquid-header > div[style*="backdrop-filter"]')).backgroundColor
  }))()`);
  assert.equal(roots.header,"auto","An isolated sticky header prevents sampling the scrolling page");
  assert.equal(roots.headerBackdrop,"none",
    "CRITICAL: a parent's backdrop-filter forms a Backdrop Root that blocks the child lens from the page");
  assert.equal(roots.headerFilter,"none","Header parent must not create a filter backdrop root");
  assert.equal(roots.lens,"auto","A nested isolated lens also traps the backdrop");
  assert.ok(!roots.blueFill.includes("241, 249, 255"),"Header must not have a blue tint");

  // The first-load headline must be an actual GSAP timeline, NOT the
  // pre-hydration CSS keyframe which finished while remote fonts were loading.
  await waitFor(async()=>await evaluate(
    'document.querySelector("[data-hero-assembly]")?.dataset.gsapHero==="complete"'
  ),7000);
  const hero=await evaluate(`(() => {
    const title=document.querySelector("[data-hero-assembly]");
    const typed=title.querySelector("[data-hero-typed]");
    const style=getComputedStyle(typed);
    return {
      text:typed.textContent.replace(/\\s+/g," ").trim(),
      count:title.querySelectorAll("[data-hero-typed]").length,
      stickers:title.querySelectorAll("[data-hero-sticker]").length,
      backgrounds:title.querySelectorAll(".ap-hero__sticker-bg").length,
      state:title.dataset.gsapHero,
      started:title.dataset.gsapHeroStarted,
      elapsed:Number(title.dataset.gsapHeroElapsed),
      visibility:style.visibility,
      transform:style.transform,
      cssAnimation:style.animationName
    };
  })()`);
  assert.equal(hero.text,"مدیریت کل پیجت رو بسپار به دایرا");
  assert.equal(hero.count,1,"One native RTL text container must be typed with GSAP");
  assert.equal(hero.stickers,0,"Typewriter must contain no colored sticker panels");
  assert.equal(hero.backgrounds,0,"Old blue highlight layers must be completely removed");
  assert.equal(hero.state,"complete");
  assert.ok(Number(hero.started)>0,"GSAP must actually start on first entry");
  assert.ok(hero.elapsed>=700 && hero.elapsed<3500,
    "RTL GSAP entrance must be short, legible, and actually complete");
  assert.equal(hero.visibility,"visible","Typed Persian headline must finish legible");
  assert.equal(hero.transform,"none","Typewriter should not scatter or slide text");
  assert.equal(hero.cssAnimation,"none","No legacy CSS word animation should fight the typewriter");
  assert.equal(await evaluate('document.querySelector("[data-hero-assembly]").hasAttribute("data-liquid-glass-ignore")'),false);
  const motionImage=(await send("Page.captureScreenshot",{format:"jpeg",quality:56,captureBeyondViewport:false})).data;
  console.log("DAIRA_DIAG_SCREENSHOT_HERO_MOTION="+motionImage);

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
    style.textContent='.daira-library-liquid-header > div[style*="backdrop-filter"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
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


  // Exercise 24 consecutive *animation frames* with scrolling, rather than
  // one static after-scroll screenshot. Chrome SVG must sample live pixels
  // without pausing or switching to opaque CSS during the travel.
  const scrollingFrames=await evaluate(`(async()=>{
    const lens=document.querySelector(".daira-library-liquid-header");
    const samples=[];
    for(let i=0;i<24;i++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      window.scrollBy(0,36);
      samples.push({y:scrollY,mode:lens.dataset.glassStrategy,
        filter:getComputedStyle(lens.querySelector(':scope > div[style*="backdrop-filter"]')).backdropFilter});
    }
    return samples;
  })()`);
  assert.ok(scrollingFrames.at(-1).y-scrollingFrames[0].y>700,
    "Continuous-frame test must move through actual content");
  assert.ok(scrollingFrames.every(frame=>frame.mode==="svg"&&frame.filter.includes("url(")),
    "The true optical filter must remain active on every scrolled animation frame");
  console.log("DAIRA LIVE FRAME SCROLL PASS",JSON.stringify({frames:scrollingFrames.length,
    first:scrollingFrames[0].y,last:scrollingFrames.at(-1).y}));
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
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
      buttonShadow:getComputedStyle(b).boxShadow,
      glassCount:document.querySelectorAll('[data-liquid-glass]').length
    };
  })()`);
  assert.equal(scrolled.headerStrategy,"svg");
  assert.match(scrolled.headerFilter,/url\(/);
  assert.match(scrolled.buttonColor,/linear-gradient/);
  assert.match(scrolled.buttonBlur,/blur\(15px\)/);
  assert.equal(scrolled.buttonShadow,"none","No blue glow around the back-to-top control");
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
      count:document.querySelectorAll('[data-liquid-glass]').length,
      menuLens:!!menu.querySelector(".daira-menu-liquid-optics"),
      menuFrame:!!menu.querySelector(".daira-menu-glass-frame")
    };
  })()`);
  assert.equal(mid.open,true);
  assert.equal(mid.clip,"none");
  assert.match(mid.filter,/blur\(3px\)/);
  assert.equal(mid.count,2,"Mobile menu should use its own instance of the EXACT native header LiquidGlass engine");
  assert.ok(mid.menuLens && mid.menuFrame,"Menu must render a genuine optical lens with registered backdrop");
  await sleep(310);
  await evaluate('document.querySelector(".ap-menu__top button").click()');
  await sleep(340);
  assert.equal(await evaluate('document.querySelector(".ap-menu").classList.contains("ap-menu--open")'),false);

  // Verify real GSAP tweens are driven by per-card native visibility, while
  // the masked feature headline remains driven by ScrollTrigger.
  const entrance = await evaluate(`(async () => {
    const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
    const root=document.querySelector(".ap-site");
    const rows=[...document.querySelectorAll(".ap-showcase-capture")];
    const footer=document.querySelector(".ap-footer--extended");
    async function exercise(section, item) {
      const top=section.getBoundingClientRect().top+window.scrollY;
      window.scrollTo({top:Math.max(0,top-innerHeight*.73),behavior:"instant"});
      await sleep(90);
      const opacities=[], cardTransforms=[];
      for (let i=0;i<11;i++) {
        window.scrollBy({top:48,behavior:"instant"});
        await sleep(85);
        opacities.push(Number(getComputedStyle(item).opacity));
        cardTransforms.push(getComputedStyle(section).transform);
      }
      await sleep(2200);
      return {started:Number(section.dataset.gsapStarted??0),
        shown:section.dataset.gsapShown,
        opacities,cardTransforms,finalOpacity:Number(getComputedStyle(item).opacity)};
    }
    const row=rows[Math.min(4,rows.length-1)];
    const card=row.querySelector(".ap-social-grid > .ap-social-card");
    const feature=await exercise(card,card.querySelector(".ap-social-card__copy h3"));
    const foot=await exercise(footer.querySelector(".ap-footer__links"),footer.querySelector(".ap-footer__links > a"));
    return {active:root.dataset.gsapMotion,feature,footer:foot};
  })()`);
  console.log("DAIRA_GSAP_ENTRANCES="+JSON.stringify(entrance));
  assert.equal(entrance.active,"true","Real GSAP ScrollTrigger must be initialized");
  assert.ok(entrance.feature.cardTransforms.some(t=>t!=="none"),
    "Entire real feature card must visibly translate; moving only a decorative halo is invalid");
  for (const [name,result] of Object.entries({feature:entrance.feature,footer:entrance.footer})) {
    assert.ok(result.started>0, name+" must start a genuine GSAP entrance");
    assert.equal(result.shown,"true",name+" GSAP timeline must finish");
    assert.ok(result.opacities.some(x=>x<0.98),
      name+" must show actual intermediate opacity during the entrance");
    assert.equal(result.finalOpacity,1,name+" must remain fully visible after entrance");
  }
  const assembled = await evaluate(`(() => {
    const rows=[...document.querySelectorAll(".ap-showcase-capture")];
    const card=rows[Math.min(4,rows.length-1)]?.querySelector(".ap-social-grid > .ap-social-card");
    const preview=card?.querySelector(".ig-preview");
    return {
      stageCount:Number(card?.dataset.gsapStages??0),
      phase:card?.dataset.gsapPhase,
      shellOpacity:Number(getComputedStyle(card).opacity),
      realSurface:getComputedStyle(card).backgroundImage.includes("gradient"),
      noUndersideShadow:getComputedStyle(card).boxShadow==="none",
      removedShadowOnlyShell:card.querySelector(".ap-social-card__shell")===null,
      titleOpacity:Number(getComputedStyle(card.querySelector("h3")).opacity),
      previewOpacity:Number(getComputedStyle(preview).opacity),
      stagedParts:[...card.querySelectorAll(".ig-preview > *, .ap-social-card__index, .ap-social-card__count")].length
    };
  })()`);
  console.log("DAIRA_CARD_GSAP_ASSEMBLY="+JSON.stringify(assembled));
  assert.ok(assembled.stageCount >= 5, "Each feature must sequence multiple real card internals");
  assert.equal(assembled.phase,"complete","GSAP must complete the inner UI assembly");
  assert.equal(assembled.shellOpacity,1);
  assert.equal(assembled.realSurface,true,"Real feature article owns the animated card background");
  assert.equal(assembled.noUndersideShadow,true,"Feature card must have no linear shadow underneath");
  assert.equal(assembled.removedShadowOnlyShell,true,"No decorative-only shell should animate instead of the card");
  assert.equal(assembled.titleOpacity,1);
  assert.equal(assembled.previewOpacity,1);
    const directionAudit = await evaluate(`(() => {
    const cards=[...document.querySelectorAll(".ap-social-grid > .ap-social-card")];
    const triggered=cards.filter(card=>card.dataset.gsapShown==="true");
    const active=cards.find(card=>card.dataset.gsapStarted);
    return {
      directions:cards.map(card=>Number(card.dataset.gsapDirection)),
      allStages:cards.every(card=>card.dataset.gsapStages===undefined ||
        Number(card.dataset.gsapStages)>=6),
      visited:triggered.length,
      activeCardId:active?.id,
      activeStart:active?.dataset.gsapStarted,
      firstCardState:cards[0]?.dataset.gsapPhase
    };
  })()`);
  assert.deepEqual(directionAudit.directions,
    directionAudit.directions.map((_,i)=>i%2===0?1:-1),
    "The first card must enter from the right, then left, alternating globally");
  assert.ok(directionAudit.allStages,"Each started card must have multiple independent GSAP stages");
  console.log("DAIRA_CARD_DIRECTION_AUDIT="+JSON.stringify(directionAudit));
  if(directionAudit.activeCardId) {
    await evaluate('window.scrollTo({top:0,behavior:"instant"})');
    await sleep(170);
    await evaluate(`document.getElementById("${directionAudit.activeCardId}").scrollIntoView({block:"center",behavior:"instant"})`);
    await sleep(550);
    const replay=await evaluate(`(() => {
      const el=document.getElementById("${directionAudit.activeCardId}");
      return {started:el?.dataset.gsapStarted,phase:el?.dataset.gsapPhase};
    })()`);
    assert.equal(replay.started,directionAudit.activeStart,
      "Returning to a completed card must not start a second entrance");
    console.log("DAIRA_CARD_ONCE_PASS="+JSON.stringify(replay));
  }
    // A Firefox user-agent spoof inside Chromium does not test WebKit rendering.
  // The official shared scene makes WebGL background capture available on iOS.
  assert.equal(await evaluate("document.querySelectorAll('[data-liquid-glass-scene]').length"),1);
  console.log("DAIRA BROWSER PASS: original simple-liquid-glass loupe, native rim, real refraction, iOS scene, menu and backtop.");

  // Also inspect the rebuilt /login experience in a real Chromium frame.
  // This is a UI-only smoke check: it never sends credentials or creates users.
  await send("Page.navigate",{url:"http://127.0.0.1:"+port+"/login"});
  await waitFor(async()=>await evaluate('!!document.querySelector(".da-auth-formside")'),12000);
  await waitFor(async()=>await evaluate('!!document.querySelector(".da-auth-bottom button")'));
  const loginFrame=await evaluate(`(() => {
    const shell=document.querySelector(".da-auth-shell");
    const header=document.querySelector(".da-auth-panel h1");
    const form=document.querySelector(".da-auth-form");
    return {title:header?.textContent,form:!!form,shell:!!shell,
      font:getComputedStyle(form).fontFamily,
      darkPanel:!!document.querySelector(".da-auth-showcase"),
      password:!!document.querySelector('input[autocomplete="current-password"]')}
  })()`);
  assert.equal(loginFrame.title,"ورود به دایرا");
  assert.equal(loginFrame.password,true);
  assert.equal(loginFrame.form,true);
  assert.equal(loginFrame.shell,true);
  assert.ok(loginFrame.font.includes("Vazirmatn"),"Login must use Persian Vazir typography");
  assert.equal(loginFrame.darkPanel,false,"No promotional or dark showcase in minimal auth");
  const loginNav=await evaluate(`(() => {
    const logo=document.querySelector(".da-auth-brand-link");
    const footer=document.querySelector(".da-auth-return-home");
    const header=document.querySelector(".da-auth-header");
    const submit=document.querySelector(".da-auth-submit");
    const panel=document.querySelector(".da-auth-panel");
    const logoBox=logo?.getBoundingClientRect();
    const panelBox=panel?.getBoundingClientRect();
    return {
      noTabs:!document.querySelector(".da-auth-main-tabs"),
      prompt:document.querySelector(".da-auth-bottom")?.textContent.trim(),
      logoHref:logo?.getAttribute("href"),
      footerHref:footer?.getAttribute("href"),
      footerText:footer?.textContent.trim(),
      logoCentered:Math.abs((logoBox?.left+logoBox?.right)/2-(panelBox?.left+panelBox?.right)/2)<2,
      headerJustify:getComputedStyle(header).justifyContent,
      submitJustify:getComputedStyle(submit).justifyContent,
      submitHasIcon:!!submit.querySelector("svg")
    };
  })()`);
  assert.equal(loginNav.noTabs,true);
  assert.ok(loginNav.prompt.includes("حساب ندارید؟") && loginNav.prompt.includes("ساخت حساب"));
  assert.equal(loginNav.logoHref,"/");
  assert.equal(loginNav.footerHref,"/");
  assert.equal(loginNav.footerText,"بازگشت به صفحه اصلی");
  assert.equal(loginNav.logoCentered,true,"Logo must be centered over the form");
  assert.equal(loginNav.headerJustify,"center");
  assert.equal(loginNav.submitJustify,"center");
  assert.equal(loginNav.submitHasIcon,false,"Primary action should have no arrow icon");
  const lightDesign=await evaluate(`(() => {
    const panel=document.querySelector(".da-auth-panel");
    const root=document.querySelector(".da-auth");
    const shine=document.querySelector(".da-auth-shine-border");
    return {
      bodyBackground:getComputedStyle(root).backgroundColor,
      cardBackground:getComputedStyle(panel).backgroundColor,
      shinePresent:!!shine,
      shineMotion:shine ? getComputedStyle(shine).animationName : "",
      cardWidth:panel.getBoundingClientRect().width,
      viewportWidth:innerWidth
    };
  })()`);
  assert.equal(lightDesign.bodyBackground,"rgb(248, 250, 252)");
  assert.equal(lightDesign.cardBackground,"rgb(255, 255, 255)");
  assert.equal(lightDesign.shinePresent,true,"Magic UI Shine Border should mount on the form");
  assert.ok(lightDesign.cardWidth<lightDesign.viewportWidth,"Desktop form remains a compact centered card");
  await evaluate('document.querySelector(".da-auth-bottom button").click()');
  await waitFor(async()=>await evaluate('!!document.querySelector("input[autocomplete=given-name]")'));
  const signupFields=await evaluate(`(() => ({
    first:!!document.querySelector('input[autocomplete="given-name"]'),
    last:!!document.querySelector('input[autocomplete="family-name"]'),
    tel:!!document.querySelector('input[autocomplete="tel"]'),
    passwords:document.querySelectorAll('input[autocomplete="new-password"]').length
  }))()`);
  assert.ok(signupFields.first && signupFields.last && signupFields.tel);
  assert.equal(signupFields.passwords,2);
  const signupVisual=await evaluate(`(() => {
    const fields=[...document.querySelectorAll(".da-auth-field")];
    const icons=fields.map(el=>el.querySelector(".da-auth-input > svg")?.getAttribute("class")).filter(Boolean);
    const button=document.querySelector(".da-auth-submit");
    return {
      title:document.querySelector(".da-auth-panel h1")?.textContent,
      prompt:document.querySelector(".da-auth-bottom")?.textContent.trim(),
      iconClasses:icons,
      iconsUnique:new Set(icons).size===icons.length,
      buttonText:button?.textContent.trim(),
      submitHasIcon:!!button.querySelector("svg"),
      submitJustify:getComputedStyle(button).justifyContent
    };
  })()`);
  assert.equal(signupVisual.title,"ثبت‌نام در دایرا");
  assert.equal(signupVisual.buttonText,"ثبت‌نام");
  assert.equal(signupVisual.submitJustify,"center");
  assert.equal(signupVisual.submitHasIcon,false);
  assert.ok(signupVisual.prompt.includes("حساب دارید؟") && signupVisual.prompt.includes("ورود"));
  assert.equal(signupVisual.iconsUnique,true,
    "Signup icons for given name, family name, phone, password and confirmation must differ");
  await evaluate('document.querySelector(".da-auth-bottom button").click()');
  await waitFor(async()=>await evaluate('!!document.querySelector("input[autocomplete=current-password]")'));
  await evaluate('document.querySelectorAll(".da-auth-methods button")[1].click()');
  await waitFor(async()=>await evaluate('!!document.querySelector(".da-auth-sms-status")'));
  await waitFor(async()=>await evaluate('document.querySelector(".da-auth-sms-status")?.textContent.includes("فعال نیست")'),12000);
  const smsInactive=await evaluate('document.querySelector(".da-auth-sms-status")?.textContent');
  assert.ok(smsInactive.includes("فعال نیست"),"Do not promise SMS before a provider is available");
  await evaluate('document.querySelectorAll(".da-auth-methods button")[0].click()');
  await waitFor(async()=>await evaluate('!!document.querySelector("input[autocomplete=current-password]")'));
  await evaluate('document.querySelector(".da-auth-aside button").click()');
  await waitFor(async()=>await evaluate('document.querySelector(".da-auth-panel h1")?.textContent==="بازیابی رمز عبور"'));
  assert.equal(await evaluate('document.querySelector(".da-auth-submit")?.disabled'),true,
    "SMS recovery should fail closed when provider is not configured");
  await evaluate('document.querySelector(".da-auth-back").click()');
  await waitFor(async()=>await evaluate('document.querySelector(".da-auth-panel h1")?.textContent==="ورود به دایرا"'));
  await send("Emulation.setDeviceMetricsOverride",{
    width:390,height:844,deviceScaleFactor:1,mobile:true
  });
  await sleep(160);
  const mobileAuth=await evaluate(`(() => ({
    screenWidth:innerWidth,
    noShowcase:!document.querySelector(".da-auth-showcase"),
    panelWidth:document.querySelector(".da-auth-panel").getBoundingClientRect().width,
    formWidth:document.querySelector(".da-auth-formside").getBoundingClientRect().width,
    noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+2
  }))()`);
  assert.equal(mobileAuth.noShowcase,true);
  assert.ok(mobileAuth.formWidth<=392 && mobileAuth.panelWidth<=392 && mobileAuth.noHorizontalOverflow,
    "Mobile auth should fit without x-axis scrolling");
  await evaluate('document.querySelector(".da-auth-bottom button").click()');
  await waitFor(async()=>await evaluate('!!document.querySelector("input[autocomplete=family-name]")'));
  const mobileSignup=await evaluate(`(() => ({
    noOverflow:document.documentElement.scrollWidth<=innerWidth+2,
    inputFont:getComputedStyle(document.querySelector('input[autocomplete="given-name"]')).fontSize,
    buttonCentered:getComputedStyle(document.querySelector(".da-auth-submit")).justifyContent==="center",
    footerVisible:!!document.querySelector(".da-auth-return-home")
  }))()`);
  assert.equal(mobileSignup.noOverflow,true,"Signup must fit narrow iPhone widths");
  assert.equal(mobileSignup.inputFont,"16px","Prevent Safari input focus zoom");
  assert.equal(mobileSignup.buttonCentered,true);
  assert.equal(mobileSignup.footerVisible,true);
  console.log("DAIRA_AUTH_CHROME_SMOKE="+JSON.stringify({
    login:true,signup:true,smsFailClosed:true,mobile:mobileAuth
  }));
} finally {
  try {socket?.close();} catch {}
  if (chrome && chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([once(chrome,"exit").catch(()=>{}),sleep(1200)]);
  }
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
