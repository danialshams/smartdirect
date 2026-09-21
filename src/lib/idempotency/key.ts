import { createHash } from "node:crypto";

export type IdempotencyScope = {
  tenantId: string;
  operation: string;
  resourceId?: string | null;
};

const MAX_KEY_LENGTH = 200;

export class InvalidIdempotencyKeyError extends Error {
  constructor(message = "Invalid idempotency key.") {
    super(message);
    this.name = "InvalidIdempotencyKeyError";
  }
}

export function normalizeIdempotencyKey(value: string): string {
  const key = value.trim();

  if (!key) {
    throw new InvalidIdempotencyKeyError("Idempotency key cannot be empty.");
  }

  if (key.length > MAX_KEY_LENGTH) {
    throw new InvalidIdempotencyKeyError(
      `Idempotency key cannot exceed ${MAX_KEY_LENGTH} characters.`,
    );
  }

  return key;
}

export function createIdempotencyKey(
  scope: IdempotencyScope,
  clientKey: string,
): string {
  const normalizedClientKey = normalizeIdempotencyKey(clientKey);
  const tenantId = scope.tenantId.trim();
  const operation = scope.operation.trim();
  const resourceId = scope.resourceId?.trim() ?? "";

  if (!tenantId || !operation) {
    throw new InvalidIdempotencyKeyError(
      "Idempotency scope requires tenantId and operation.",
    );
  }

  const material = [
    "smartdirect",
    "v1",
    tenantId,
    operation,
    resourceId,
    normalizedClientKey,
  ].join(":");

  const digest = createHash("sha256").update(material).digest("hex");

  return `smartdirect:idempotency:v1:${digest}`;
}

export function getIdempotencyTtlSeconds(): number {
  const raw = process.env.IDEMPOTENCY_TTL_SECONDS?.trim();

  if (!raw) return 24 * 60 * 60;

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    return 24 * 60 * 60;
  }

  return value;
}
