const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const output=path.join(process.cwd(),"public","qa");
  fs.mkdirSync(output,{recursive:true});
  const reports=[];
  for(const {name,width,height} of [
    {name:"desktop",width:1440,height:900},
    {name:"mobile",width:390,height:844},
    {name:"narrow",width:320,height:720},
  ]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    await page.goto("http://127.0.0.1:3000/",{waitUntil:"domcontentloaded",timeout:120000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(2000);
    const metrics=await page.evaluate(()=>{
      const header=document.querySelector(".ap-header");
      const btn=document.querySelector(".ap-menu-toggle");
      const stage=document.querySelector(".ap-hero");
      const rect=btn.getBoundingClientRect();
      return {
        width:window.innerWidth,docWidth:document.documentElement.scrollWidth,
        heroHeight:stage.getBoundingClientRect().height,
        firstScroll:window.scrollY,
        hamburgerRightSpace:window.innerWidth-rect.right,
        menuButtonVisible:rect.width>30,
        stages:document.querySelectorAll(".ap-showcase-scene").length,
        videos:document.querySelectorAll("main video").length,
        glass:[...document.querySelectorAll("[data-glass-strategy]")].map(e=>({
          strategy:e.getAttribute("data-glass-strategy"),
          reason:e.getAttribute("data-glass-reason"),
        })),
      };
    });
    if(metrics.docWidth>width+2||metrics.stages!==11||metrics.videos||!metrics.menuButtonVisible)
      throw Error(name+": layout invalid: "+JSON.stringify(metrics));
    await page.screenshot({path:path.join(output,"landing-"+name+".jpg"),type:"jpeg",quality:82});
    await page.locator(".ap-menu-toggle").click();
    await page.waitForTimeout(850);
    const menu=await page.evaluate(()=>{
      const panel=document.querySelector(".ap-menu");
      const links=[...document.querySelectorAll(".ap-menu__nav a")];
      const bounds=panel.getBoundingClientRect();
      return {linkCount:links.length,open:panel.classList.contains("ap-menu--open"),rightGap:window.innerWidth-bounds.right};
    });
    if(!menu.open||menu.linkCount!==6||menu.rightGap<8||menu.rightGap>32)
      throw Error(name+": menu invalid: "+JSON.stringify(menu));
    await page.screenshot({path:path.join(output,"menu-"+name+".jpg"),type:"jpeg",quality:82});
    await page.keyboard.press("Escape");
    await page.locator("#feature-comment").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    const scene=await page.evaluate(()=>({
      active:document.querySelector("#feature-comment").classList.contains("is-playing"),
      typed:document.querySelector("#feature-comment [data-type-target]")?.textContent,
      firstVisible:document.querySelector("#feature-comment .ap-demo")?.getBoundingClientRect().width,
    }));
    await page.screenshot({path:path.join(output,"scene-"+name+".jpg"),type:"jpeg",quality:82});
    if(!scene.active||!scene.firstVisible)
      throw Error(name+": scroll-driven scene failed to activate: "+JSON.stringify(scene));
    if(errors.length)throw Error(name+": browser exceptions "+JSON.stringify(errors.slice(0,3)));
    reports.push({name,metrics,menu,scene,errors});
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(output,"liquid-showcase-report.json"),JSON.stringify(reports,null,2)+"\n");
  console.log("DAIRA_GLASS_SHOWCASE_BROWSER_QA",JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exit(1)});
