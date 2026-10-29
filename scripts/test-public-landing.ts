/** Home page contract: canonical light palette, RTL, safe demo interactions, no WebGL. */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const page = readFileSync("app/page.tsx","utf8");
const css = readFileSync("app/landing-light.css","utf8");
const client = readFileSync("components/landing/LightInteractions.tsx","utf8");
const tokens = readFileSync("app/daira-tokens.css","utf8");
const filesRemoved = [
  "app/landing.css","components/landing/LandingMotion.tsx",
  "components/landing/LandingWebGL.tsx","components/landing/glLogoMesh.ts",
  "components/landing/glOrbits.ts",
];
for (const path of filesRemoved) assert.equal(existsSync(path),false,"Obsolete cinematic landing file: "+path);
assert.match(page,/dir="rtl"/);
assert.match(page,/href="\/login"/);
assert.match(page,/href="\/privacy-policy"/);
assert.match(page,/href="\/data-deletion"/);
assert.match(page,/data.*?deletion|Data Deletion/i);
for(const id of ["home-content","demo","features","inbox","publishing","insights","direct","how","faq","start"])
  assert.match(page,new RegExp('id="'+id+'"'),"Missing section "+id);
for(const art of ["comment-reply","story-reply","direct-automation","share-mention","live-reply","smart-reminders","inbox","publishing","insights","direct-menu","icebreakers"])
  assert.ok(page.includes("/dashboard-art/"+art+".webp"),"Missing feature artwork "+art);
for(const name of ["CommentFlowDemo","InboxPreview","PublishingPreview","DirectExperienceDemo","LandingHeader","LandingReveal"])
  assert.ok(page.includes("<"+name),"Missing interactive component "+name);
assert.match(client,/position|style|setOpen\(/);
assert.match(client,/inert=\{!open\}/);
assert.match(client,/event.key === "Escape"/);
assert.match(client,/document.body.style.overflow/);
assert.match(css,/right:0;z-index:210/);
assert.match(css,/transform:translateX\(108%\)/);
assert.match(css,/@media\(max-width:370px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/var\(--daira-page-bg\)/);
assert.match(css,/var\(--daira-primary\)/);
assert.match(tokens,/--daira-primary: #2F61FD/);
assert.doesNotMatch(page,/LandingWebGL|LandingMotion|fetch\(|dangerouslySetInnerHTML|localStorage/);
assert.doesNotMatch(client,/fetch\(|dangerouslySetInnerHTML|localStorage|WebGLRenderingContext/);
assert.doesNotMatch(page,/ثبت.نام رایگان|بدون نیاز به کارت اعتباری|تأیید رسمی Meta|مشتری راضی/);
console.log("Daira light homepage: RTL, 11 features, interactivity, safe content, responsive layout PASS");
