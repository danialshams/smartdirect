/** Public Daira landing regression contract: Bento, menu, accessibility and motion. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const read=(path:string)=>readFileSync(path,"utf8");
const page=read("app/page.tsx");
const header=read("components/landing/SimpleHeader.tsx");
const features=read("components/landing/FeatureShowcase.tsx");
const scenes=read("components/landing/showcase-scenes.ts");
const glass=read("components/landing/LandingGlassBackdrop.tsx");
const hero=read("components/landing/HeroMotion.tsx");
const interactions=read("components/landing/LandingInteractions.tsx");
const css=read("app/showcase.css");
const refresh=read("app/landing-refresh.css");
const baseCss=read("app/simple-home.css");
const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));

assert.equal(pkg.dependencies.gsap,"3.14.2");
assert.equal(pkg.dependencies["simple-liquid-glass"],"5.4.0");
assert.equal(lock.packages["node_modules/simple-liquid-glass"].version,"5.4.0");
for (const item of ["<LandingGlassBackdrop>","<SimpleHeader />","<FeatureShowcase />","<LandingInteractions />","<HeroMotion />",'<main id="content">',"initialScrollGuard","history.scrollRestoration='manual'","جایگاه مجوزهای آینده","در آینده","مدیریت کل پیجت رو بسپار به دایرا","رایگان شروع کن"])
  assert.ok(page.includes(item),"Missing homepage contract: "+item);
assert.doesNotMatch(page,/ورود به پنل|بازگشت به بالا|ap-hero__subtitle|RobotHeroScene|<video/);
assert.match(page,/ap-hero__cta/);
assert.match(page,/heroWords\.map/);
assert.match(page,/data-hero-word/);
assert.match(page,/data-hero-fragment/);
assert.match(page,/data-reveal/);
for(const url of ["/login","/privacy-policy","/terms","/data-deletion","/contact","/about"])
  assert.ok(page.includes('href:"'+url+'"') || page.includes('href="'+url+'"'),"Missing link "+url);
for(const route of ["terms","about","contact"])
  assert.ok(existsSync("app/"+route+"/page.tsx"),"Missing public route "+route);

assert.match(features,/id="features"/);
assert.match(features,/ap-bento/);
assert.match(features,/ap-bento__card--responses/);
assert.match(features,/ap-bento__card--inbox/);
assert.match(features,/ap-bento__card--publishing/);
assert.match(features,/ap-bento__card--insights/);
assert.match(features,/responseFeatures\.map/);
assert.match(features,/showcaseScenes\.filter/);
assert.match(features,/data-reveal/);
assert.match(features,/role="img"/);
assert.doesNotMatch(features,/use client|ScrollTrigger|setInterval|<video\b/);
assert.equal((scenes.match(/no: "([۰-۹]+)"/g)||[]).length,11);
for(const id of ["comment","story","direct","share","live","reminder","inbox","publishing","insights","menu","icebreaker"])
  assert.ok(scenes.includes('id: "'+id+'"'),"Missing capability: "+id);

assert.match(glass,/LiquidGlassScene/);
assert.match(glass,/maxCacheBytes/);
assert.match(header,/import LiquidGlass from "simple-liquid-glass"/);
assert.match(header,/refraction:"lens"/);
assert.match(header,/quality:"standard"/);
assert.match(header,/data-liquid-glass-ignore=""/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/aria-controls="ap-menu"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/event\.key==="Escape"/);
assert.match(header,/returnFocus\.current/);
assert.match(header,/hasOpened/);
assert.match(header,/\{hasOpened && <LiquidGlass/);
assert.match(header,/ap-menu-toggle__glyphs/);
assert.doesNotMatch(header,/window\.addEventListener\("scroll"|elementFromPoint|setMenuOnDark/);
assert.match(hero,/gsap\.timeline/);
assert.match(hero,/data-hero-word/);
assert.match(hero,/data-hero-fragment/);
assert.match(hero,/prefers-reduced-motion: reduce/);
assert.match(interactions,/IntersectionObserver/);
assert.match(interactions,/requestAnimationFrame/);
assert.match(interactions,/passive: true/);
assert.match(interactions,/window\.scrollTo/);
assert.match(interactions,/ap-backtop/);
assert.match(interactions,/prefers-reduced-motion: reduce/);

assert.match(css,/\.ap-header__backdrop \{/);
assert.match(css,/\.ap-site > main,/);
assert.match(css,/\.ap-site > \.ap-footer/);
assert.match(css,/overflow:clip/);
assert.match(css,/border:0!important/);
assert.match(baseCss,/font-family:"DairaVazir"/);
assert.match(baseCss,/Vazir-Regular\.woff2/);
for(const style of [".ap-bento",".ap-bento__card--responses",".ap-menu-overlay--open",".ap-hero__cta::before",".ap-footer__halo",".ap-backtop--visible","@media(max-width:600px)","@media(prefers-reduced-motion:reduce)"])
  assert.ok(refresh.includes(style),"Missing landing style "+style);
assert.match(refresh,/@keyframes ap-light-orbit/);
assert.match(refresh,/backdrop-filter:blur\(11px\)/);
assert.match(refresh,/visibility 0s linear/);
assert.doesNotMatch(refresh,/\.ap-demo|\.ap-showcase-scene|setInterval/);
console.log("DAIRA landing PASS: grouped 11 features in 4 Bento previews; one-shot Persian GSAP hero; liquid menu entrance/exit and matte backdrop; glowing CTA; halo footer and accessible scroll-to-top.");
