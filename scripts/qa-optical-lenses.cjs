const fs = require("node:fs");
const path = require("node:path");
const { chromium, webkit } = require("playwright");

const out = path.join(process.cwd(), "public", "qa-liquid");
fs.mkdirSync(out, { recursive: true });

(async () => {
  const results = [];
  for (const [browserName, engine] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await engine.launch({headless:true,args:browserName==="chromium"?["--no-sandbox","--disable-dev-shm-usage"]:[]});
    for (const size of [{name:"desktop",width:1280,height:850},{name:"mobile",width:390,height:844}]) {
      const page = await browser.newPage({viewport:size,deviceScaleFactor:1, reducedMotion:"no-preference"});
      const errors = [];
      page.on("pageerror",e=>errors.push(e.message));
      await page.goto("http://127.0.0.1:3000",{waitUntil:"domcontentloaded",timeout:120000});
      await page.waitForTimeout(2000);
      const initial=await page.evaluate(()=>{
        const glass=[...document.querySelectorAll("[data-glass-strategy]")];
        return {
          scroll:scrollY,overflow:document.documentElement.scrollWidth-window.innerWidth,
          strategies:glass.map(x=>({str:x.getAttribute("data-glass-strategy"),reason:x.getAttribute("data-glass-reason")})),
        };
      });
      await page.screenshot({path:path.join(out,browserName+"-"+size.name+"-header.jpg"),type:"jpeg",quality:82});
      await page.locator(".ap-menu-toggle").click();
      await page.waitForTimeout(1200);
      const menu=await page.evaluate(()=>{
        const nav=document.querySelector(".ap-menu");
        const glass=[...document.querySelectorAll("[data-glass-strategy]")];
        const r=nav.getBoundingClientRect();
        return {open:nav.classList.contains("ap-menu--open"),left:r.left,rightGap:innerWidth-r.right,links:nav.querySelectorAll("a").length,
          glass:glass.map(x=>({str:x.getAttribute("data-glass-strategy"),reason:x.getAttribute("data-glass-reason")}))};
      });
      await page.screenshot({path:path.join(out,browserName+"-"+size.name+"-menu.jpg"),type:"jpeg",quality:82});
      await page.keyboard.press("Escape");
      await page.locator("#feature-direct").scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await page.locator(".ap-menu-toggle").click();
      await page.waitForTimeout(900);
      await page.screenshot({path:path.join(out,browserName+"-"+size.name+"-dark-menu.jpg"),type:"jpeg",quality:82});
      if(initial.overflow>2)throw Error(browserName+" "+size.name+" horizontal overflow "+JSON.stringify(initial));
      if(!menu.open || menu.links!==6||menu.rightGap<8||menu.rightGap>32)throw Error(browserName+" "+size.name+" menu geometry "+JSON.stringify(menu));
      if(!menu.glass.some(g=>g.str==="svg"||g.str==="webgl"))throw Error(browserName+" "+size.name+" no actual optical renderer "+JSON.stringify(menu.glass));
      if(errors.length)throw Error(browserName+" "+size.name+" JS errors "+JSON.stringify(errors));
      results.push({engine:browserName,viewport:size.name,initial,menu,errors});
      await page.close();
    }
    await browser.close();
  }
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(results,null,2)+"\n");
  console.log("LIQUID_GLASS_OPTICAL_REVIEW",JSON.stringify(results));
})().catch(err=>{console.error(err);process.exit(1)});
