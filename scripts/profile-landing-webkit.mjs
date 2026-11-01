/**
 * Isolated WebKit scroll profiler. Unlike the optical correctness test, this
 * measures the same 75-step path with GSAP feature and title ablations.
 *
 * Enabled ONLY in CI builds with NEXT_PUBLIC_DAIRA_PROFILE=1, never by normal
 * production. The genuine liquid-glass implementation is never mocked.
 */
import { webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const app = spawn("./node_modules/.bin/next", ["start", "-p", "3209"], {
  stdio: "ignore", env: { ...process.env, PORT: "3209" }
});
let browser;

function percentile(values, frac) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b) => a-b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(frac * (sorted.length - 1)))] * 10) / 10;
}
function summarize(frames) {
  const durations = frames.map(f=>f.dt).filter(v=>v>0);
  return {p50:percentile(durations,.5),p95:percentile(durations,.95),
    max:percentile(durations,1),over100:durations.filter(d=>d>100).length,
    over250:durations.filter(d=>d>250).length,
    top:frames.filter(f=>f.dt>0).sort((a,b)=>b.dt-a.dt).slice(0,8)};
}

try {
  let ready = false;
  for (let i=0;i<100;i++) {
    if (app.exitCode!==null) throw Error("Next server exited before WebKit profiling");
    try {
      if ((await fetch("http://127.0.0.1:3209/")).ok) { ready = true; break; }
    } catch {}
    await sleep(250);
  }
  if (!ready) throw Error("Profiler server never became ready");
  await mkdir("artifacts/landing-webkit", {recursive:true});
  browser = await webkit.launch({headless:true});
  // Three isolated cold-context comparisons fit within WebKit runner memory.
  // Further repetitions are intentionally separate CI runs, not concurrent tabs.
  // Reverse the order: if the first cold context stalls regardless of mode,
  // the previous apparent heading cost was a warmup confound, not causation.
  const modes = ["no-heading", "normal", "no-both"];
  const results = [];
  for (const mode of modes) {
    const context = await browser.newContext({
      viewport:{width:390,height:844}, deviceScaleFactor:2,
      isMobile:true,hasTouch:true,
      userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    });
    const page=await context.newPage();
    const profile=mode==="normal" ? "" : "?__daira_profile="+mode;
    await page.goto("http://127.0.0.1:3209/"+profile,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(()=>{
      const lens=document.querySelector(".daira-library-liquid-header");
      const frame=document.querySelector(".daira-library-glass-frame");
      return lens?.dataset.glassStrategy==="webgl" &&
        frame?.dataset.opticalEverReady==="true" &&
        document.querySelector(".ap-site")?.dataset.gsapMotion==="true";
    },null,{timeout:30000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(1100);
    const result=await page.evaluate(async ()=>{
      window.scrollTo({top:0,behavior:"instant"});
      const boundary={};
      for(const selector of [".ap-hero","#features","#ap-features-title",
          "#feature-comment","#feature-story","#feature-direct"]) {
        const el=document.querySelector(selector);
        if(el) {
          const rect=el.getBoundingClientRect();
          boundary[selector]={top:Math.round(rect.top+window.scrollY),
            bottom:Math.round(rect.bottom+window.scrollY)};
        }
      }
      const frames=[];let previous=0;
      for(let i=0;i<75;i++){
        const now=await new Promise(resolve=>requestAnimationFrame(resolve));
        const dt=previous?Math.round((now-previous)*10)/10:0;
        previous=now;
        scrollBy(0,28);
        frames.push({y:scrollY,dt});
      }
      const card=document.querySelector("#feature-comment");
      const title=document.querySelector("#ap-features-title");
      const root=document.querySelector(".ap-site");
      return {boundary,frames,scrollEnd:scrollY,
        glass:document.querySelector(".daira-library-liquid-header")?.dataset.glassStrategy,
        headingShown:title?.dataset.gsapShown==="true",
        firstCardPhase:card?.dataset.gsapPhase,
        firstCardStarted:!!card?.dataset.gsapStarted,
        motion:root?.dataset.gsapMotion};
    });
    const summary=summarize(result.frames);
    const entry={mode,run:results.filter(x=>x.mode===mode).length+1,
      boundary:result.boundary,summary,firstCardPhase:result.firstCardPhase,
      firstCardStarted:result.firstCardStarted,headingShown:result.headingShown,
      glass:result.glass,scrollEnd:result.scrollEnd,frames:result.frames};
    results.push(entry);
    console.log("WEBKIT_PROFILE="+JSON.stringify({
      mode:entry.mode,run:entry.run,summary:entry.summary,
      boundary:entry.boundary,firstCardPhase:entry.firstCardPhase,
      headingShown:entry.headingShown,glass:entry.glass
    }));
    await context.close();
  }
  const grouped=Object.fromEntries(["normal","no-heading","no-both"].map(mode=>{
    const variants=results.filter(r=>r.mode===mode);
    return [mode,{runs:variants.length,
      max:variants.map(r=>r.summary.max),
      p95:variants.map(r=>r.summary.p95),
      over250:variants.map(r=>r.summary.over250)}];
  }));
  console.log("WEBKIT_PROFILE_SUMMARY="+JSON.stringify(grouped));
  await writeFile("artifacts/landing-webkit/gsap-ablation-profile.json",
    JSON.stringify({grouped,results},null,2));
} catch(error) {
  console.error("WEBKIT_PROFILE_ERROR",error);
  process.exitCode=1;
} finally {
  await browser?.close().catch(()=>{});
  app.kill("SIGTERM");
}
