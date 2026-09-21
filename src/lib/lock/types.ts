export const DISTRIBUTED_LOCK_KEY_PREFIX = "smartdirect:lock:";

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

export const DISTRIBUTED_LOCK_ARCHITECTURE = {
  storage: "redis",
  acquisition: "SET_NX_EX",
  ownership: "random-token",
  release: "ownership-checked",
  ttl: "mandatory",
  failureMode: "fail-closed",
} as const;
