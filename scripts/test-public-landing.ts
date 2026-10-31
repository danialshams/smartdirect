/** Editorial Daira landing smoke checks: sparse content, Vazir, GSAP and mobile accessibility. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const read=(path:string)=>readFileSync(path,"utf8");
const page=read("app/page.tsx");
const css=read("app/simple-home.css");
const header=read("components/landing/SimpleHeader.tsx");
const motion=read("components/landing/HeroMotion.tsx");
const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));

assert.match(page,/dir="rtl"/);
assert.match(page,/<main id="content">/);
assert.match(page,/aria-labelledby="ap-hero-title"/);
assert.match(page,/<HeroMotion \/>/);
assert.match(page,/<SimpleHeader \/>/);
assert.equal((page.match(/<h1\b/g)||[]).length,1,"Exactly one marketing h1");
assert.equal((page.match(/<section\b/g)||[]).length,4,"Only four intentional editorial sections");

for(const link of ["/login","/privacy-policy","/data-deletion"])
  assert.ok(page.includes('href="'+link+'"'),"Missing legal/user path: "+link);
for(const section of ["experience","features","start"])
  assert.ok(page.includes('id="'+section+'"'),"Missing editorial scene: "+section);
for(const label of [
  "کامنت","استوری","دایرکت","لایو","اشتراک‌گذاری","منشن",
  "صندوق دایرکت","یادآوری هوشمند","منوی دایرکت","پیام شروع گفتگو",
  "محتوا","تحلیل",
])
  assert.ok(page.includes(label),"Missing supported feature reference: "+label);

assert.match(page,/کمتر درگیر شو/);
assert.match(page,/بیشتر ارتباط بگیر/);
assert.match(page,/پیام‌ها می‌رسند/);
assert.match(page,/پاسخ‌ها آماده‌اند/);
assert.match(page,/کنترل بیشتر/);
assert.match(page,/پیچیدگی کمتر/);
assert.match(page,/const capabilities = \[/);
assert.equal((page.match(/no: "0[1-3]"/g)||[]).length,3,"Three focused capabilities only");
assert.match(page,/ap-story__sticky/);
assert.match(page,/ap-story__ring--outer/);
assert.match(page,/ap-capabilities__list/);
assert.match(page,/ap-hero__line--accent/);
assert.match(page,/data-story-reveal/);
assert.match(page,/data-hero-entrance/);
assert.doesNotMatch(page,/DashboardPreview|RobotHeroScene|RobotMotionPlayer|<video|<Canvas|WebGL|sh-preview|sh-feature-grid|image:\s*"/);
assert.doesNotMatch(page,/fetch\(|dangerouslySetInnerHTML|ثبت.نام رایگان|مشتری راضی/);
assert.ok(existsSync("public/daira-header-logo-hd.webp"));

assert.match(header,/document\.body\.style\.overflow="hidden"/);
assert.match(header,/e\.key==="Escape"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/aria-controls="ap-menu"/);
assert.match(header,/ap-menu-overlay/);
assert.match(header,/role="dialog"/);
assert.match(header,/close\.current\?\.focus\(\)/);
assert.match(header,/matchMedia\("\(min-width: 800px\)"\)/);
assert.doesNotMatch(header,/LiquidGlass|LandingGlass|fetch\(|localStorage/);

assert.equal(pkg.dependencies.gsap,"3.14.2");
assert.equal(lock.packages["node_modules/gsap"].version,"3.14.2");
assert.match(motion,/from "gsap"/);
assert.match(motion,/from "gsap\/ScrollTrigger"/);
assert.match(motion,/gsap\.timeline/);
assert.match(motion,/scrollTrigger:/);
assert.match(motion,/scrub:1\.15/);
assert.match(motion,/gsap\.matchMedia/);
assert.match(motion,/context\.revert\(\)/);
assert.match(motion,/prefers-reduced-motion: reduce/);
assert.match(motion,/history\.scrollRestoration="manual"/);
assert.match(motion,/window\.addEventListener\("pageshow",reset\)/);
assert.doesNotMatch(motion,/setInterval|requestAnimationFrame|fetch\(/);

assert.match(css,/@font-face/);
assert.match(css,/font-family:"DairaVazir"/);
for(const weight of ["Vazir-Regular.woff2","Vazir-Medium.woff2","Vazir-Bold.woff2","Vazir-Black.woff2"])
  assert.ok(css.includes(weight),"Missing exact original Vazir face: "+weight);
assert.match(css,/\.ap-site \{/);
assert.match(css,/\.ap-header__inner \{/);
assert.match(css,/\.ap-hero__content \{/);
assert.match(css,/\.ap-story__sticky \{/);
assert.match(css,/position:sticky;top:66px/);
assert.match(css,/\.ap-capability \{/);
assert.match(css,/\.ap-menu--open \{/);
assert.match(css,/@media\(max-width:1050px\)/);
assert.match(css,/@media\(max-width:800px\)/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/@media\(max-width:375px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/scroll-margin-top:70px/);
assert.match(css,/--ap-accent:#2f61fd/);
assert.match(css,/\.ap-menu-toggle \{display:flex/);
assert.match(css,/\.ap-capability \{/);
assert.doesNotMatch(css,/\.sh-preview|\.sh-feature-grid|\.sh-robot|daira-robot-motion/);

console.log("Daira Apple-style editorial landing PASS: four sparse sections, no mockup, exact Vazir fonts, GSAP scroll choreography, three essential feature rows, accessible menu and phone layouts.");
