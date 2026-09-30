import { prisma } from "@/lib/prisma";
import type { IdempotencyStatus } from "@/generated/prisma/client";
import { getIdempotencyLeaseTtlSeconds, getIdempotencyTtlSeconds } from "./key";

export type IdempotencyRecord = {
  id: string; key: string; tenantId: string; operation: string; resourceId: string | null;
  status: IdempotencyStatus; response: unknown; errorMessage: string | null;
  expiresAt: Date; completedAt: Date | null; createdAt: Date; updatedAt: Date;
  leaseToken: string | null;
};

export type ClaimIdempotencyInput = {
  key: string;
  tenantId: string;
  operation: string;
  resourceId?: string | null;
  /** @deprecated Use the configured lease TTL. Kept for legacy test callers. */
  ttlSeconds?: number;
};
export type ClaimIdempotencyResult = { claimed: boolean; record: IdempotencyRecord };
export type IdempotencyExecutionState = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export async function getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
  const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
  return record ? (record as IdempotencyRecord) : null;
}

export async function claimIdempotency(input: ClaimIdempotencyInput): Promise<ClaimIdempotencyResult> {
  const tenantId = input.tenantId.trim();
  const operation = input.operation.trim();
  const resourceId = input.resourceId?.trim() || null;
  if (!tenantId) throw new Error("Idempotency tenantId cannot be empty.");
  if (!operation) throw new Error("Idempotency operation cannot be empty.");

  const leaseTtlSeconds = input.ttlSeconds ?? getIdempotencyLeaseTtlSeconds();
  if (!Number.isInteger(leaseTtlSeconds) || leaseTtlSeconds <= 0) {
    throw new Error("Idempotency lease TTL must be a positive integer.");
  }

  const expiresAt = new Date(Date.now() + leaseTtlSeconds * 1000);
  const leaseToken = crypto.randomUUID();
  const candidateId = crypto.randomUUID();

  // PostgreSQL decides ownership atomically. Duplicate callers use
  // DO NOTHING rather than a no-op UPDATE: updating the same idempotency row
  // under a high fan-in race creates an unnecessary write hotspot and can
  // exhaust a small database connection pool. Only the winner writes; losers
  // read the already-existing row.
  const inserted = await prisma.$queryRawUnsafe<IdempotencyRecord[]>(
    `INSERT INTO "IdempotencyRecord"
      ("id", "key", "tenantId", "operation", "resourceId", "status", "expiresAt", "createdAt", "updatedAt", "leaseToken")
     VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', $6, NOW(), NOW(), $7)
     ON CONFLICT ("key") DO NOTHING
     RETURNING *`,
    candidateId,
    input.key,
    tenantId,
    operation,
    resourceId,
    expiresAt,
    leaseToken,
  );

  if (inserted.length === 1) {
    return { claimed: true, record: inserted[0] };
  }

  const row = await prisma.idempotencyRecord.findUnique({ where: { key: input.key } });
  if (!row) throw new Error("Idempotency record disappeared after a concurrent conflict.");
  const existing = row as IdempotencyRecord;

  const now = new Date();
  if (existing.status === "IN_PROGRESS" && existing.expiresAt.getTime() <= now.getTime()) {
    const reclaimed = await prisma.$queryRawUnsafe<IdempotencyRecord[]>(
      `UPDATE "IdempotencyRecord"
       SET "status" = 'IN_PROGRESS',
           "expiresAt" = $2,
           "response" = NULL,
           "errorMessage" = NULL,
           "completedAt" = NULL,
           "leaseToken" = $3,
           "updatedAt" = NOW()
       WHERE "key" = $1
         AND "status" = 'IN_PROGRESS'
         AND "expiresAt" <= NOW()
       RETURNING *`,
      input.key,
      expiresAt,
      leaseToken,
    );

    if (reclaimed.length === 1) {
      return { claimed: true, record: reclaimed[0] };
    }
  }

  return { claimed: false, record: existing };
}

export async function completeIdempotency(key: string, response?: unknown, leaseToken?: string | null): Promise<IdempotencyRecord> {
  const updated = await prisma.idempotencyRecord.updateMany({
    where: { key, status: "IN_PROGRESS", ...(leaseToken ? { leaseToken } : {}) },
    data: {
      status: "COMPLETED",
      response: response === undefined ? undefined : (response as never),
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + getIdempotencyTtlSeconds() * 1000),
      leaseToken: null,
    },
  });
  if (updated.count !== 1) {
    const existing = await getIdempotencyRecord(key);
    if (!existing) throw new Error("Idempotency record not found.");
    if (existing.status === "COMPLETED") return existing;
    throw new Error("Idempotency record cannot be completed from current state.");
  }
  const record = await getIdempotencyRecord(key);
  if (!record) throw new Error("Idempotency record disappeared after completion.");
  return record;
}

export async function failIdempotency(key: string, errorMessage: string, leaseToken?: string | null): Promise<IdempotencyRecord> {
  const message = errorMessage.trim() || "Idempotency operation failed.";
  const updated = await prisma.idempotencyRecord.updateMany({
    where: { key, status: "IN_PROGRESS", ...(leaseToken ? { leaseToken } : {}) },
    data: {
      status: "FAILED",
      errorMessage: message,
      expiresAt: new Date(Date.now() + getIdempotencyTtlSeconds() * 1000),
      leaseToken: null,
    },
  });
  if (updated.count !== 1) {
    const existing = await getIdempotencyRecord(key);
    if (!existing) throw new Error("Idempotency record not found.");
    if (existing.status === "FAILED") return existing;
    throw new Error("Idempotency record cannot be failed from current state.");
  }
  const record = await getIdempotencyRecord(key);
  if (!record) throw new Error("Idempotency record disappeared after failure.");
  return record;
}

export async function retryFailedIdempotency(key: string, ttlSeconds: number = getIdempotencyTtlSeconds()): Promise<ClaimIdempotencyResult> {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error("Idempotency TTL must be a positive integer.");
  const updated = await prisma.idempotencyRecord.updateMany({
    where: { key, status: "FAILED" },
    data: {
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + getIdempotencyLeaseTtlSeconds() * 1000),
      response: { set: null }, errorMessage: null, completedAt: null,
      leaseToken: crypto.randomUUID(),
    },
  });
  const record = await getIdempotencyRecord(key);
  if (!record) throw new Error("Idempotency record not found.");
  return { claimed: updated.count === 1, record };
}

export function getIdempotencyExecutionState(record: Pick<IdempotencyRecord, "status">): IdempotencyExecutionState {
  return record.status;
}
