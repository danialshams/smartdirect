/**
 * Read-only estimate of JS included in Next's initial app route manifest.
 * This is NOT a measurement of real device loading or dynamically imported chunks.
 */
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const manifestPath = ".next/app-build-manifest.json";
if (!existsSync(manifestPath)) {
  console.log("DASHBOARD_BUNDLE_REPORT_SKIPPED: App build manifest is absent.");
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!manifest.pages || typeof manifest.pages !== "object") {
  console.log("DASHBOARD_BUNDLE_REPORT_SKIPPED: Unknown manifest structure.");
  process.exit(0);
}
const rows = [];
for (const [route, assets] of Object.entries(manifest.pages)) {
  if (!route.startsWith("/dashboard") || !Array.isArray(assets)) continue;
  const names = [...new Set(assets.filter((asset) => typeof asset === "string" && asset.endsWith(".js")))];
  let bytes = 0;
  let gzipBytes = 0;
  let chunks = 0;
  for (const asset of names) {
    const path = join(".next", asset);
    if (!existsSync(path)) continue;
    const content = readFileSync(path);
    bytes += content.length;
    gzipBytes += gzipSync(content).length;
    chunks++;
  }
  rows.push({ route, chunks, bytes, gzipBytes });
}
rows.sort((a, b) => b.gzipBytes - a.gzipBytes);
mkdirSync("performance-results", { recursive: true });
const outPath = "performance-results/dashboard-initial-js.json";
writeFileSync(outPath, JSON.stringify({ description: "Manifest-listed initial JS, not full load or route timings", rows }, null, 2));
console.log("DASHBOARD_INITIAL_JS_MANIFEST");
console.table(rows);
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "### Dashboard initial JavaScript manifest (estimate)",
    "",
    "| Route | Chunks | Raw bytes | Gzip bytes |",
    "|---|---:|---:|---:|",
    ...rows.map((r) => "| " + r.route + " | " + r.chunks + " | " + r.bytes + " | " + r.gzipBytes + " |"),
    "",
    "_Excludes lazy chunks and browser/runtime costs; use authenticated benchmark for UX timings._",
    "",
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
}
