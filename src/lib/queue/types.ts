export type QueueJobStatus =
  | "waiting"
  | "delayed"
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

export type QueueJobPriority = "low" | "normal" | "high" | "critical";

export type QueueJobType =
  | "TEST"
  | "INSTAGRAM_WEBHOOK"
  | "AUTOMATION"
  | "SEND_MESSAGE"
  | "PUBLISH";

export interface QueueJobPayloadMap {
  TEST: {
    message?: string;
  };
  INSTAGRAM_WEBHOOK: {
    event: unknown;
  };
  AUTOMATION: {
    automationId: string;
    conversationId?: string;
  };
  SEND_MESSAGE: {
    instagramAccountId: string;
    recipientId: string;
    message: unknown;
  };
  PUBLISH: {
    publishingJobId: string;
  };
}

export type QueueJobPayload<T extends QueueJobType> = QueueJobPayloadMap[T];

export interface QueueJobIdempotency {
  key: string;
  tenantId: string;
  operation: string;
  resourceId?: string | null;
}

export interface QueueJob<T extends QueueJobType = QueueJobType> {
  id: string;
  type: T;
  payload: QueueJobPayload<T>;
  status: QueueJobStatus;
  priority: QueueJobPriority;
  createdAt: number;
  scheduledAt: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  workerId?: string;
  idempotency?: QueueJobIdempotency;
}

export interface EnqueueJobOptions {
  priority?: QueueJobPriority;
  delayMs?: number;
  maxAttempts?: number;
  idempotency?: QueueJobIdempotency;
}
