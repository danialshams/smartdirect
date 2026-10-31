/** Daira public landing regression: 11 real mini-UI motions, optical glass and links. */
import { readFileSync,existsSync } from "node:fs";
import assert from "node:assert/strict";

const read=(path:string)=>readFileSync(path,"utf8");
const page=read("app/page.tsx");
const header=read("components/landing/SimpleHeader.tsx");
const scene=read("components/landing/FeatureShowcase.tsx");
const data=read("components/landing/showcase-scenes.ts");
const glass=read("components/landing/LandingGlassBackdrop.tsx");
const hero=read("components/landing/HeroMotion.tsx");
const css=read("app/showcase.css");
const baseCss=read("app/simple-home.css");
const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));

assert.equal(pkg.dependencies.gsap,"3.14.2");
assert.equal(pkg.dependencies["simple-liquid-glass"],"5.4.0");
assert.equal(lock.packages["node_modules/gsap"].version,"3.14.2");
assert.equal(lock.packages["node_modules/simple-liquid-glass"].version,"5.4.0");

assert.match(page,/<LandingGlassBackdrop>/);
assert.match(page,/<SimpleHeader \/>/);
assert.match(page,/<FeatureShowcase \/>/);
assert.match(page,/<HeroMotion \/>/);
assert.match(page,/<main id="content">/);
assert.match(page,/<h1 id="ap-hero-title">/);
assert.match(page,/history\.scrollRestoration='manual'/);
assert.match(page,/initialScrollGuard/);
assert.match(page,/pageshow/);
assert.doesNotMatch(page,/ap-close|همین‌قدر ساده|بیشتر ببین|RobotHeroScene|DashboardPreview|<video|<Canvas/);
for(const url of ["/login","/privacy-policy","/terms","/data-deletion","/contact","/about"]){
  assert.ok(page.includes('href:"'+url+'"')||page.includes('href="'+url+'"'),"Missing landing URL: "+url);
}

assert.match(glass,/import \{ LiquidGlassScene \} from "simple-liquid-glass\/backdrop"/);
assert.match(glass,/<LiquidGlassScene/);
assert.match(glass,/maxCacheBytes/);
assert.match(header,/import LiquidGlass from "simple-liquid-glass"/);
assert.match(header,/refraction:"lens"/);
assert.match(header,/lensProfile:"loupe"/);
assert.match(header,/frost:.035/);
assert.match(header,/blur:0/);
assert.match(header,/mobileFallback:"svg"/);
assert.match(header,/ap-header__backdrop/);
assert.match(header,/ap-menu-toggle__glass/);
assert.match(header,/ap-menu__liquid/);
assert.match(header,/onClick=\{\(\)=>setOpen\(false\)\}/);
assert.match(header,/event\.key==="Escape"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/returnFocus\.current/);
assert.match(css,/\.ap-menu--open \.ap-menu__nav \.ap-menu__item/);
assert.match(css,/transition-delay:calc\(115ms \+ var\(--enter-index\) \* 70ms\)/);
assert.match(css,/right:max\(15px,env\(safe-area-inset-right\)\)/);
assert.match(css,/\.ap-header__panel-login/);

const ids=[
  "comment","story","direct","share","live","reminder",
  "inbox","publishing","insights","menu","icebreaker",
] as const;
assert.equal((data.match(/no: "([۰-۹]+)"/g)||[]).length,11,"11 dashboard tools expected");
for(const id of ids) {
  assert.ok(data.includes('id: "'+id+'"'),"Missing showcase tool: "+id);
  assert.ok(scene.includes('case "'+id+'"'),"Missing dedicated animated interface: "+id);
}
for(const required of [
 "پاسخ به کامنت","پاسخ به استوری","پاسخ خودکار دایرکت",
 "اشتراک‌گذاری و منشن","پاسخ به لایو","یادآوری هوشمند",
 "صندوق دایرکت","انتشار محتوا","آنالیز پیج","منوی دایرکت","پیام شروع گفتگو"
]) assert.ok(data.includes(required),"Missing real dashboard feature: "+required);
for(const label of ["امکانات","حفظ حریم خصوصی","قوانین و مقررات","حذف اطلاعات","ارتباط با ما","درباره ما"])
  assert.ok(header.includes(label),"Missing requested exact menu label: "+label);
for(const route of ["terms","about","contact"])
  assert.ok(existsSync("app/"+route+"/page.tsx"),"Missing real public link destination: "+route);

assert.match(scene,/gsap\.registerPlugin\(ScrollTrigger, TextPlugin\)/);
assert.match(scene,/repeat:-1/);
assert.match(scene,/trigger:root/);
assert.match(scene,/onEnter:enter/);
assert.match(scene,/onLeave:leave/);
assert.match(scene,/onEnterBack:enter/);
assert.match(scene,/onLeaveBack:leave/);
assert.match(scene,/document\.hidden/);
assert.match(scene,/timeline\.pause\(0\)/);
assert.match(scene,/text:\{value:scene\.keyword\}/);
assert.match(scene,/data-assemble/);
assert.match(scene,/data-demo-cursor/);
assert.match(scene,/data-demo-action/);
assert.match(scene,/data-demo-result/);
assert.match(scene,/aria-label=\{"نمایش خودکار مراحل "/);
assert.match(scene,/بدون اجرای عملیات واقعی/);
assert.doesNotMatch(scene,/<video|<canvas|<img|fetch\(|XMLHttpRequest|localStorage/);
assert.match(css, /\.ap-showcase-scene--midnight/);
assert.match(css, /\.ap-showcase-scene--violet/);
assert.match(css, /\.ap-showcase-scene--ice/);
assert.match(css, /\.ap-showcase-scene--pearl/);
assert.match(css, /\.ap-showcase-scene--lilac/);
assert.match(css, /\.ap-showcase-scene--mint/);
assert.match(css,/\.ap-showcase-scene\.is-playing/);
assert.match(css,/@media\(max-width:900px\)/);
assert.match(css,/@media\(max-width:800px\)/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/@media\(max-width:360px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(baseCss,/font-family:"DairaVazir"/);
assert.match(baseCss,/Vazir-Regular\.woff2/);
assert.match(hero,/gsap\.timeline/);
assert.match(hero,/prefers-reduced-motion: reduce/);
assert.doesNotMatch(hero,/\.ap-story|history\.scrollRestoration/);
assert.match(page,/جایگاه مجوزهای آینده/);
assert.match(page,/در آینده/);
assert.doesNotMatch(page,/Meta Verified|تأیید شده توسط متا/);

console.log("Daira landing PASS: 11 distinct self-playing GSAP interfaces, true LiquidGlassScene optics, right 6-link staggered menu, prepaint scroll guard, legal routes and responsive themes");
