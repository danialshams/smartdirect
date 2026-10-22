import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify the exact raw request bytes before parsing a Meta webhook. */
export function verifyInstagramWebhookSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const supplied = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
