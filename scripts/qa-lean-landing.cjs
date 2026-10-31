const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const out=path.join(process.cwd(),"public","qa-lean");
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const reports=[];
  for(const [engineName,engine] of [["chromium",chromium],["webkit",webkit]]){
    const browser=await engine.launch({headless:true,args:engineName==="chromium"?["--no-sandbox","--disable-dev-shm-usage"]:[]});
    for(const {name,width,height} of [
      {name:"desktop",width:1280,height:840},
      {name:"mobile",width:390,height:844},
      {name:"tiny",width:320,height:690},
    ]){
      const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
      const errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.goto("http://127.0.0.1:3000/",{waitUntil:"domcontentloaded",timeout:120000});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(900);
      const initial=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-innerWidth,
        introCount:document.querySelectorAll(".ap-feature").length,
        animationCards:document.querySelectorAll(".ap-demo,.ap-showcase-scene,video").length,
        headerIgnored:document.querySelector(".ap-header")?.hasAttribute("data-liquid-glass-ignore"),
        captureSplits:{
          main:getComputedStyle(document.querySelector(".ap-site > main")).overflow,
          footer:getComputedStyle(document.querySelector(".ap-site > .ap-footer")).overflow,
        },
        glassNodes:document.querySelectorAll("[data-glass-strategy]").length,
        loginStyle:getComputedStyle(document.querySelector(".ap-header__panel-login")).color,
        initialScroll:scrollY,
        mainHeight:document.querySelector("main")?.getBoundingClientRect().height,
      }));
      if(initial.overflow>2||initial.introCount!==11||initial.animationCards!==0||!initial.headerIgnored||initial.glassNodes!==2||initial.captureSplits.main!=="clip"||initial.captureSplits.footer!=="clip")
        throw Error(engineName+" "+name+" initial layout failed: "+JSON.stringify(initial));
      await page.screenshot({path:path.join(out,engineName+"-"+name+"-hero.jpg"),type:"jpeg",quality:80});
      await page.locator(".ap-menu-toggle").click();
      const begun=Date.now();
      try{
        await page.waitForFunction(()=>
          [...document.querySelectorAll("[data-glass-strategy]")].some(e=>["svg","webgl"].includes(e.getAttribute("data-glass-strategy"))),
          null,{timeout:18000,polling:300});
      }catch(e){console.log("WAIT_GLASS_TIMEOUT",engineName,name);}
      await page.waitForTimeout(500);
      const menu=await page.evaluate(()=>{
        const m=document.querySelector(".ap-menu");
        const r=m.getBoundingClientRect();
        const links=[...m.querySelectorAll("nav a")];
        return {open:m.classList.contains("ap-menu--open"),rightGap:innerWidth-r.right,links:links.map(a=>a.textContent?.trim()),
          strategy:[...document.querySelectorAll("[data-glass-strategy]")].map(x=>x.getAttribute("data-glass-strategy")),
          opacity:getComputedStyle(document.querySelector(".ap-menu__content")).backgroundColor,
          selfCapture:document.querySelector(".ap-header")?.getAttribute("data-liquid-glass-ignore")!==null};
      });
      if(!menu.open||menu.links.length!==6||menu.rightGap<8||menu.rightGap>30||!menu.strategy.some(v=>v==="svg"||v==="webgl"))
        throw Error(engineName+" "+name+" menu failed: "+JSON.stringify(menu));
      await page.screenshot({path:path.join(out,engineName+"-"+name+"-menu.jpg"),type:"jpeg",quality:80});
      await page.keyboard.press("Escape");
      await page.locator(".ap-feature").last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      const after=await page.evaluate(()=>({
        scroll:scrollY,overflow:document.documentElement.scrollWidth-innerWidth,
        glass:[...document.querySelectorAll("[data-glass-strategy]")].map(x=>x.getAttribute("data-glass-strategy")),
        totalCaptures:Number(document.querySelector(".ap-site")?.dataset.liquidGlassCaptures||0),
      }));
      await page.screenshot({path:path.join(out,engineName+"-"+name+"-features.jpg"),type:"jpeg",quality:80});
      if(after.overflow>2||errors.length)throw Error(engineName+" "+name+" errors: "+JSON.stringify({after,errors}));
      reports.push({engine:engineName,viewport:name,initial,menu,after,glassReadyMs:Date.now()-begun,errors});
      await page.close();
    }
    await browser.close();
  }
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(reports,null,2)+"\n");
  console.log("DAIRA_LEAN_VISUAL_QA",JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exit(1)});
