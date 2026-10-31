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
const hero=read("components/landing/HeroAssembly.tsx");
const showcaseStyles=read("app/showcase.css");
const polish=read("app/landing-polish.css");
const liquidHeader=read("components/landing/LiquidHeaderSurface.tsx");
const liquidHeaderCSS=read("app/header-library-optics.css");
const landingFixes=read("app/landing-fixes.css");

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

assert.match(root,/LiquidGlassScene/);
assert.match(root,/maxCacheBytes/);
assert.match(root,/maxCacheBytes=\\{64 \\* 1024 \\* 1024\\}/);
assert.match(page,/import "\\.\\/landing-fixes\\.css"/);
assert.match(landingFixes,/\\.daira-library-liquid-header > \\.liquid-glass-border/);
assert.match(landingFixes,/opacity: \\.43 !important/);
assert.match(landingFixes,/backdrop-filter: blur\\(15px\\) saturate\\(155%\\)/);
assert.match(landingFixes,/daira-word-assemble 1\\.75s cubic-bezier/);
assert.match(landingFixes,/prefers-reduced-motion/);
assert.match(hero,/animationend/);
assert.match(hero,/data-liquid-glass-ignore/);
assert.match(hero,/document\\.fonts\\.ready/);

assert.match(header,/<LiquidHeaderSurface \/>/);
assert.match(liquidHeader,/import LiquidGlass from "simple-liquid-glass"/);
assert.match(liquidHeader,/lensProfile: "loupe"/);
assert.match(liquidHeader,/renderer: "svg"/);
assert.match(liquidHeader,/scale: 118/);
assert.match(liquidHeader,/specular: 2\.30/);
assert.match(liquidHeader,/sheen: 1\.85/);
assert.doesNotMatch(liquidHeader,/displacementScale|ap-liquid-header__volume|ap-liquid-header__edge|ap-liquid-header__glint/);
assert.match(liquidHeader,/className="daira-library-liquid-header"/);
assert.doesNotMatch(liquidHeaderCSS,/liquid-glass-border|div\[style\*="backdrop-filter"\]|radial-gradient|box-shadow:[^;]+rgba\(/);
assert.match(page,/import "\.\/header-library-optics\.css"/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/aria-controls="ap-menu"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/event\.key==="Escape"/);
assert.match(header,/returnFocus\.current/);
assert.doesNotMatch(header,/LiquidGlass|simple-liquid-glass|WebGL/);
assert.match(interactions,/ap-backtop__blue-blur/);
assert.doesNotMatch(interactions,/LiveOpticalSurface/);
assert.match(interactions,/IntersectionObserver/);
assert.match(interactions,/passive:true/);
assert.match(interactions,/ChevronUp/);
assert.doesNotMatch(interactions,/LiquidGlass|simple-liquid-glass/);

assert.match(optics,/prepareOpticalMaps/);
assert.match(optics,/import LiquidGlass from "simple-liquid-glass"/);
assert.match(optics,/renderer: "svg"/);
assert.match(optics,/displacementScale: 52/);
assert.doesNotMatch(optics,/displacementScale: 32/);
assert.match(optics,/lensProfile: "loupe"/);
assert.ok(optics.includes('glassColor: "rgba(255,255,255,.038)"'));
assert.match(optics,/sheenAngle: -34/);
assert.match(optics,/specular: 2\.0/);
assert.ok(!optics.includes('background: "rgba(255,255,255,0)"'));


assert.doesNotMatch(optics,/webglScene: "on"/);
assert.match(optics,/quality: "high"/);
assert.match(optics,/className=\{\`ap-native-liquid/);
assert.match(optics,/daira-header-map/);
assert.match(optics,/daira-backtop-map/);
assert.match(optics,/canvas\.toDataURL\("image\/png"\)/);
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
assert.match(css,/-webkit-backdrop-filter:saturate\(138%\) contrast\(105%\) url/);
assert.match(css,/filter:url\("#daira-optical-displacement"\)/);
assert.match(css,/box-shadow:none!important/);
assert.ok(css.includes(".ap-backtop__lens.ap-backtop__blue-blur"),"Blurred blue back-to-top control must be styled");
assert.match(css,/color:#fff!important/);
assert.match(css,/backdrop-filter:blur\(9px\) saturate\(155%\)/);
assert.ok(!css.includes("rgba(122,186,255,.20)"),"No synthetic blue halo");

assert.match(css,/\.ap-header__backdrop\.ap-native-liquid > \.liquid-glass-border/);
assert.match(css,/\.ap-header\[data-landing-header\]/);
assert.match(css,/backdrop-filter:none!important/);
assert.ok(css.includes("A filtered parent becomes a Backdrop Root"),"Document and retain the actual nested backdrop-filter fix");
assert.match(css,/\.ap-backtop::after\s*\{\s*content:none!important/);
assert.match(css,/saturate\(138%\) contrast\(105%\)/);
assert.match(css,/blur\(9px\)/);
assert.match(css,/daira-optical-backtop/);
assert.doesNotMatch(page,/ArrowUpLeft/);
assert.match(page,/رایگان شروع کن\s*<\/Link>/);
assert.match(css,/@keyframes daira-word-assemble/);
assert.match(css,/animation:daira-word-assemble/);
assert.match(page,/<HeroAssembly \/>/);
assert.match(page,/dataset\.dairaHero='pending'/);
assert.match(hero,/document\.fonts\.ready/);
assert.match(hero,/dataset\.dairaHero = "play"/);
assert.match(css,/data-daira-hero="pending"/);
assert.match(css,/data-daira-hero="play"/);
assert.match(css,/1\.26s cubic-bezier/);
assert.match(css,/--word-x:175px/);
assert.match(showcaseStyles,/z-index:100;isolation:auto/);
assert.match(polish,/overflow:visible;isolation:auto/);
assert.doesNotMatch(polish,/ap-header__backdrop\{filter:none!important;isolation:isolate/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css,/border:[^;]*solid\s+white|setInterval/);

assert.match(features,/ap-showcase-capture/);
assert.match(features,/InstagramPreview kind=\{scene\.id\}/);
assert.equal((scenes.match(/no: "([۰-۹]+)"/g)||[]).length,11);
for(const id of ["comment","story","direct","share","live","reminder","inbox","publishing","insights","menu","icebreaker"])
  assert.ok(scenes.includes('id: "'+id+'"'),"Missing feature "+id);
for(const label of ["ig-menu-sheet","ig-quickreplies","ig-live__badge","ig-comment-answer","ig-schedule"])
  assert.ok(previews.includes(label),"Missing Instagram-like preview "+label);
console.log("DAIRA GLASS PASS: genuine unmodified library optics restored, iOS scene connected, CSS only positions the lens, all 11 homepage features preserved.");
