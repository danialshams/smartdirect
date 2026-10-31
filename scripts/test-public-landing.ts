/** Daira landing V2: native optical pipeline, prewarmed fallback, compositor-only hero. */
import {readFileSync, existsSync} from "node:fs";
import assert from "node:assert/strict";
const read=(p:string)=>readFileSync(p,"utf8");
const page=read("app/page.tsx");
const header=read("components/landing/SimpleHeader.tsx");
const features=read("components/landing/FeatureShowcase.tsx");
const previews=read("components/landing/InstagramPreview.tsx");
const scenes=read("components/landing/showcase-scenes.ts");
const root=read("components/landing/LandingGlassBackdrop.tsx");
const optics=read("components/landing/LiveOptics.tsx");
const interactions=read("components/landing/LandingInteractions.tsx");
const css=read("app/landing-optics-v2.css");

for(const item of ["<LandingGlassBackdrop>","<SimpleHeader />","<FeatureShowcase />","<LandingInteractions />",
  '<main id="content">',"initialScrollGuard","history.scrollRestoration='manual'",
  "جایگاه مجوزهای آینده","در آینده","مدیریت کل پیجت رو بسپار به دایرا","رایگان شروع کن",
  "./landing-instagram.css","./landing-optics-v2.css"])
  assert.ok(page.includes(item),"Missing landing contract: "+item);
assert.doesNotMatch(page,/HeroMotion|<video|heroFragments|data-hero-fragment/);
assert.match(page,/heroWords\.map/);
assert.match(page,/data-hero-word/);
assert.match(page,/data-reveal/);
for(const url of ["/login","/privacy-policy","/terms","/data-deletion","/contact","/about"])
  assert.ok(page.includes('href:"'+url+'"')||page.includes('href="'+url+'"'),"Missing link "+url);
for(const route of ["terms","about","contact"])
  assert.ok(existsSync("app/"+route+"/page.tsx"),"Missing public route "+route);

assert.match(root,/LiveOpticsDefinitions/);
assert.doesNotMatch(root,/LiquidGlassScene|maxCacheBytes|simple-liquid-glass/);
assert.match(header,/LiveOpticalSurface variant="header"/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/aria-controls="ap-menu"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/event\.key==="Escape"/);
assert.match(header,/returnFocus\.current/);
assert.doesNotMatch(header,/LiquidGlass|simple-liquid-glass|WebGL/);
assert.match(interactions,/LiveOpticalSurface variant="backtop"/);
assert.match(interactions,/IntersectionObserver/);
assert.match(interactions,/passive:true/);
assert.match(interactions,/ChevronUp/);
assert.doesNotMatch(interactions,/LiquidGlass|simple-liquid-glass/);

assert.match(optics,/feTurbulence/);
assert.match(optics,/feDisplacementMap/);
assert.match(optics,/CSS\.supports\("backdrop-filter"/);
assert.match(optics,/requestAnimationFrame/);
assert.match(optics,/cloneNode\(true\)/);
assert.match(optics,/document\.fonts\.ready/);
assert.match(optics,/await twoFrames\(\)/);
assert.match(optics,/setMode\("mirror"\)/);
assert.match(optics,/data-optics-mode=\{mode\}/);
assert.match(optics,/window\.addEventListener\("scroll", schedulePosition/);
assert.match(optics,/translate3d\(0,\$\{-window\.scrollY\}px,0\)/);
assert.doesNotMatch(optics,/html-to-image|toSvg\(|html2canvas|WebGLRenderingContext/);

assert.match(css,/\.ap-optical-surface\[data-optics-mode="mirror"\]/);
assert.match(css,/\.ap-optical-surface\[data-optics-mode="native"\]/);
assert.match(css,/-webkit-backdrop-filter:saturate\(118%\) url/);
assert.match(css,/filter:url\("#daira-optical-displacement"\)/);
assert.match(css,/box-shadow:none!important/);
assert.match(css,/@keyframes daira-word-assemble/);
assert.match(css,/animation:daira-word-assemble/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css,/border:[^;]*solid\s+white|setInterval/);

assert.match(features,/ap-showcase-capture/);
assert.match(features,/InstagramPreview kind=\{scene\.id\}/);
assert.equal((scenes.match(/no: "([۰-۹]+)"/g)||[]).length,11);
for(const id of ["comment","story","direct","share","live","reminder","inbox","publishing","insights","menu","icebreaker"])
  assert.ok(scenes.includes('id: "'+id+'"'),"Missing feature "+id);
for(const label of ["ig-menu-sheet","ig-quickreplies","ig-live__badge","ig-comment-answer","ig-schedule"])
  assert.ok(previews.includes(label),"Missing Instagram-like preview "+label);
console.log("DAIRA OPTICS V2 PASS: no WebGL capture dependency, prewarmed full-page fallback, native live filter, no inner white rim, CSS-only hero and all 11 features.");
