import "dotenv/config";
import { consumeInstagramRateLimit } from "../src/lib/instagram/rate-limit";
const accountId = process.env.RATE_LIMIT_TEST_ACCOUNT ?? "rate-limit-worker";
const tenantId = process.env.RATE_LIMIT_TEST_TENANT ?? "rate-limit-tenant";
const operation = "COMMENT_REPLY" as const;
const count = Number(process.env.RATE_LIMIT_TEST_COUNT ?? 10);
async function main() {
  const results = await Promise.all(Array.from({ length: count }, () => consumeInstagramRateLimit({ instagramAccountId: accountId, tenantId, operation })));
  const allowed = results.filter((item) => item.allowed).length;
  const denied = results.length - allowed;
  console.log(JSON.stringify({ allowed, denied }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });