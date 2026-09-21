import type { Redis } from "@upstash/redis";
import { getRedisClient } from "@/lib/redis/client";
import { prisma } from "@/lib/prisma";

import type {
  EnqueueJobOptions,
  QueueJob,
  QueueJobPayload,
  QueueJobPriority,
  QueueJobType,
} from "./types";

const DEFAULT_QUEUE_NAMESPACE = "default";
const JOB_PREFIX = "smartdirect:queue:job:";
const CLAIM_PREFIX = "smartdirect:queue:claim:";

function normalizeQueueNamespace(queueNamespace = DEFAULT_QUEUE_NAMESPACE) {
  const value = queueNamespace.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error("INVALID_QUEUE_NAMESPACE");
  }
  return value;
}

export function getQueueKeys(queueNamespace = DEFAULT_QUEUE_NAMESPACE) {
  const namespace = normalizeQueueNamespace(queueNamespace);
  const prefix = `smartdirect:queue:${namespace}`;

  return {
    queue: namespace,
    ready: `${prefix}:ready`,
    delayed: `${prefix}:delayed`,
    active: `${prefix}:active`,
    failed: `${prefix}:failed`,
  };
}
const CLAIM_TTL_SECONDS = 30;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;

const PRIORITY_WEIGHT: Record<QueueJobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function createQueueRedis() {
  return getRedisClient();
}

export function createJobId() {
  return `job_${Date.now()}_${crypto.randomUUID()}`;
}

function jobKey(jobId: string) {
  return `${JOB_PREFIX}${jobId}`;
}

function claimKey(jobId: string) {
  return `${CLAIM_PREFIX}${jobId}`;
}

function readyScore(job: QueueJob) {
  return job.scheduledAt * 10 + PRIORITY_WEIGHT[job.priority];
}

export async function enqueueJob<T extends QueueJobType>(
  type: T,
  payload: QueueJobPayload<T>,
  options: EnqueueJobOptions = {},
): Promise<QueueJob<T>> {
  const redis = createQueueRedis();
  const now = Date.now();
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const priority = options.priority ?? "normal";

  const queueNamespace = normalizeQueueNamespace(options.queueNamespace);

  const job: QueueJob<T> = {
    id: createJobId(),
    type,
    payload,
    status: delayMs > 0 ? "delayed" : "waiting",
    priority,
    createdAt: now,
    scheduledAt: now + delayMs,
    attempts: 0,
    maxAttempts: Math.max(1, options.maxAttempts ?? 3),
    idempotency: options.idempotency,
    recoveryId: options.recoveryId,
    queueNamespace,
  };

  await redis.set(jobKey(job.id), job);

  const keys = getQueueKeys(queueNamespace);

  if (delayMs > 0) {
    await redis.zadd(keys.delayed, {
      score: job.scheduledAt,
      member: job.id,
    });
  } else {
    await redis.zadd(keys.ready, {
      score: readyScore(job),
      member: job.id,
    });
  }

  return job;
}

export async function enqueueJobsBatch<T extends QueueJobType>(
  jobsInput: Array<{
    type: T;
    payload: QueueJobPayload<T>;
    options?: EnqueueJobOptions;
  }>,
): Promise<QueueJob<T>[]> {
  if (!jobsInput.length) return [];

  const redis = createQueueRedis();
  const now = Date.now();

  const jobs = jobsInput.map(({ type, payload, options = {} }) => {
    const queueNamespace = normalizeQueueNamespace(options.queueNamespace);
    const delayMs = Math.max(0, options.delayMs ?? 0);
    const priority = options.priority ?? "normal";

    return {
      id: createJobId(),
      type,
      payload,
      status: delayMs > 0 ? "delayed" : "waiting",
      priority,
      createdAt: now,
      scheduledAt: now + delayMs,
      attempts: 0,
      maxAttempts: Math.max(1, options.maxAttempts ?? 3),
      idempotency: options.idempotency,
      recoveryId: options.recoveryId,
      queueNamespace,
    } as QueueJob<T>;
  });

  const pipeline = redis.pipeline();

  for (const job of jobs) {
    pipeline.set(jobKey(job.id), job);

    const keys = getQueueKeys(job.queueNamespace);

    if (job.status === "delayed") {
      pipeline.zadd(keys.delayed, {
        score: job.scheduledAt,
        member: job.id,
      });
    } else {
      pipeline.zadd(keys.ready, {
        score: readyScore(job),
        member: job.id,
      });
    }
  }

  await pipeline.exec();

  return jobs;
}

