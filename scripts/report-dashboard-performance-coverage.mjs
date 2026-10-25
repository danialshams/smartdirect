/**
 * Static coverage inventory (not a runtime benchmark).
 * Lists dashboard pages and API handler methods to drive safe test planning.
 * Never opens the app, accesses secrets or executes mutating endpoints.
 */
import {readdirSync, readFileSync, mkdirSync, writeFileSync, appendFileSync} from "node:fs";
import {join, relative, sep} from "node:path";
const walk=(root,extensions)=> {
  const paths=[];
  const visit=p=>{
    for (const entry of readdirSync(p,{withFileTypes:true})) {
      const target=join(p,entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && extensions.some(x=>target.endsWith(x))) paths.push(target);
    }
  };
  visit(root);
  return paths;
};
const normalize=p=>p.split(sep).join("/");
const pageFiles=walk("app/dashboard",["page.tsx"]).sort();
pageFiles.push("app/dashboard/page.tsx");
const pages=[...new Set(pageFiles)].sort().map(file=>{
  const route="/"+normalize(file).replace(/^app\//,"").replace(/\/page\.tsx$/,"");
  const dynamic=/\[.+?\]/.test(route);
  const area=route.split("/")[2]||"home";
  const source=readFileSync(file,"utf8");
  return {route,area,dynamic,hasClientDirective:source.includes('"use client"')||source.includes("'use client'")};
});
const apiFiles=walk("app/api",["route.ts"]).sort();
const actionMethods=["POST","PUT","PATCH","DELETE"];
const endpoints=apiFiles.map(file=>{
  const source=readFileSync(file,"utf8");
  const methods=["GET",...actionMethods].filter(method=>
    new RegExp("export\\s+(?:async\\s+)?function\\s+"+method+"\\s*\\(").test(source) ||
    new RegExp("export\\s+const\\s+"+method+"\\s*=").test(source)
  );
  return {path:"/"+normalize(file).replace(/^app\//,"").replace(/\/route\.ts$/,""),
    methods,mutatingMethods:methods.filter(m=>actionMethods.includes(m))};
});
const report={
  type:"static-inventory-not-performance-results",
  createdAt:new Date().toISOString(),
  totals:{dashboardPages:pages.length,dynamicPages:pages.filter(x=>x.dynamic).length,
    staticPages:pages.filter(x=>!x.dynamic).length,apiHandlers:endpoints.length,
    apiHandlersWithWrites:endpoints.filter(x=>x.mutatingMethods.length).length},
  pages,endpoints,
  constraints:[
    "Dynamic [id] routes need disposable seeded records and role-based authorization.",
    "POST, PUT, PATCH and DELETE must not be benchmarked against production.",
    "UI feedback timing and persistence timing need separate measurements.",
    "Browser return visits, images and authenticated state require a local test-user session.",
    "Static handler methods cannot demonstrate real request speed or usability."
  ]
};
mkdirSync("performance-results",{recursive:true});
writeFileSync("performance-results/dashboard-performance-coverage.json",JSON.stringify(report,null,2));
console.log("DASHBOARD_PERF_INVENTORY "+JSON.stringify(report.totals));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=["### Dashboard performance coverage inventory",
    "","This is a **static map**, not measured UX performance.",
    "","- Page routes: "+report.totals.dashboardPages,
    "- Dynamic routes needing fixture IDs: "+report.totals.dynamicPages,
    "- API handlers: "+report.totals.apiHandlers,
    "- Handlers supporting mutating methods: "+report.totals.apiHandlersWithWrites,
    "","_Production write endpoints will not be executed by this report._",""];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n"));
}
