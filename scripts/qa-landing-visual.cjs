/* One-time GitHub Actions visual QA for Daira's public homepage. */
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const dir=path.join(process.cwd(),"public","qa");
  fs.mkdirSync(dir,{recursive:true});
  const results=[];
  for(const {width,height,name} of [
    {width:1440,height:900,name:"desktop"},
    {width:390,height:844,name:"mobile"},
    {width:320,height:720,name:"small-mobile"},
  ]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    await page.goto("http://127.0.0.1:3000/",{waitUntil:"domcontentloaded",timeout:120000});
    await Promise.race([page.evaluate(()=>document.fonts.ready),page.waitForTimeout(12000)]);
    await page.waitForTimeout(1300);
    const metrics=await page.evaluate(()=>{
      const header=document.querySelector(".ap-header");
      const hero=document.querySelector(".ap-hero");
      const title=document.querySelector("h1");
      const rect=title?.getBoundingClientRect();
      return {
        scrollWidth:document.documentElement.scrollWidth,
        innerWidth:window.innerWidth,
        overflow:document.documentElement.scrollWidth-window.innerWidth,
        heroHeight:hero?.getBoundingClientRect().height,
        headerHeight:header?.getBoundingClientRect().height,
        h1Height:rect?.height,
        h1Width:rect?.width,
        font:getComputedStyle(title).fontFamily,
        visible:!!rect&&rect.width>100&&rect.height>70,
        sourceImages:document.querySelectorAll("main img,main video").length,
        startScrollY:window.scrollY,
      };
    });
    if(metrics.overflow>2||!metrics.visible||metrics.sourceImages>0)
      throw Error(name+" layout invalid: "+JSON.stringify(metrics));
    await page.screenshot({path:path.join(dir,"apple-"+name+".jpg"),type:"jpeg",quality:83});
    await page.locator("#experience").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1150);
    await page.screenshot({path:path.join(dir,"story-"+name+".jpg"),type:"jpeg",quality:80});
    results.push({name,...metrics});
    await page.close();
  }
  fs.writeFileSync(path.join(dir,"layout-report.json"),JSON.stringify(results,null,2)+"\n");
  await browser.close();
  console.log("DAIRA_VISUAL_QA",JSON.stringify(results));
})().catch(err=>{console.error(err);process.exit(1)});
