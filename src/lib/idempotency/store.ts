import "server-only";

import { prisma } from "@/lib/prisma";
import type { IdempotencyStatus } from "@/generated/prisma/client";
import { getIdempotencyTtlSeconds } from "./key";

export type IdempotencyRecord = {
  id: string;
  key: string;
  tenantId: string;
  operation: string;
  resourceId: string | null;
  status: IdempotencyStatus;
  response: unknown;
  errorMessage: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClaimIdempotencyInput = {
  key: string;
  tenantId: string;
  operation: string;
  resourceId?: string | null;
  ttlSeconds?: number;
};

export type ClaimIdempotencyResult = {
  claimed: boolean;
  record: IdempotencyRecord;
};

function toRecord(value: {
  id: string;
  key: string;
  tenantId: string;
  operation: string;
  resourceId: string | null;
  status: IdempotencyStatus;
  response: unknown;
  errorMessage: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): IdempotencyRecord {
  return value;
}

export async function getIdempotencyRecord(
  key: string,
): Promise<IdempotencyRecord | null> {
  const record = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  return record ? toRecord(record) : null;
}

export async function claimIdempotency(
  input: ClaimIdempotencyInput,
): Promise<ClaimIdempotencyResult> {
  const tenantId = input.tenantId.trim();
  const operation = input.operation.trim();
  const resourceId = input.resourceId?.trim() || null;

  if (!tenantId) {
    throw new Error("Idempotency tenantId cannot be empty.");
  }

  if (!operation) {
    throw new Error("Idempotency operation cannot be empty.");
  }

  const ttlSeconds = input.ttlSeconds ?? getIdempotencyTtlSeconds();

  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("Idempotency TTL must be a positive integer.");
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    const created = await prisma.idempotencyRecord.create({
      data: {
        key: input.key,
        tenantId,
        operation,
        resourceId,
        status: "IN_PROGRESS",
        expiresAt,
      },
    });

    return {
      claimed: true,
      record: toRecord(created),
    };
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    if (code !== "P2002") {
      throw error;
    }

    const existing = await prisma.idempotencyRecord.findUnique({
      where: { key: input.key },
    });

    if (!existing) {
      throw error;
    }

    const now = new Date();

    if (
      existing.status === "IN_PROGRESS" &&
      existing.expiresAt.getTime() <= now.getTime()
    ) {
      const reclaimed = await prisma.idempotencyRecord.updateMany({
        where: {
          key: input.key,
          status: "IN_PROGRESS",
          expiresAt: { lte: now },
        },
        data: {
          status: "IN_PROGRESS",
          expiresAt,
          response: null,
          errorMessage: null,
          completedAt: null,
        },
      });

      if (reclaimed.count === 1) {
        const record = await getIdempotencyRecord(input.key);
        if (!record) {
          throw new Error("Idempotency record disappeared after reclaim.");
        }

        return {
          claimed: true,
          record,
        };
      }

      const latest = await getIdempotencyRecord(input.key);
      if (!latest) {
        throw error;
      }

      return {
        claimed: false,
        record: latest,
      };
    }

    return {
      claimed: false,
      record: toRecord(existing),
    };
  }
}

export async function completeIdempotency(
  key: string,
  response?: unknown,
): Promise<IdempotencyRecord> {
  const updated = await prisma.idempotencyRecord.updateMany({
    where: {
      key,
      status: "IN_PROGRESS",
    },
    data: {
      status: "COMPLETED",
      response: response === undefined ? undefined : response as never,
      completedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    const existing = await getIdempotencyRecord(key);

    if (!existing) {
      throw new Error("Idempotency record not found.");
    }

    if (existing.status === "COMPLETED") {
      return existing;
    }

    throw new Error(
      `Idempotency record cannot be completed from status ${existing.status}.`,
    );
  }

  const record = await getIdempotencyRecord(key);

  if (!record) {
    throw new Error("Idempotency record disappeared after completion.");
  }

  return record;
}

export async function failIdempotency(
  key: string,
  errorMessage: string,
): Promise<IdempotencyRecord> {
  const message = errorMessage.trim() || "Idempotency operation failed.";

  const updated = await prisma.idempotencyRecord.updateMany({
    where: {
      key,
      status: "IN_PROGRESS",
    },
    data: {
      status: "FAILED",
      errorMessage: message,
    },
  });

  if (updated.count !== 1) {
    const existing = await getIdempotencyRecord(key);

    if (!existing) {
      throw new Error("Idempotency record not found.");
    }

    if (existing.status === "FAILED") {
      return existing;
    }

    throw new Error(
      `Idempotency record cannot be failed from status ${existing.status}.`,
    );
  }

  const record = await getIdempotencyRecord(key);

  if (!record) {
    throw new Error("Idempotency record disappeared after failure.");
  }

  return record;
}


export function getIdempotencyExecutionState(
  record: Pick<IdempotencyRecord, "status">,
): IdempotencyExecutionState {
  return record.status;
}