export async function promoteDueJobs(limit = 50, queueNamespace = DEFAULT_QUEUE_NAMESPACE) {
  const redis = createQueueRedis();
  const now = Date.now();
  const keys = getQueueKeys(queueNamespace);

  const ids = await redis.zrange<string[]>(
    keys.delayed,
    0,
    now,
    { byScore: true, offset: 0, count: limit },
  );

  let promoted = 0;

  for (const id of ids) {
    const job = await redis.get<QueueJob>(jobKey(id));

    if (!job) {
      await redis.zrem(keys.delayed, id);
      continue;
    }

    if (job.status !== "delayed" || job.scheduledAt > now) {
      if (job.status !== "delayed") {
        await redis.zrem(keys.delayed, id);
      }
      continue;
    }

    job.status = "waiting";
    await redis.set(jobKey(id), job);
    await redis.zrem(keys.delayed, id);
    await redis.zadd(keys.ready, {
      score: readyScore(job),
      member: id,
    });
    promoted++;
  }

  return promoted;
}

const CLAIM_NEXT_JOB_SCRIPT = `
local ids = redis.call("ZRANGE", KEYS[1], 0, 49)

for _, id in ipairs(ids) do
  local claimKey = ARGV[1] .. id
  local existingClaim = redis.call("GET", claimKey)

  if not existingClaim then
    local rawJob = redis.call("GET", ARGV[2] .. id)

    if not rawJob then
      redis.call("ZREM", KEYS[1], id)
    else
      local job = cjson.decode(rawJob)

      if job.status ~= "waiting" then
        redis.call("ZREM", KEYS[1], id)
      else
        job.status = "active"
        job.attempts = (job.attempts or 0) + 1
        job.workerId = ARGV[3]

        redis.call("SET", claimKey, ARGV[3], "EX", ARGV[4])
        redis.call("SET", ARGV[2] .. id, cjson.encode(job))
        redis.call("ZADD", KEYS[2], ARGV[5], id)
        redis.call("ZREM", KEYS[1], id)

        return cjson.encode(job)
      end
    end
  end
end

return nil
`;

export async function claimNextJob(
  workerId = "unknown",
  queueNamespace = DEFAULT_QUEUE_NAMESPACE,
): Promise<QueueJob | null> {
  const redis = createQueueRedis();
  const keys = getQueueKeys(queueNamespace);

  const result = await redis.eval(
    CLAIM_NEXT_JOB_SCRIPT,
    [keys.ready, keys.active],
    [
      CLAIM_PREFIX,
      JOB_PREFIX,
      workerId,
      String(CLAIM_TTL_SECONDS),
      String(Date.now()),
    ],
  );

  if (!result) {
    return null;
  }

  if (typeof result === "string") {
    try {
      return JSON.parse(result) as QueueJob;
    } catch {
      throw new Error(`QUEUE_CLAIM_INVALID_RESULT:${result}`);
    }
  }

  if (result && typeof result === "object") {
    return result as QueueJob;
  }

  throw new Error("QUEUE_CLAIM_INVALID_RESULT");
}

async function removeJobFromQueue(
  redis: Redis,
  jobId: string,
  queueNamespace = DEFAULT_QUEUE_NAMESPACE,
) {
  const keys = getQueueKeys(queueNamespace);

  await Promise.all([
    redis.zrem(keys.ready, jobId),
    redis.zrem(keys.delayed, jobId),
  ]);
}

