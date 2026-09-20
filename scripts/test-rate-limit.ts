import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as any;

let consumeInstagramRateLimit: typeof import("../src/lib/instagram/rate-limit").consumeInstagramRateLimit;

async function loadRateLimiter() {
  ({ consumeInstagramRateLimit } = await import("../src/lib/instagram/rate-limit"));
}
const LIMIT = 5;
const WINDOW = 2000;
const prefix = "smartdirect-rate-limit-test:" + Date.now();
function ctx(account: string, tenant: string) { return { instagramAccountId: account, tenantId: tenant, operation: "COMMENT_REPLY" as const }; }
async function burst() {
 const account = prefix + ":burst";
 const r = await Promise.all(Array.from({ length: LIMIT + 3 }, () => consumeInstagramRateLimit(ctx(account, prefix + ":tenant"))));
 const allowed = r.filter(x => x.allowed).length;
 if (allowed !== LIMIT) throw new Error("Burst failed: " + allowed);
 console.log("49 burst: OK");
}
async function isolation() {
 const r1 = await Promise.all(Array.from({ length: LIMIT }, () => consumeInstagramRateLimit(ctx(prefix + ":account-a", prefix + ":tenant-a"))));
 const r2 = await Promise.all(Array.from({ length: LIMIT }, () => consumeInstagramRateLimit(ctx(prefix + ":account-b", prefix + ":tenant-b"))));
 if (r1.filter(x => x.allowed).length !== LIMIT || r2.filter(x => x.allowed).length !== LIMIT) throw new Error("Account/tenant isolation failed");
 console.log("47 multi-user / 48 multi-account isolation: OK");
}
async function workers() {
 const account = prefix + ":workers"; const tenant = prefix + ":workers-tenant";
 const promises = Array.from({ length: 4 }, () => new Promise<string>((resolve, reject) => {
   const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "scripts/test-rate-limit-worker.ts"], { env: { ...process.env, RATE_LIMIT_TEST_ACCOUNT: account, RATE_LIMIT_TEST_TENANT: tenant, RATE_LIMIT_TEST_COUNT: "4", INSTAGRAM_RATE_LIMIT_COMMENT_REPLY_LIMIT: String(LIMIT), INSTAGRAM_RATE_LIMIT_COMMENT_REPLY_WINDOW_MS: String(WINDOW), INSTAGRAM_RATE_LIMIT_GLOBAL_LIMIT: "10000", INSTAGRAM_RATE_LIMIT_GLOBAL_WINDOW_MS: String(WINDOW), INSTAGRAM_RATE_LIMIT_TENANT_LIMIT: "10000", INSTAGRAM_RATE_LIMIT_TENANT_WINDOW_MS: String(WINDOW), INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT: String(LIMIT), INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS: String(WINDOW) }, stdio: ["ignore","pipe","pipe"], shell: process.platform === "win32" });
   let out=""; let err=""; child.stdout.on("data", x => out += x.toString()); child.stderr.on("data", x => err += x.toString()); child.on("error", reject); child.on("close", code => code === 0 ? resolve(out) : reject(new Error(err || "worker failed")));
 }));
 const results = await Promise.all(promises);
 const parsed = results.map(x => JSON.parse(x.trim().split("\n").pop()!));
 const allowed = parsed.reduce((s,x) => s + x.allowed, 0);
 const denied = parsed.reduce((s,x) => s + x.denied, 0);
 if (allowed !== LIMIT || denied !== 11) throw new Error("Multi-worker failed: " + allowed + "/" + denied);
 console.log("50 multi-worker atomicity: OK");
}
async function main() {
 await loadRateLimiter();
 process.env.INSTAGRAM_RATE_LIMIT_COMMENT_REPLY_LIMIT = String(LIMIT);
 process.env.INSTAGRAM_RATE_LIMIT_COMMENT_REPLY_WINDOW_MS = String(WINDOW);
 process.env.INSTAGRAM_RATE_LIMIT_GLOBAL_LIMIT = "10000"; process.env.INSTAGRAM_RATE_LIMIT_GLOBAL_WINDOW_MS = String(WINDOW);
 process.env.INSTAGRAM_RATE_LIMIT_TENANT_LIMIT = "10000"; process.env.INSTAGRAM_RATE_LIMIT_TENANT_WINDOW_MS = String(WINDOW);
 process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT = String(LIMIT); process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS = String(WINDOW);
 await burst(); await new Promise(r => setTimeout(r, WINDOW + 100));
 await isolation(); await new Promise(r => setTimeout(r, WINDOW + 100));
 await workers(); console.log(JSON.stringify({ success: true, tests: [47,48,49,50] }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });