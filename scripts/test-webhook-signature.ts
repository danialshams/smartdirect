import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyInstagramWebhookSignature } from "../src/lib/webhook/verify-signature";

const secret = "test-only-app-secret";
const payload = JSON.stringify({ object: "instagram", entry: [{ id: "123" }] });
const signature = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
assert.equal(verifyInstagramWebhookSignature(payload, signature, secret), true);
assert.equal(verifyInstagramWebhookSignature(payload + " ", signature, secret), false);
assert.equal(verifyInstagramWebhookSignature(payload, signature, secret + "-wrong"), false);
assert.equal(verifyInstagramWebhookSignature(payload, "sha256=" + "0".repeat(64), secret), false);
assert.equal(verifyInstagramWebhookSignature(payload, "sha256=invalid", secret), false);
assert.equal(verifyInstagramWebhookSignature(payload, null, secret), false);
assert.equal(verifyInstagramWebhookSignature(payload, signature, ""), false);
console.log("Instagram webhook HMAC signature verification: OK");
