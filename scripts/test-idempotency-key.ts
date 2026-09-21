import { createIdempotencyKey, normalizeIdempotencyKey } from "../src/lib/idempotency/key";

async function main() {
  const keyA = createIdempotencyKey(
    { tenantId: "tenant-a", operation: "PUBLISH", resourceId: "account-a" },
    " request-123 ",
  );

  const keyB = createIdempotencyKey(
    { tenantId: "tenant-a", operation: "PUBLISH", resourceId: "account-a" },
    "request-123",
  );

  const differentTenant = createIdempotencyKey(
    { tenantId: "tenant-b", operation: "PUBLISH", resourceId: "account-a" },
    "request-123",
  );

  const differentOperation = createIdempotencyKey(
    { tenantId: "tenant-a", operation: "SEND_MESSAGE", resourceId: "account-a" },
    "request-123",
  );

  if (keyA !== keyB) {
    throw new Error("Normalized equivalent keys must produce the same scoped key.");
  }

  if (keyA === differentTenant) {
    throw new Error("Different tenants must never share an idempotency key.");
  }

  if (keyA === differentOperation) {
    throw new Error("Different operations must never share an idempotency key.");
  }

  let rejected = false;
  try {
    normalizeIdempotencyKey("   ");
  } catch {
    rejected = true;
  }

  if (!rejected) {
    throw new Error("Blank idempotency keys must be rejected.");
  }

  const tooLong = "x".repeat(201);
  rejected = false;
  try {
    normalizeIdempotencyKey(tooLong);
  } catch {
    rejected = true;
  }

  if (!rejected) {
    throw new Error("Oversized idempotency keys must be rejected.");
  }

  console.log("64 idempotency key definition: OK");
  console.log({
    success: true,
    tests: ["normalization", "tenant-isolation", "operation-isolation", "validation"],
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
