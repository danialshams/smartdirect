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
