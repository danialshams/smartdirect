/** Simple Daira landing smoke checks. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const page = readFileSync("app/page.tsx","utf8");
const css = readFileSync("app/simple-home.css","utf8");
const menu = readFileSync("components/landing/SimpleHeader.tsx","utf8");
const lens = readFileSync("components/landing/LandingGlass.tsx","utf8");
const robot = readFileSync("components/landing/RobotHeroScene.tsx","utf8");
const sculpture = readFileSync("components/landing/RobotThreeModel.tsx","utf8");
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
assert.match(page, /<RobotHeroScene \/>/);
assert.match(page, /همه تعاملات در یک مدار/);
assert.match(page, /id="sh-optics-backdrop"/);
assert.doesNotMatch(page, /<DirectInboxPreview \/>/);
assert.match(menu, /<LandingGlass className="sh-header__glass">/);
assert.match(lens, /from "simple-liquid-glass"/);
assert.match(lens, /backdropSelector="#sh-optics-backdrop"/);
assert.match(lens, /refraction="lens"/);
assert.match(css, /\.sh-header__inner\s*\{[\s\S]*?border:0;border-radius:0;box-shadow:none/);
assert.match(css, /grid-template-areas:"scene" "copy"/);
assert.equal(packageJson.dependencies["simple-liquid-glass"], "5.4.0");
assert.equal(lock.packages["node_modules/simple-liquid-glass"].version, "5.4.0");

assert.match(page, /نمونه/);
assert.match(robot, /data-robot-assembly="portrait"/);
assert.match(robot, /data-robot-assembly="cable"/);
assert.match(robot, /data-robot-assembly="node"/);
assert.doesNotMatch(robot, /sh-robot-eye-dimmer/);
assert.doesNotMatch(robot, /<image\s+href=/);
assert.match(robot, /<RobotThreeModel \/>/);
assert.match(sculpture, /from "@react-three\/fiber"/);
assert.match(sculpture, /<Canvas/);
assert.match(sculpture, /<Eye side=\{-1\}/);
assert.match(sculpture, /<SideModule side=\{side\}/);
assert.match(sculpture, /<sphereGeometry/);
assert.match(sculpture, /<torusGeometry/);
assert.match(sculpture, /emissiveIntensity=intensity\(phase\)/);
assert.match(sculpture, /prefers-reduced-motion: reduce/);
assert.match(robot, /Math\.random\(\)/);
assert.match(robot, /gsap\.delayedCall\(gsap\.utils\.random\(3\.8,\s*6\.2\),\s*pulseOne\)/);
assert.match(robot, /getPointAtLength/);
assert.ok(existsSync("public/landing/daira-robot-hero.webp"),"Missing approved robot portrait asset");
assert.doesNotMatch(robot, /href="\/landing\/daira-robot-hero.webp"/);
assert.match(sculpture, /available===false/);
assert.match(robot, /sh-robot-mobile-features/);
assert.match(css, /grid-template-areas:"copy" "scene"/);
assert.match(css, /\.sh-robot-mobile-features\s*\{[\s\S]*?display:grid/);
assert.match(robot, /prefers-reduced-motion: reduce/);
for (const id of ["comment","story","direct","mention","live","reminder","inbox","publish","insights","menu","icebreakers"]) {
  assert.ok(robot.includes('id: "' + id + '"'), "Missing robot connection: " + id);
}
assert.equal((robot.match(/\{ id: "/g) || []).length, 11, "Exactly eleven dashboard features");
assert.match(css, /@keyframes sh-cable-wave/);
assert.match(css, /@keyframes sh-node-float/);
assert.match(css, /\.sh-robot-3d-assembly/);
assert.equal(packageJson.dependencies.three, "0.186.1");
assert.equal(packageJson.dependencies["@react-three/fiber"], "9.8.2");
assert.equal(packageJson.devDependencies["@types/three"], "0.186.0");
assert.equal(lock.packages["node_modules/three"].version, "0.186.1");
assert.equal(lock.packages["node_modules/@react-three/fiber"].version, "9.8.2");
assert.match(css, /\.sh-header \.sh-brand\s*\{[\s\S]*?left:50%/);
assert.match(css, /\.sh-menu-panel--open\s*\{[\s\S]*?translate\(-50%,-50%\)/);
assert.match(menu, /aria-expanded=\{open\}/);
assert.match(menu, /aria-controls="sh-menu-panel"/);
assert.match(menu, /sh-menu-backdrop/);
assert.match(menu, /aria-label="بستن منو"/);
assert.match(menu, /onClick=\{\(\)=>setOpen\(false\)\}/);
assert.match(css, /-webkit-backdrop-filter:blur\(9px\) saturate\(175%\)/);
assert.match(css, /-webkit-backdrop-filter:blur\(16px\) saturate\(180%\)/);
assert.match(css, /sh-inbox-stage__float/);
assert.match(css, /sh-inbox-perspective/);
assert.match(css, /rotateX\(4\.5deg\) rotateY\(-8deg\)/);
assert.match(css, /grid-template-areas:"preview" "copy"/);
assert.match(css, /\.sh-menu-toggle \{display:inline-flex;order:-1/);
assert.match(css, /\.sh-header \.sh-brand \{order:0;margin-inline-start:auto/);
assert.match(css, /\.sh-menu-panel::after \{content:none;display:none;\}/);
assert.doesNotMatch(page, /<RevealOnScroll \/>/);
assert.match(motion, /scrollRestoration = "manual"/);
assert.match(motion, /window\.addEventListener\("pageshow", reset\)/);
assert.match(motion, /window\.removeEventListener\("pageshow", reset\)/);
assert.match(motion, /\.from\("\[data-hero-entrance\]"/);
assert.match(css, /@keyframes sh-inbox-hover/);
assert.match(css, /sh-menu-panel--open nav a:nth-child/);
assert.match(css, /@supports not \(\(backdrop-filter/);
assert.doesNotMatch(motion, /setInterval|requestAnimationFrame|fetch\(/);

console.log("Daira true 3D robot hero: WebGL meshes, glowing lens flickers, 11 cables, visible mobile cards, accessibility and safety checks PASS");