export async function completeJob(jobId: string) {
  const redis = createQueueRedis();
  const job = await redis.get<QueueJob>(jobKey(jobId));

  if (!job) return null;

  job.status = "completed";
  job.workerId = undefined;

  if (job.recoveryId) {
    await prisma.queueFailure.updateMany({
      where: { id: job.recoveryId, status: "REQUEUED" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  const keys = getQueueKeys(job.queueNamespace);

  await Promise.all([
    redis.zrem(keys.active, jobId),
    redis.set(jobKey(jobId), job),
    removeJobFromQueue(redis, jobId, job.queueNamespace),
  ]);

  return job;
}

export async function failJob(jobId: string, error: unknown) {
  const redis = createQueueRedis();
  const job = await redis.get<QueueJob>(jobKey(jobId));

  if (!job) return null;

  job.lastError = error instanceof Error ? error.message : String(error);
  job.workerId = undefined;

  await redis.del(claimKey(jobId));
  const keys = getQueueKeys(job.queueNamespace);

  await redis.zrem(keys.active, jobId);

  if (job.attempts < job.maxAttempts) {
    const retryDelayMs = Math.min(
      MAX_RETRY_DELAY_MS,
      DEFAULT_RETRY_DELAY_MS * 2 ** Math.max(0, job.attempts - 1),
    );

    job.status = "delayed";
    job.scheduledAt = Date.now() + retryDelayMs;

    await redis.set(jobKey(jobId), job);
    await redis.zadd(keys.delayed, {
      score: job.scheduledAt,
      member: job.id,
    });

    return job;
  }

  job.status = "failed";

  await Promise.all([
    redis.set(jobKey(jobId), job),
    removeJobFromQueue(redis, jobId, job.queueNamespace),
    redis.zadd(keys.failed, { score: Date.now(), member: jobId }),
  ]);

  await prisma.queueFailure.upsert({
    where: { jobId },
    create: {
      jobId,
      type: job.type,
      payload: JSON.parse(JSON.stringify(job.payload)),
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError ?? "Unknown queue failure",
      tenantId: job.idempotency?.tenantId ?? null,
      idempotencyKey: job.idempotency?.key ?? null,
      idempotencyTenantId: job.idempotency?.tenantId ?? null,
      idempotencyOperation: job.idempotency?.operation ?? null,
      idempotencyResourceId: job.idempotency?.resourceId ?? null,
    },
    update: {
      type: job.type,
      payload: JSON.parse(JSON.stringify(job.payload)),
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError ?? "Unknown queue failure",
      status: "FAILED",
      failedAt: new Date(),
      resolvedAt: null,
    },
  });

  return job;
}

export async function getJob(jobId: string) {
  const redis = createQueueRedis();
  return redis.get<QueueJob>(jobKey(jobId));
}

export async function deleteJob(jobId: string) {
  const redis = createQueueRedis();
  const job = await redis.get<QueueJob>(jobKey(jobId));
  const keys = getQueueKeys(job?.queueNamespace);
  await Promise.all([
    redis.del(jobKey(jobId)),
    redis.del(claimKey(jobId)),
    redis.zrem(keys.active, jobId),
    redis.zrem(keys.failed, jobId),
    redis.zrem(keys.ready, jobId),
    redis.zrem(keys.delayed, jobId),
  ]);
}

export async function getQueueDepth(queueNamespace = DEFAULT_QUEUE_NAMESPACE) {
  const redis = createQueueRedis();
  const keys = getQueueKeys(queueNamespace);
  const [ready, delayed, failed, active] = await Promise.all([
    redis.zcard(keys.ready),
    redis.zcard(keys.delayed),
    redis.zcard(keys.failed),
    redis.zcard(keys.active),
  ]);

  return {
    queue: keys.queue,
    ready,
    delayed,
    active,
    failed,
    total: ready + delayed,
  };
}
