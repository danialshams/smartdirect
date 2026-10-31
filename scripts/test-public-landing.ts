/** Daira minimalist public landing: content, motion, navigation and mobile contract. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const read=(path:string)=>readFileSync(path,"utf8");
const page=read("app/page.tsx");
const css=read("app/simple-home.css");
const header=read("components/landing/SimpleHeader.tsx");
const motion=read("components/landing/HeroMotion.tsx");
const tokens=read("app/daira-tokens.css");
const pkg=JSON.parse(read("package.json"));
const lock=JSON.parse(read("package-lock.json"));

assert.match(page,/dir="rtl"/);
assert.match(page,/<main id="content">/);
assert.match(page,/aria-labelledby="sh-hero-title"/);
assert.match(page,/<HeroMotion \/>/);
assert.match(page,/<SimpleHeader \/>/);

for(const route of ["/login","/privacy-policy","/data-deletion"])
  assert.ok(page.includes('href="'+route+'"'),"Missing real route: "+route);
for(const section of ["features","example","how","faq"])
  assert.ok(page.includes('id="'+section+'"'),"Missing marketing section: "+section);

for(const label of ["کامنت","استوری","لایو","اشتراک‌گذاری","منشن","دایرکت","یادآوری هوشمند","منوی دایرکت","پیام شروع گفتگو","انتشار محتوا","تحلیل پیج","صندوق دایرکت"])
  assert.ok(page.includes(label),"Missing existing Daira feature: "+label);

for(const copy of ["شروع با دایرا","آشنایی با امکانات","شروعی ساده، در سه قدم","سؤالات متداول","نمای نمونه"])
  assert.ok(page.includes(copy),"Missing meaningful marketing content: "+copy);

assert.match(page,/const features = \[/);
assert.match(page,/const steps = \[/);
assert.match(page,/const faqs = \[/);
assert.equal((page.match(/description: "/g)||[]).length>=9,true);

assert.match(page,/sh-preview__window/);
assert.match(page,/sh-preview__flow-answer/);
assert.match(page,/sh-hero__copy/);
assert.match(page,/sh-feature-grid/);
assert.match(page,/sh-faq__item/);
assert.doesNotMatch(page,/RobotHeroScene|RobotMotionPlayer|<video|<Canvas|WebGL|LandingWebGL|LandingMotion/);
assert.doesNotMatch(page,/fetch\(|dangerouslySetInnerHTML|ثبت.نام رایگان|مشتری راضی/);
assert.ok(existsSync("public/daira-header-logo-hd.webp"),"Brand logo required");
assert.match(tokens,/--daira-primary: #2F61FD/);

assert.equal(pkg.dependencies.gsap,"3.14.2");
assert.equal(lock.packages[""].dependencies.gsap,"3.14.2");
assert.equal(lock.packages["node_modules/gsap"].version,"3.14.2");
assert.match(motion,/from "gsap"/);
assert.match(motion,/from "gsap\/ScrollTrigger"/);
assert.match(motion,/gsap\.timeline/);
assert.match(motion,/scrollTrigger:/);
assert.match(motion,/context\.revert\(\)/);
assert.match(motion,/prefers-reduced-motion: reduce/);
assert.match(motion,/history\.scrollRestoration = "manual"/);
assert.match(motion,/window\.addEventListener\("pageshow", reset\)/);
assert.doesNotMatch(motion,/setInterval|fetch\(|requestAnimationFrame/);

assert.match(header,/document\.body\.style\.overflow = "hidden"/);
assert.match(header,/event\.key === "Escape"/);
assert.match(header,/inert=\{!open\}/);
assert.match(header,/aria-expanded=\{open\}/);
assert.match(header,/aria-controls="sh-menu-panel"/);
assert.match(header,/sh-menu-toggle/);
assert.match(header,/sh-menu-backdrop/);
assert.match(header,/closeButton\.current\?\.focus\(\)/);
assert.match(header,/largeScreen|breakpoint = window\.matchMedia/);
assert.doesNotMatch(header,/LiquidGlass|LandingGlass|fetch\(|localStorage/);

assert.match(css,/\.sh-header__inner\s*\{/);
assert.match(css,/grid-template-columns:minmax\(150px,1fr\) auto minmax\(150px,1fr\)/);
assert.match(css,/\.sh-hero__inner\s*\{/);
assert.match(css,/\.sh-feature-grid\s*\{/);
assert.match(css,/\.sh-menu-panel--open\s*\{/);
assert.match(css,/@media\(max-width:1050px\)/);
assert.match(css,/@media\(max-width:860px\)/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/@media\(max-width:390px\)/);
assert.match(css,/@media\(max-width:340px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/scroll-margin-top:105px/);
assert.match(css,/--sh-blue:#2f61fd/);
assert.match(css,/\.sh-menu-toggle \{display:flex/);
assert.match(css,/\.sh-feature-grid \{grid-template-columns:1fr/);
assert.match(css,/\.sh-hero__actions \{display:grid;grid-template-columns:1fr 1fr/);
assert.doesNotMatch(css,/sh-robot-world|sh-robot-svg|sh-robot-cables|daira-robot-motion/);

console.log("DAIRA minimalist landing PASS: concise content, 11 capabilities, semantic navigation, real routes, GSAP reveal, accessible mobile menu and responsive layout");
