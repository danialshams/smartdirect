/**
 * Landing smoke contract: no API calls or auth changes, 8 sections, RTL,
 * working CTAs, no fabricated AI/free-trial/pricing promises.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const source = readFileSync("app/page.tsx", "utf8");
const styles = readFileSync("app/landing.css", "utf8");
const motion = readFileSync("components/landing/LandingMotion.tsx", "utf8");
const ids = ["start","features","automations","inbox","publishing","insights","glass","workspace"];
for (const id of ids) {
  assert.match(source, new RegExp('id="' + id + '" data-dl-scene'), "Missing landing scene: " + id);
  assert.match(source, new RegExp('href="#' + id + '"|\\["' + id + '"'), "Missing scene navigation: " + id);
}
assert.match(source, /dir="rtl"/);
assert.match(source, /href="\/login"/);
assert.match(source, /href="\/privacy-policy"/);
assert.match(source, /href="\/data-deletion"/);
assert.match(source, /داده نمایشی/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /@media \(max-width:480px\)/);
assert.match(motion, /requestAnimationFrame/);
assert.match(motion, /IntersectionObserver/);
assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|dangerouslySetInnerHTML/);
console.log("Daira public homepage: scene structure, navigation, motion and safety checks PASS");

const gpu=readFileSync("components/landing/glOrbits.ts","utf8");
const glClient=readFileSync("components/landing/LandingWebGL.tsx","utf8");
assert(source.includes('<LandingWebGL mode="hero" />'));
assert(source.includes('<LandingWebGL mode="features" />'));
assert(gpu.includes('getContext("webgl"'),"Use actual WebGL rather than a static video");
assert(gpu.includes("gl.deleteBuffer")&&gpu.includes("gl.deleteProgram"),"Dispose GPU resources");
assert(glClient.includes('await import("./glOrbits")'),"The orbital renderer must be lazy loaded");
assert(glClient.includes("IntersectionObserver")&&glClient.includes("else stop()"),"Pause offscreen rendering");
assert(glClient.includes("saveData")&&glClient.includes("prefers-reduced-motion"),"Respect user and mobile constraints");
assert(styles.includes(".dl-webgl-active")&&styles.includes(".dl-core"),"Progressive fallback must remain visible");
console.log("Daira WebGL orbit lifecycle and fallback smoke PASS");

assert(source.includes('className="dl-core-brand"'),"Use the approved Daira mark");

const logoMesh=readFileSync("components/landing/glLogoMesh.ts","utf8");
assert(logoMesh.includes("/daira-header-logo-hd.webp"),"3D geometry must come from approved artwork");
assert(logoMesh.includes("pixels[i * 4 + 3]"),"3D mesh must preserve alpha silhouette");
assert(logoMesh.includes("!visible(x, y + 1)")&&logoMesh.includes("!visible(x + 1, y)"),"Logo sides must be extruded");
assert(gpu.includes("getLogoMesh")&&gpu.includes("context.drawArrays(context.TRIANGLES"),"WebGL must render actual 3D mesh");
assert(gpu.includes("logoReady")&&glClient.includes("dl-logo-ready"),"Preserve logo fallback until mesh is ready");
assert(gpu.includes("1000/30"),"Mobile rendering must be capped");


assert(logoMesh.includes("/daira-header-logo-hd.webp"),"The 3D mesh must use approved artwork");
assert(logoMesh.includes("pixels[i * 4 + 3]"),"Silhouette must be alpha-based");
assert(logoMesh.includes("!visible(x, y + 1)")&&logoMesh.includes("!visible(x + 1, y)"),"The logo walls must have depth");
assert(gpu.includes("getLogoMesh")&&gpu.includes("context.drawArrays(context.TRIANGLES"),"The 3D mesh must render on GPU");
assert(gpu.includes("logoReady")&&glClient.includes("dl-logo-ready"),"Keep a static logo until 3D is ready");
assert(motion.includes("--dl-scene")&&motion.includes("layouts = sections.map"),"Scroll must drive all stages without layout thrashing");
assert(styles.includes('data-active-scene="workspace"'),"The light header must be readable");
assert(styles.includes(".dl-glass-transition::after"),"Transition must track scroll");
assert(gpu.includes("depth:true"),"Real 3D mesh requires depth buffer");
assert(glClient.includes("deviceMemory"),"Low-memory devices need a fallback");
console.log("Daira cinematic scroll, WebGL silhouette and mobile gates PASS");
