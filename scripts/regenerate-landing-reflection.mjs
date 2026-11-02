/**
 * Rebuild Safari/Firefox static reflection tiles from the CURRENT public UI.
 * No Playwright or third-party runtime dependency: Chrome DevTools Protocol
 * and Node 24's built-in WebSocket. This deliberately produces pixel images
 * only; never changes the real SVG Liquid Glass shader, lens or capture cache.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function eventually(fn,ms=45000){
  const end=Date.now()+ms;let last;
  while(Date.now()<end){try{const value=await fn();if(value)return value}catch(e){last=e}
    await sleep(180);}
  throw new Error("Timed out waiting for browser "+String(last?.message??""));
}
const port=Number(process.env.REFLECTION_PORT||3248);
const debugPort=Number(process.env.REFLECTION_DEBUG_PORT||19548);
const origin="http://127.0.0.1:"+port;
const env={
  ...process.env,NODE_ENV:"production",
  NEXTAUTH_URL:origin,
  NEXTAUTH_SECRET:process.env.NEXTAUTH_SECRET||"ci-only-placeholder-secret-with-more-than-32-characters",
  CRON_SECRET:process.env.CRON_SECRET||"ci-only-placeholder-cron-secret-with-more-than-32-characters",
  DATABASE_URL:process.env.DATABASE_URL||"postgresql://user:password@127.0.0.1:5432/smartdirect?sslmode=disable",
  DIRECT_URL:process.env.DIRECT_URL||"postgresql://user:password@127.0.0.1:5432/smartdirect?sslmode=disable",
  REDIS_DRIVER:"redis",REDIS_URL:"redis://127.0.0.1:6379"
};
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{env,stdio:"ignore"});
const profile=await mkdtemp(join(tmpdir(),"daira-reflection-"));
let chrome,ws;
let sequence=0;const waiting=new Map();
const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++sequence;
  const timer=setTimeout(()=>{waiting.delete(id);reject(new Error("CDP timeout: "+method))},25000);
  waiting.set(id,{resolve,reject,timer});
  ws.send(JSON.stringify({id,method,params}));
});
function onMessage(event){
  const x=JSON.parse(event.data);
  if(!x.id)return;
  const current=waiting.get(x.id);if(!current)return;
  waiting.delete(x.id);clearTimeout(current.timer);
  if(x.error)current.reject(new Error(JSON.stringify(x.error)));
  else current.resolve(x.result);
}
const evalPage=async expression=>{
  const data=await call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
  if(data.exceptionDetails)throw new Error("CDP JavaScript: "+JSON.stringify(data.exceptionDetails));
  return data.result?.value;
};
try{
  await eventually(async()=>{if(server.exitCode!==null)throw Error("Server exit "+server.exitCode);
    const r=await fetch(origin);return r.ok});
  chrome=spawn(process.env.CHROME_BIN||"/usr/bin/google-chrome",[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage","--no-first-run",
    "--user-data-dir="+profile,"--remote-debugging-port="+debugPort,
    "--remote-allow-origins=*","--hide-scrollbars","--force-device-scale-factor=1",
    "--window-size=1280,900",origin
  ],{stdio:"ignore"});
  const tab=await eventually(async()=>{
    if(chrome.exitCode!==null)throw Error("Chrome exit "+chrome.exitCode);
    const r=await fetch("http://127.0.0.1:"+debugPort+"/json/list");
    const p=await r.json();return p.find(t=>t.type==="page"&&t.webSocketDebuggerUrl);
  });
  ws=new WebSocket(tab.webSocketDebuggerUrl);await once(ws,"open");
  ws.addEventListener("message",onMessage);
  await call("Runtime.enable");await call("Page.enable");
  await mkdir("public/landing-reflection",{recursive:true});
  for(const [name,width,height] of [["desktop",1280,900],["mobile",390,844]]){
    await call("Emulation.setDeviceMetricsOverride",{
      width,height,deviceScaleFactor:1,mobile:false,screenWidth:width,screenHeight:height
    });
    await call("Page.navigate",{url:origin+"/?reflection-build="+name});
    await eventually(async()=>evalPage('document.readyState==="complete" && !!document.querySelector(".dv-scene--faq")'));
    await evalPage(`(async()=>{
      await document.fonts.ready;
      const css=document.createElement("style");
      css.textContent=".ap-header,.ap-backtop,.daira-static-reflection{visibility:hidden!important} .ap-site [data-dv-reveal],.ap-site [data-reveal],.ap-site [data-footer-callout], .ap-site .ap-social-card,.ap-site .ap-motion-reveal-title>span, .ap-site .ap-hero__typed{opacity:1!important;visibility:visible!important;transform:none!important;transition:none!important;animation:none!important} .ap-site .dv-aurora,.ap-site .dv-aurora *{animation:none!important} html{scroll-behavior:auto!important}";

      document.head.appendChild(css);
      const images=[...document.querySelectorAll(".ap-site:not(.daira-static-reflection) img")];
      for(const img of images){img.loading="eager";img.decoding="sync"}
      await Promise.race([Promise.all(images.map(i=>i.decode().catch(()=>{}))),
        new Promise(r=>setTimeout(r,20000))]);
      return true;
    })()`);
    await sleep(1000);
    const info=await evalPage(`(() => {
      const root=document.querySelector(".ap-site[data-liquid-glass-scene]");
      if(!root)return {count:-1};
      const nodes=[...root.children].filter(el=>el.matches("main#content,.ap-showcase-capture,footer.ap-footer--extended"));
      return {count:nodes.length,rects:nodes.map(node=>{
        const rect=node.getBoundingClientRect();
        return {y:Math.max(0,rect.top+scrollY),x:Math.max(0,rect.left+scrollX),
          width:Math.round(rect.width),height:Math.ceil(rect.height)};
      })};
    })()`);
    assert.equal(info.count,10,"WebKit optical topology must have ten tiles");
    for(let i=0;i<info.count;i++){
      const box=info.rects[i];
      assert.ok(box.width>0&&box.height>0&&box.height<5000,"Invalid optical tile "+i+":"+JSON.stringify(box));
      const shot=await call("Page.captureScreenshot",{
        format:"jpeg",quality:78,fromSurface:true,captureBeyondViewport:true,
        clip:{x:box.x,y:box.y,width:box.width,height:box.height,scale:1}
      });
      const bytes=Buffer.from(shot.data,"base64");
      assert.ok(bytes.byteLength>7000,"Unexpected blank reflection tile "+i);
      const filename="public/landing-reflection/"+name+"-"+i+".jpg";
      await writeFile(filename,bytes);
      console.log("DAIRA_REFLECTION_TILE="+JSON.stringify({filename,bytes:bytes.byteLength,width:box.width,height:box.height}));
    }
  }
  console.log("DAIRA_REFLECTION_REGENERATED=20");
}catch(error){
  console.error("DAIRA_REFLECTION_REGEN_FAILED",error);
  process.exitCode=1;
}finally{
  ws?.close();chrome?.kill("SIGTERM");server.kill("SIGTERM");
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
  for(const job of waiting.values())clearTimeout(job.timer);
}
