/** Daira minimal landing contract: 11 static introductions, real nonrecursive glass. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const read=(path:string)=>readFileSync(path,"utf8");
const page=read("app/page.tsx");
const header=read("components/landing/SimpleHeader.tsx");
const features=read("components/landing/FeatureShowcase.tsx");
const data=read("components/landing/showcase-scenes.ts");
const glass=read("components/landing/LandingGlassBackdrop.tsx");
const hero=read("components/landing/HeroMotion.tsx");
const css=read("app/showcase.css");
const baseCss=read("app/simple-home.css");
const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));

assert.equal(pkg.dependencies.gsap,"3.14.2");
assert.equal(pkg.dependencies["simple-liquid-glass"],"5.4.0");
assert.equal(lock.packages["node_modules/simple-liquid-glass"].version,"5.4.0");
assert.match(page,/<LandingGlassBackdrop>/);
assert.match(page,/<SimpleHeader \/>/);
assert.match(page,/<FeatureShowcase \/>/);
assert.match(page,/<main id="content">/);
assert.match(page,/<HeroMotion \/>/);
assert.match(page,/initialScrollGuard/);
assert.match(page,/history\.scrollRestoration='manual'/);
assert.match(page,/جایگاه مجوزهای آینده/);
assert.match(page,/در آینده/);
assert.doesNotMatch(page,/ap-close|همین‌قدر ساده|بیشتر ببین|RobotHeroScene|<video/);
for(const url of ["/login","/privacy-policy","/terms","/data-deletion","/contact","/about"])
 assert.ok(page.includes('href:"'+url+'"')||page.includes('href="'+url+'"'),"Missing destination "+url);
for(const route of ["terms","about","contact"])
 assert.ok(existsSync("app/"+route+"/page.tsx"),"Missing public route "+route);

assert.match(features,/id="features"/);
assert.match(features,/ap-showcase__intro/);
assert.match(features,/showcaseScenes\.map/);
assert.match(features,/className="ap-feature"/);
assert.match(features,/<article/);
assert.match(features,/item\.title/);
assert.match(features,/item\.tagline/);
assert.match(features,/item\.Icon/);
assert.doesNotMatch(features,/use client|gsap|ScrollTrigger|IntersectionObserver|repeat:-1|setInterval|useEffect|video|ap-demo|ap-showcase-scene/);
assert.equal((data.match(/no: "([۰-۹]+)"/g)||[]).length,11);
for(const id of ["comment","story","direct","share","live","reminder","inbox","publishing","insights","menu","icebreaker"])
 assert.ok(data.includes('id: "'+id+'"'),"Missing real dashboard capability "+id);
for(const label of [
 "پاسخ به کامنت","پاسخ به استوری","پاسخ خودکار دایرکت",
 "اشتراک‌گذاری و منشن","پاسخ به لایو","یادآوری هوشمند",
 "صندوق دایرکت","انتشار محتوا","آنالیز پیج","منوی دایرکت","پیام شروع گفتگو",
])assert.ok(data.includes(label),"Missing Daira feature "+label);
assert.doesNotMatch(data,/keyword:|outcome:|inputLabel:|response:/);

assert.match(glass,/LiquidGlassScene/);
assert.match(glass,/maxCacheBytes/);
assert.match(header,/import LiquidGlass from "simple-liquid-glass"/);
assert.match(header,/refraction:"lens"/);
assert.match(header,/frost:0/);
assert.match(header,/blur:0/);
assert.match(header,/quality:"standard"/);
assert.match(header,/borderColor:"rgba\(255,255,255,0\)"/);
assert.match(header,/data-liquid-glass-ignore=""/);
assert.match(header,/blueOptics/);
assert.match(header,/ap-header__login-glass/);
assert.match(header,/\{open && <LiquidGlass/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/aria-controls="ap-menu"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/event\.key==="Escape"/);
assert.match(header,/returnFocus\.current/);
assert.doesNotMatch(header,/setMenuOnDark|window\.addEventListener\("scroll"|elementFromPoint|liquid="flow"|ap-menu-toggle__glass/);
for(const item of ["امکانات","حفظ حریم خصوصی","قوانین و مقررات","حذف اطلاعات","ارتباط با ما","درباره ما"])
 assert.ok(header.includes(item),"Missing navigation item "+item);

assert.match(css,/\.ap-showcase__list/);
assert.match(css,/\.ap-feature__number/);
assert.match(css,/\.ap-menu__content/);
assert.match(css,/\.ap-header__login-glass/);
assert.match(css,/\.ap-menu--open \.ap-menu__nav \.ap-menu__item/);
assert.match(css,/\.ap-header__backdrop \{/);
assert.match(css,/border:0!important/);
assert.match(css,/@media\(max-width:800px\)/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/@media\(max-width:360px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css,/\.ap-demo|\.ap-showcase-scene|@keyframes ap-(halo|orbit|theme)-drift/);
assert.doesNotMatch(css,/backdrop-filter:blur/);
assert.match(baseCss,/font-family:"DairaVazir"/);
assert.match(baseCss,/Vazir-Regular\.woff2/);
assert.match(hero,/gsap\.timeline/);
assert.match(hero,/prefers-reduced-motion: reduce/);
console.log("DAIRA landing PASS: 11 static intros; borderless single optical header; blue glass login; no recursive reflections, scroll listeners, infinite demos or video; six accessible nav links.");
