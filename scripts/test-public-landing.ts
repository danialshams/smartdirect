/** Simple Daira landing smoke checks. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const page = readFileSync("app/page.tsx","utf8");
const css = readFileSync("app/simple-home.css","utf8");
const menu = readFileSync("components/landing/SimpleHeader.tsx","utf8");
const tokens = readFileSync("app/daira-tokens.css","utf8");

assert.match(page,/dir="rtl"/);
for(const link of ["/login","/privacy-policy","/data-deletion"])
  assert.ok(page.includes('href="'+link+'"'),"Missing public link: "+link);
for(const section of ["features","example","how","faq"])
  assert.ok(page.includes('id="'+section+'"'),"Missing section: "+section);
for(const label of ["کامنت","استوری","لایو","اشتراک‌گذاری و منشن","دایرکت","یادآوری هوشمند","منوی دایرکت","پیام شروع گفتگو","انتشار محتوا","تحلیل پیج","صندوق دایرکت"])
  assert.ok(page.includes(label),"Missing feature: "+label);
for(const art of ["comment-reply","direct-automation","inbox","publishing","insights","smart-reminders"])
  assert.ok(existsSync("public/dashboard-art/"+art+".webp"),"Missing image: "+art);
assert.match(page,/نمونه نمایشی|نمای نمونه/);
assert.match(menu,/document.body.style.overflow/);
assert.match(menu,/event.key === "Escape"/);
assert.match(menu,/inert=\{!open\}/);
assert.match(menu,/sh-menu-toggle/);
assert.match(css,/right:16px/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/@media\(max-width:370px\)/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css,/var\(--daira-primary\)/);
assert.match(css,/var\(--daira-surface\)/);
assert.match(tokens,/--daira-primary: #2F61FD/);
assert.doesNotMatch(page,/fetch\(|dangerouslySetInnerHTML|WebGL|LandingWebGL|LandingMotion|ثبت.نام رایگان|مشتری راضی/);
assert.doesNotMatch(menu,/fetch\(|localStorage|sessionStorage|WebGL|setInterval/);
for(const deleted of ["app/landing-light.css","components/landing/LightInteractions.tsx",
 "app/landing.css","components/landing/LandingWebGL.tsx","components/landing/LandingMotion.tsx"])
  assert.equal(existsSync(deleted),false,"Outdated landing artifact: "+deleted);

const motion = readFileSync("components/landing/HeroMotion.tsx","utf8");
const packageJson = JSON.parse(readFileSync("package.json","utf8"));
const lock = JSON.parse(readFileSync("package-lock.json","utf8"));
assert.equal(packageJson.dependencies.gsap, "3.14.2");
assert.equal(lock.packages[""].dependencies.gsap, packageJson.dependencies.gsap);
assert.equal(lock.packages["node_modules/gsap"].version, packageJson.dependencies.gsap);
assert.match(motion, /from "gsap"/);
assert.match(motion, /gsap\.timeline/);
assert.match(motion, /context\.revert\(\)/);
assert.match(motion, /prefers-reduced-motion: reduce/);
assert.match(page, /<HeroMotion \/>/);
assert.match(page, /<DirectInboxPreview \/>/);
assert.match(page, /دایرکت‌هات رو/);
assert.match(page, /نمونه/);
assert.match(page, /data-hero-message/);
assert.match(page, /data-hero-float/);
assert.match(menu, /aria-expanded=\{open\}/);
assert.match(menu, /aria-controls="sh-menu-panel"/);
assert.match(menu, /className="sh-menu-backdrop"/);
assert.match(menu, /aria-label="بستن منو"/);
assert.match(menu, /onClick=\{\(\)=>setOpen\(false\)\}/);
assert.match(css, /-webkit-backdrop-filter:blur\(25px\) saturate\(190%\)/);
assert.match(css, /-webkit-backdrop-filter:blur\(30px\) saturate\(190%\)/);
assert.match(css, /sh-inbox-stage__float/);
assert.match(css, /@keyframes sh-inbox-hover/);
assert.match(css, /sh-menu-panel--open nav a:nth-child/);
assert.match(css, /@supports not \(\(backdrop-filter/);
assert.doesNotMatch(motion, /setInterval|requestAnimationFrame|fetch\(/);

console.log("Daira simple homepage: RTL, legal links, accessible mobile menu, canonical colors, responsive and safety checks PASS");
