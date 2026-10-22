import assert from "node:assert/strict";
import { resolveExecutionBackend } from "../src/lib/runtime/execution-backend";

assert.equal(resolveExecutionBackend({ VERCEL: "1" }), "workflow");
assert.equal(resolveExecutionBackend({}), "worker");
assert.equal(resolveExecutionBackend({ VERCEL: "1", EXECUTION_BACKEND: "worker" }), "worker");
assert.equal(resolveExecutionBackend({ EXECUTION_BACKEND: "workflow" }), "workflow");
assert.throws(() => resolveExecutionBackend({ EXECUTION_BACKEND: "other" }), /INVALID_EXECUTION_BACKEND/);
console.log("Execution backend portability: OK");
