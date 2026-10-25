/**
 * Read-only JavaScript report from Next production build output.
 * Per-route sizes need a compatible manifest; when Next/Turbopack omits
 * that manifest, fall back to static client chunk inventory.
 * Neither estimate is a substitute for real network/browser measurements.
 */
import {readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, appendFileSync} from "node:fs";
import {join, relative} from "node:path";
import {gzipSync} from "node:zlib";

const manifestPath = ".next/app-build-manifest.json";
const root = ".next";
const report = {method:null, caveat:null, routes:[], chunks:[], totals:null};
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.pages && typeof manifest.pages === "object") {
    report.method = "app-build-manifest";
    report.caveat = "Manifest-listed entry chunks only, excluding lazily imported assets.";
    for (const [route, assets] of Object.entries(manifest.pages)) {
      if (!route.startsWith("/dashboard") || !Array.isArray(assets)) continue;
      const names = [...new Set(assets.filter(asset => typeof asset === "string" && asset.endsWith(".js")))];
      let bytes = 0, gzipBytes = 0, chunks = 0;
      for (const name of names) {
        const file = join(root, name);
        if (!existsSync(file)) continue;
        const data = readFileSync(file);
        bytes += data.length;
        gzipBytes += gzipSync(data).length;
        chunks++;
      }
      report.routes.push({route, chunks, bytes, gzipBytes});
    }
    report.routes.sort((a, b) => b.gzipBytes - a.gzipBytes);
  }
}
if (report.routes.length === 0) {
  // Turbopack releases may not emit the traditional per-route manifest.
  // Report all emitted static client chunks without pretending they are
  // downloaded on any single route.
  const staticDir = join(root, "static");
  if (!existsSync(staticDir)) throw new Error("Build output does not contain .next/static");
  report.method = "static-client-chunks";
  report.caveat = "All emitted client JS assets, NOT per-route bundle size and not page transfer size.";
  const files = [];
  const visit = dir => {
    for (const item of readdirSync(dir, {withFileTypes:true})) {
      const name = join(dir,item.name);
      if (item.isDirectory()) visit(name);
      else if (item.isFile() && item.name.endsWith(".js")) files.push(name);
    }
  };
  visit(staticDir);
  const all = files.map(file => {
    const data = readFileSync(file);
    return {file:relative(staticDir,file),bytes:data.length,gzipBytes:gzipSync(data).length};
  }).sort((a,b)=>b.gzipBytes-a.gzipBytes);
  report.chunks = all.slice(0,20);
  report.totals = {
    jsChunkCount:all.length,
    rawBytes:all.reduce((sum,row)=>sum+row.bytes,0),
    gzipBytes:all.reduce((sum,row)=>sum+row.gzipBytes,0)
  };
}
mkdirSync("performance-results",{recursive:true});
writeFileSync("performance-results/dashboard-initial-js.json",JSON.stringify(report,null,2));
console.log("DASHBOARD_JS_REPORT_METHOD: "+report.method);
console.log("DASHBOARD_JS_REPORT_CAVEAT: "+report.caveat);
if (report.method === "app-build-manifest") console.table(report.routes);
else {
  console.log("DASHBOARD_CLIENT_JS_TOTALS: "+JSON.stringify(report.totals));
  console.table(report.chunks.slice(0,10));
}
if (process.env.GITHUB_STEP_SUMMARY) {
  let lines=["### SmartDirect client JavaScript build inventory","",report.caveat,""];
  if (report.method === "app-build-manifest") {
    lines=lines.concat(["| Route | Chunks | Raw bytes | Gzip bytes |","|---|---:|---:|---:|",
      ...report.routes.map(row=>"| "+row.route+" | "+row.chunks+" | "+row.bytes+" | "+row.gzipBytes+" |")]);
  } else {
    lines=lines.concat(["Static JS chunks: "+report.totals.jsChunkCount,
      "Total JS bytes emitted: "+report.totals.rawBytes,
      "Total gzip bytes across chunks: "+report.totals.gzipBytes,
      "","_All chunks across all pages; a browser will fetch only a subset._"]);
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
}
