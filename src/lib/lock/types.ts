import "server-only";

export type DistributedLockScope =
  | "job"
  | "instagram-account"
  | "conversation"
  | "publishing-job";

export type DistributedLockKeyInput = {
  scope: DistributedLockScope;
  resourceId: string;
};

export type DistributedLockHandle = {
  key: string;
  token: string;
  expiresAt: number;
};

export type AcquireLockResult =
  | {
      acquired: true;
      handle: DistributedLockHandle;
    }
  | {
      acquired: false;
      reason: "ALREADY_LOCKED";
    };

/**
 * SmartDirect distributed-lock architecture.
 *
 * Redis is the coordination authority because every worker must observe
 * the same lock state. Lock ownership is represented by a random token,
 * not by the worker id alone.
 *
 * Lifecycle:
 *   acquire -> work -> release
 *
 * Safety rules:
 * - every lock has a finite TTL;
 * - only the owner token may release its lock;
 * - an expired lock may be acquired by another worker;
 * - lock acquisition must be atomic (SET NX EX);
 * - lock release must be ownership-checked atomically;
 * - lock failures must fail closed: do not execute protected work without
 *   a confirmed lock.
 *
 * The concrete Redis acquire/release implementation is intentionally kept
 * separate and is implemented in the following roadmap stages.
 */
export const DISTRIBUTED_LOCK_ARCHITECTURE = {
  storage: "redis",
  acquisition: "SET_NX_EX",
  ownership: "random-token",
  release: "ownership-checked",
  ttl: "mandatory",
  failureMode: "fail-closed",
} as const;
