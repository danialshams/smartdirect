import assert from "node:assert/strict";
import { readMetaUsageHeaders } from "../src/lib/instagram/usage-headers";
const b = new Headers({
  "x-business-use-case-usage": JSON.stringify({
    "hidden_business_id": [{ call_count: 92, total_time: 33, total_cputime: 22 }],
  }),
});
assert.deepEqual(readMetaUsageHeaders(b), { source: "business", maxUsagePercent: 92 });
assert.deepEqual(readMetaUsageHeaders(new Headers({ "x-app-usage": '{"call_count":47}' })), {
  source: "app", maxUsagePercent: 47,
});
assert.equal(readMetaUsageHeaders(new Headers({ "x-app-usage": "broken" })), null);
assert.equal(readMetaUsageHeaders(new Headers()), null);
console.log("Meta usage header observability tests: OK");
