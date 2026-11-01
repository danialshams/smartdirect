/** Regenerate exact, static WebKit reflection pixels after homepage design changes.
 * Only these images, NOT the actual Liquid Glass shader, are prerendered.
 * Requires a production Next.js build plus Playwright WebKit.
 */
import { webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const port=3199;
const server=spawn("./node_modules/.bin/next",["start","-p",String(port)],{
  stdio:"ignore",env:{...process.env,NODE_ENV:"production",PORT:String(port)}
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
try {
  let ready=false;
  for(let i=0;i<120;i++){
    if(server.exitCode!==null)throw Error("Next.js terminated before reflection export");
    try{const res=await fetch(`http://127.0.0.1:${port}/`);if(res.ok){ready=true;break;}}catch{}
    await sleep(250);
  }
  if(!ready)throw Error("Next.js export server unavailable");
  await mkdir("public/landing-reflection",{recursive:true});
  browser=await webkit.launch({headless:true});
  for(const variant of ["mobile","desktop"]){
    const width=variant==="mobile"?390:1280;
    const height=variant==="mobile"?844:900;
    // Use REAL WebKit layout, without its live optical capture queue. The
    // user-facing page remains unchanged; only raster source snapshots are
    // recorded here. All interactions render in their settled end state.
    const context=await browser.newContext({
      viewport:{width,height},
      deviceScaleFactor:1,
      reducedMotion:"reduce",
      userAgent:"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/605.1.15"
    });
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:"domcontentloaded",timeout:45000});
    await page.evaluate(()=>document.fonts.ready);
    await page.addStyleTag({content:`
      .ap-header,.ap-backtop,.daira-static-reflection{visibility:hidden!important}
      .ap-site [data-reveal],.ap-site .ap-social-card,
      .ap-site .daira-text-mask__inner,.ap-site .ap-hero__word {
        opacity:1!important;visibility:visible!important;transform:none!important;
        animation:none!important;transition:none!important;
      }
      .ap-site .ap-hero__cta::before{animation:none!important}
    `});
    const selectors=[
      "main#content",
      ...Array.from({length:8},(_,i)=>`.ap-showcase-capture:nth-of-type(${i+1})`),
      ".ap-site[data-liquid-glass-scene] > footer.ap-footer--extended"
    ];
    const sections=await page.locator(".ap-site[data-liquid-glass-scene] > main, .ap-site[data-liquid-glass-scene] > .ap-showcase-capture, .ap-site[data-liquid-glass-scene] > footer.ap-footer--extended").all();
    if(sections.length!==10)throw Error(`Expected ten optical source sections, got ${sections.length} (${variant})`);
    for(let i=0;i<sections.length;i++){
      const section=sections[i];
      await section.scrollIntoViewIfNeeded({timeout:30000});
      await page.waitForTimeout(170);
      const info=await section.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
      if(Math.abs(info.width-width)>2||info.height<120)
        throw Error(`Optical source dimensions inconsistent: ${variant} index=${i} ${JSON.stringify(info)}`);
      let image;
      try{
        image=await section.screenshot({type:"jpeg",quality:84,scale:"css",animations:"disabled",timeout:45000});
      }catch(error){
        // Locator screenshots can time out on tall WebKit sections if element
        // stability never settles. The document-coordinate crop is equivalent.
        const rect=await section.evaluate(el=>{
          const box=el.getBoundingClientRect();
          return {x:0,y:Math.round(box.top+scrollY),width:Math.round(innerWidth),height:Math.round(box.height)};
        });
        console.log("WEBKIT_RASTER_FALLBACK "+variant+"-"+i+" "+String(error).slice(0,180));
        image=await page.screenshot({type:"jpeg",quality:84,scale:"css",clip:rect,timeout:45000});
      }
      if(image.length<1500)throw Error(`Blank export ${variant}-${i}`);
      if(i===9){
        const rgb=await page.evaluate(async base64=>{
          const el=new Image();el.src="data:image/jpeg;base64,"+base64;await el.decode();
          const canvas=document.createElement("canvas");canvas.width=el.naturalWidth;canvas.height=el.naturalHeight;
          const ctx=canvas.getContext("2d");ctx.drawImage(el,0,0);
          return [...ctx.getImageData(5,5,1,1).data].slice(0,3);
        },image.toString("base64"));
        console.log("DAIRA_FOOTER_REFLECTION_RGB="+JSON.stringify({variant,rgb}));
        if(rgb.some(c=>c>115))throw Error("Footer snapshot must reflect the updated dark footer, not stale light artwork");
      }
      await writeFile(`public/landing-reflection/${variant}-${i}.jpg`,image);
      console.log(`DAIRA_REFLECTION_EXPORTED=${variant}-${i}: ${image.length} bytes`);
    }
    await context.close();
  }
  console.log("DAIRA_REFLECTION_EXPORTED_COMPLETE=20");
}catch(error){
  console.error("DAIRA_REFLECTION_EXPORT_FAILED",error);
  process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  server.kill("SIGTERM");
}
