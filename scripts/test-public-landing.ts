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
console.log("Daira simple homepage: RTL, legal links, accessible mobile menu, canonical colors, responsive and safety checks PASS");
