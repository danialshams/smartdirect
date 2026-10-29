/** Temporary public landing safety checks while the final design is selected. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const source = readFileSync("app/page.tsx", "utf8");
for (const path of [
  "app/landing.css",
  "components/landing/LandingMotion.tsx",
  "components/landing/LandingWebGL.tsx",
  "components/landing/glLogoMesh.ts",
  "components/landing/glOrbits.ts",
]) {
  assert.equal(existsSync(path), false, `Obsolete animated landing file: ${path}`);
}
assert.match(source, /dir="rtl"/);
assert.match(source, /href="\/login"/);
assert.match(source, /href="\/privacy-policy"/);
assert.match(source, /href="\/data-deletion"/);
assert.match(source, /id="main-content"/);
assert.match(source, /export const metadata/);
assert.doesNotMatch(source, /LandingMotion|LandingWebGL|dl-core|WebGL|data-dl-scene|requestAnimationFrame|dangerouslySetInnerHTML|fetch\(/);
console.log("Public landing reset: static placeholder, navigation, and safety checks PASS");
