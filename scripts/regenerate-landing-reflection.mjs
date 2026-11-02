/**
 * Regenerate the exact (non-refracted) optical source pixels after layout edits.
 * Chromium is used only as a screenshot renderer: the original WebGL loupe
 * remains unchanged and independent on Safari/Firefox.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const app=spawn("./node_modules/.bin/next",["start","-p","3198"],{
  stdio:"ignore",env:{...process.env,PORT:"3198"}
});
let browser;
try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(app.exitCode!==null)throw Error("Next.js server terminated before capture");
    try{const r=await fetch("http://127.0.0.1:3198/");if(r.ok){ready=true;break;}}catch{}
    await sleep(250);
  }
  if(!ready)throw Error("Next.js was not ready");
  browser=await chromium.launch({headless:true});
  await mkdir("public/landing-reflection",{recursive:true});
  for(const [variant,width,height] of [["mobile",390,844],["desktop",1280,900]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:"reduce"});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:3198/",{waitUntil:"domcontentloaded",timeout:35000});
    await page.evaluate(()=>document.fonts.ready);
    await page.addStyleTag({content:`
      .ap-header,.ap-backtop,.daira-static-reflection{visibility:hidden!important}
      .ap-site [data-reveal],.ap-site [data-reveal] *,
      .ap-site .ap-social-card,.ap-site .ap-motion-reveal-title>span,
      .ap-site .ap-hero__word,.ap-site [data-footer-callout]{
        opacity:1!important;visibility:visible!important;transform:none!important;
        transition:none!important;animation:none!important;
      }
      .ap-site .ap-hero__cta::before{animation:none!important}
    `});
    const selectors=[
      "main#content",
      ...Array.from({length:8},(_,i)=>`.ap-showcase-capture:nth-of-type(${i+1})`),
      "footer.ap-footer--extended"
    ];
    const root=page.locator(".ap-site[data-liquid-glass-scene]");
    const children=root.locator(":scope > main, :scope > .ap-showcase-capture, :scope > footer.ap-footer--extended");
    const n=await children.count();
    if(n!==10)throw Error(`Expected 10 genuine source tiles at ${width}px, got ${n}`);
    for(let i=0;i<n;i++){
      const item=children.nth(i);
      await item.scrollIntoViewIfNeeded({timeout:18000});
      const bytes=await item.screenshot({type:"jpeg",quality:85,scale:"css",animations:"disabled",timeout:45000});
      const path=`public/landing-reflection/${variant}-${i}.jpg`;
      await writeFile(path,bytes);
      console.log("DAIRA_EXACT_OPTICAL_TILE="+JSON.stringify({path,bytes:bytes.byteLength}));
    }
    await context.close();
  }
  console.log("DAIRA_OPTICAL_TILES_REGENERATED=20");
}catch(e){
  console.error("DAIRA_OPTICAL_CAPTURE_ERROR",e);
  process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  app.kill("SIGTERM");
}
