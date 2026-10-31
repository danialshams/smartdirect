/** Production visual audit. Visits the public deployed domain, not localhost. */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const target="https://smartdirect.vercel.app/";
let browser, socket, dir, id=0;
const pending=new Map();
async function until(fn,timeout=25000) {
  const stop=Date.now()+timeout;let last;
  while(Date.now()<stop){try {const v=await fn();if(v)return v;}catch(e){last=e;}await wait(200);}
  throw Error("Timed out waiting for public site "+(last?.message||""));
}
function send(method,params={}) {
  return new Promise((resolve,reject)=>{
    const n=++id;
    const timer=setTimeout(()=>{pending.delete(n);reject(Error("CDP timeout "+method));},20000);
    pending.set(n,{resolve,reject,timer});
    socket.send(JSON.stringify({id:n,method,params}));
  });
}
async function evaluate(expression){
  const data=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(data.exceptionDetails) throw Error("Evaluation failed "+JSON.stringify(data.exceptionDetails));
  return data.result?.value;
}
async function shot(name){
  const rect=await evaluate(`(() => {
    const h=document.querySelector(".ap-header");
    const b=document.querySelector(".daira-library-liquid-header");
    const o=b?.querySelector('div[style*="backdrop-filter"]');
    return {url:location.href,scroll:scrollY,viewport:[innerWidth,innerHeight],
      header:{box:h?.getBoundingClientRect().toJSON(),backdrop:getComputedStyle(h).backdropFilter,
        opacity:getComputedStyle(h).opacity,filter:getComputedStyle(h).filter},
      lens:{mode:b?.dataset.liquidHeader||b?.dataset.glassStrategy||b?.dataset.opticsMode,
        libraryRim:b?.querySelector(".liquid-glass-border") && getComputedStyle(b.querySelector(".liquid-glass-border")).display,
        background:b&&getComputedStyle(b).backgroundColor,
        opticalFilter:o&&getComputedStyle(o).backdropFilter,
        displacement:b&&[...b.querySelectorAll("feDisplacementMap")].map(x=>x.getAttribute("scale"))}};
  })()`);
  console.log("LIVE_DIAG_"+name+"="+JSON.stringify(rect));
  const img=(await send("Page.captureScreenshot",{format:"jpeg",quality:74,captureBeyondViewport:false})).data;
  console.log("LIVE_SHOT_"+name+"="+img);
}
try{
  dir=await mkdtemp(join(tmpdir(),"daira-prod-"));
  browser=spawn(process.env.CHROME_BIN||"/usr/bin/google-chrome",
    ["--headless=new","--no-sandbox","--disable-dev-shm-usage","--no-first-run",
     "--user-data-dir="+dir,"--remote-debugging-port=19288","--remote-allow-origins=*",
     "--window-size=1360,900",target],{stdio:"ignore"});
  const page=await until(async()=>{
    if(browser.exitCode!==null)throw Error("Chromium exited "+browser.exitCode);
    const response=await fetch("http://127.0.0.1:19288/json/list");
    const list=await response.json();return list.find(v=>v.type==="page"&&v.webSocketDebuggerUrl);
  });
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await once(socket,"open");
  socket.addEventListener("message",ev=>{
    let data;try{data=JSON.parse(ev.data);}catch{return;}
    const job=pending.get(data.id);if(!job)return;pending.delete(data.id);clearTimeout(job.timer);
    data.error?job.reject(Error(JSON.stringify(data.error))):job.resolve(data.result);
  });
  await send("Page.enable");await send("Runtime.enable");
  await until(async()=>evaluate('document.readyState==="complete"&&document.querySelector(".daira-library-liquid-header")?.dataset.glassStrategy==="svg"'));
  await wait(1200);
  await shot("desktop_top");
  await evaluate('window.scrollTo({top:1350,behavior:"instant"})');
  await until(async()=>evaluate("window.scrollY>650"));
  await wait(900);
  await shot("desktop_scrolled");
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send("Emulation.setTouchEmulationEnabled",{enabled:true});
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  await wait(350);
  await shot("mobile_top");
  await evaluate('window.scrollTo({top:1350,behavior:"instant"})');
  await until(async()=>evaluate("window.scrollY>650"));
  await wait(700);
  await shot("mobile_scrolled");
  await until(async()=>evaluate('document.documentElement.dataset.dairaHero==="done"'),9000);
  const checks=await evaluate(`(() => {
    const lens=document.querySelector(".daira-library-liquid-header");
    const rim=lens?.querySelector(".liquid-glass-border");
    const back=document.querySelector(".ap-backtop__blue-blur");
    return {strategy:lens?.dataset.glassStrategy,
      rimDisplay:rim&&getComputedStyle(rim).display,
      shellReady:document.querySelector(".daira-library-glass-frame")?.dataset.glassReady,
      parentBlur:getComputedStyle(document.querySelector(".ap-header")).backdropFilter,
      backBlur:back&&getComputedStyle(back).backdropFilter,
      heroState:document.documentElement.dataset.dairaHero,
      heroIgnored:document.querySelector("[data-hero-assembly]")?.hasAttribute("data-liquid-glass-ignore"),
      sceneCache:document.querySelector("[data-liquid-glass-scene]")!==null};
  })()`);
  console.log("LIVE_POST_FIX_CHECKS="+JSON.stringify(checks));
  if(checks.strategy!=="svg"||checks.rimDisplay!=="none"||checks.shellReady!=="true"||checks.parentBlur!=="none"||
    !checks.backBlur?.includes("blur(15px)")||
    checks.heroState!=="done"||checks.heroIgnored)throw Error("Published landing polish mismatch");
  console.log("LIVE_AUDIT_SUCCESS_POST_RELEASE_PR185");
}catch(e){console.error("LIVE_AUDIT_FAILED",e);process.exitCode=1;}
finally {try{socket?.close();}catch{}try{browser?.kill("SIGKILL");}catch{}
  if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});}
