import { prisma } from "@/lib/prisma";
import { retryFailedIdempotency } from "@/lib/idempotency/store";
import {
  createQueueRedis,
  enqueueJob,
  failJob,
  getQueueKeys,
} from "./core";
import type { QueueJobPayload, QueueJobType } from "./types";

const CLAIM_PREFIX = "smartdirect:queue:claim:";
const JOB_PREFIX = "smartdirect:queue:job:";
const STALLED_TTL_SECONDS = Math.max(
  5,
  Number(process.env.QUEUE_STALLED_TTL_SECONDS ?? 30),
);

const QUEUE_JOB_TYPES: QueueJobType[] = [
  "TEST",
  "INSTAGRAM_WEBHOOK",
  "AUTOMATION",
  "SEND_MESSAGE",
  "PUBLISH",
];

function isQueueJobType(value: string): value is QueueJobType {
  return QUEUE_JOB_TYPES.includes(value as QueueJobType);
}

function claimKey(jobId: string) {
  return `${CLAIM_PREFIX}${jobId}`;
}

function jobKey(jobId: string) {
  return `${JOB_PREFIX}${jobId}`;
}

export async function recoverStalledJobs(limit = 50, queueNamespace = "default") {
  const redis = createQueueRedis();
  const keys = getQueueKeys(queueNamespace);
  const cutoff = Date.now() - STALLED_TTL_SECONDS * 1000;
  const ids = await redis.zrange<string[]>(keys.active, 0, cutoff, {
    byScore: true,
    offset: 0,
    count: limit,
  });

  let recovered = 0;
  let permanentlyFailed = 0;

  for (const id of ids) {
    const [job, claim] = await Promise.all([
      redis.get<any>(jobKey(id)),
      redis.get<string>(claimKey(id)),
    ]);

    if (!job) {
      await redis.zrem(keys.active, id);
      continue;
    }

    if (claim) {
      continue;
    }

    if (job.status !== "active") {
      await redis.zrem(keys.active, id);
      continue;
    }

    if (job.attempts >= job.maxAttempts) {
      await failJob(id, new Error("JOB_STALLED_MAX_ATTEMPTS"));
      permanentlyFailed++;
      console.log(JSON.stringify({
        event: "queue:stalled:permanent-failure",
        jobId: id,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      }));
      continue;
    }

    job.status = "waiting";
    job.workerId = undefined;

    await redis.set(jobKey(id), job);
    await redis.zrem(keys.active, id);
    await redis.zadd(keys.ready, {
      score: job.scheduledAt * 10,
      member: id,
    });

    recovered++;
    console.log(JSON.stringify({
      event: "queue:stalled:recovered",
      jobId: id,
      attempts: job.attempts,
    }));
  }

  return { scanned: ids.length, recovered, permanentlyFailed };
}

export async function retryFailedJob(failureId: string) {
  const failure = await prisma.queueFailure.findUnique({
    where: { id: failureId },
  });

  if (!failure) {
    throw new Error("QUEUE_FAILURE_NOT_FOUND");
  }

  if (failure.status !== "FAILED") {
    throw new Error(`QUEUE_FAILURE_NOT_RETRYABLE:${failure.status}`);
  }

  if (!isQueueJobType(failure.type)) {
    throw new Error("QUEUE_FAILURE_INVALID_JOB_TYPE");
  }

  if (failure.idempotencyKey && failure.idempotencyTenantId && failure.idempotencyOperation) {
    const retry = await retryFailedIdempotency(failure.idempotencyKey);
    if (!retry.claimed && retry.record.status !== "IN_PROGRESS") {
      throw new Error("QUEUE_FAILURE_IDEMPOTENCY_NOT_RETRYABLE");
    }
  }

  const idempotency =
    failure.idempotencyKey && failure.idempotencyTenantId && failure.idempotencyOperation
      ? {
          key: failure.idempotencyKey,
          tenantId: failure.idempotencyTenantId,
          operation: failure.idempotencyOperation,
          resourceId: failure.idempotencyResourceId,
        }
      : undefined;

  const job = await enqueueJob(
    failure.type,
    failure.payload as QueueJobPayload<QueueJobType>,
    {
      priority: failure.priority as "low" | "normal" | "high" | "critical",
      maxAttempts: failure.maxAttempts,
      idempotency,
      recoveryId: failure.id,
    },
  );

  await prisma.queueFailure.update({
    where: { id: failure.id },
    data: {
      status: "REQUEUED",
      requeuedJobId: job.id,
      requeuedAt: new Date(),
    },
  });

  const redis = createQueueRedis();
  const failureKeys = getQueueKeys("default");
  await redis.zrem(failureKeys.failed, failure.jobId);

  console.log(JSON.stringify({
    event: "queue:manual-retry",
    failureId: failure.id,
    originalJobId: failure.jobId,
    requeuedJobId: job.id,
  }));

  return job;
}

export async function getFailedJobs(limit = 100) {
  return prisma.queueFailure.findMany({
    where: { status: "FAILED" },
    orderBy: { failedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
}

export async function getFailedJob(failureId: string) {
  return prisma.queueFailure.findUnique({
    where: { id: failureId },
  });
}

export async function getRecoveryHealth(queueNamespace = "default") {
  const redis = createQueueRedis();
  const keys = getQueueKeys(queueNamespace);
  const [failed, active, ready] = await Promise.all([
    redis.zcard(keys.failed),
    redis.zcard(keys.active),
    redis.zcard(keys.ready),
  ]);

  return {
    failed,
    active,
    ready,
    stalledTtlSeconds: STALLED_TTL_SECONDS,
  };
}
