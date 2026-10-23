import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dairaPalette, dairaTokens } from "../lib/design-system/palette";

const css=readFileSync("app/daira-tokens.css","utf8");
const glass=readFileSync("app/daira-glass.css","utf8");
const root=readFileSync("app/globals.css","utf8");
const admin=readFileSync("components/admin/AdminProviders.tsx","utf8");
const dashboard=readFileSync("components/dashboard/DashboardTheme.tsx","utf8");
const ui=readFileSync("components/dashboard/DashboardUI.tsx","utf8");
const doc=readFileSync("docs/design-system/color-palette.md","utf8");
const workflow=readFileSync(".github/workflows/next-build.yml","utf8");

assert(Object.keys(dairaTokens).length>=130,"Daira needs a complete semantic palette");
for(const [key,value]of Object.entries(dairaTokens)){
  assert(css.includes("  "+key+": "+value+";"),"Missing generated CSS token "+key);
  assert(doc.includes(String.fromCharCode(96)+key+String.fromCharCode(96)),"Missing token in official public palette "+key);
}
for(const prefix of ["success","warning","error","info","processing","queue","neutral"]){
  for(const suffix of ["", "-text", "-border"]){
    assert(dairaTokens[("--daira-"+prefix+suffix) as keyof typeof dairaTokens],"Missing semantic token "+prefix+suffix);
  }
}
assert.equal(dairaPalette.primary.main,dairaTokens["--daira-primary"]);
assert.equal(dairaPalette.text.heading,dairaTokens["--daira-heading"]);
assert(root.includes('@import "./daira-tokens.css";'),"Shared generated token file must load first");
assert(!root.includes(":root {"),"No second hand-authored root palette is allowed in globals.css");
assert(!root.includes(".dark {"),"The abandoned alternate dark palette must not override Daira tokens");
assert(ui.includes("dairaPalette") && !ui.includes("const COLORS"),"DashboardUI must not declare a local palette");
assert(admin.includes("dairaPalette") && dashboard.includes("dairaPalette"),"MUI themes must share the canonical palette");
assert(glass.includes(".daira-home__tool-card") && glass.includes(".daira-support__ticket"),"Customer-facing cards should use Liquid Glass");
assert(glass.includes(".daira-support-toast") && glass.includes("[data-sonner-toast]"),"Notification surfaces should use glass");
assert(glass.includes("prefers-reduced-transparency:reduce") && glass.includes("@supports not"),"Glass needs accessible fallback");
assert(glass.includes("--daira-glass-rim") && glass.includes("--daira-glass-modal"),"Surfaces must share theme colors");
assert(workflow.includes("npm run theme:check"),"CI must reject a stale generated palette");
console.log("DAIRA_DESIGN_SYSTEM_OK",Object.keys(dairaTokens).length);
