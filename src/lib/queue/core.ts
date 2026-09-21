import { Redis } from "@upstash/redis";

import type {
  EnqueueJobOptions,
  QueueJob,
  QueueJobPayload,
  QueueJobPriority,
  QueueJobType,
} from "./types";

const QUEUE_NAME = "default";
const JOB_PREFIX = "smartdirect:queue:job:";
const READY_KEY = "smartdirect:queue:default:ready";
const DELAYED_KEY = "smartdirect:queue:default:delayed";
const CLAIM_PREFIX = "smartdirect:queue:claim:";
const CLAIM_TTL_SECONDS = 30;

const PRIORITY_WEIGHT: Record<QueueJobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured",
    );
  }

  return { url, token };
}

export function createQueueRedis() {
  const { url, token } = getRedisConfig();
  return new Redis({ url, token });
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
  };

  await redis.set(jobKey(job.id), job);

  if (delayMs > 0) {
    await redis.zadd(DELAYED_KEY, {
      score: job.scheduledAt,
      member: job.id,
    });
  } else {
    await redis.zadd(READY_KEY, {
      score: readyScore(job),
      member: job.id,
    });
  }

  return job;
}

export async function promoteDueJobs(limit = 50) {
  const redis = createQueueRedis();
  const now = Date.now();

  const ids = await redis.zrange<string[]>(
    DELAYED_KEY,
    0,
    now,
    { byScore: true, offset: 0, count: limit },
  );

  let promoted = 0;

  for (const id of ids) {
    const job = await redis.get<QueueJob>(jobKey(id));

    if (!job) {
      await redis.zrem(DELAYED_KEY, id);
      continue;
    }

    if (job.status !== "delayed" || job.scheduledAt > now) {
      if (job.status !== "delayed") {
        await redis.zrem(DELAYED_KEY, id);
      }
      continue;
    }

    job.status = "waiting";
    await redis.set(jobKey(id), job);
    await redis.zrem(DELAYED_KEY, id);
    await redis.zadd(READY_KEY, {
      score: readyScore(job),
      member: id,
    });
    promoted++;
  }

  return promoted;
}

export async function claimNextJob(
  workerId = "unknown",
): Promise<QueueJob | null> {
  const redis = createQueueRedis();
  await promoteDueJobs();

  const ids = await redis.zrange<string[]>(READY_KEY, 0, 0);

  if (!ids.length) {
    return null;
  }

  const id = ids[0];
  const claim = await redis.set(
    claimKey(id),
    workerId,
    { nx: true, ex: CLAIM_TTL_SECONDS },
  );

  if (claim !== "OK") {
    return null;
  }

  const job = await redis.get<QueueJob>(jobKey(id));

  if (!job) {
    await redis.zrem(READY_KEY, id);
    return null;
  }

  if (job.status !== "waiting") {
    await redis.zrem(READY_KEY, id);
    return null;
  }

  job.status = "active";
  job.attempts += 1;
  job.workerId = workerId;

  await redis.set(jobKey(id), job);
  await redis.zrem(READY_KEY, id);

  return job;
}

async function removeJobFromQueue(redis: Redis, jobId: string) {
  await Promise.all([
    redis.zrem(READY_KEY, jobId),
    redis.zrem(DELAYED_KEY, jobId),
  ]);
}

export async function completeJob(jobId: string) {
  const redis = createQueueRedis();
  const job = await redis.get<QueueJob>(jobKey(jobId));

  if (!job) return null;

  job.status = "completed";
  job.workerId = undefined;

  await Promise.all([
    redis.set(jobKey(jobId), job),
    removeJobFromQueue(redis, jobId),
  ]);

  return job;
}

export async function failJob(jobId: string, error: unknown) {
  const redis = createQueueRedis();
  const job = await redis.get<QueueJob>(jobKey(jobId));

  if (!job) return null;

  job.status = "failed";
  job.lastError = error instanceof Error ? error.message : String(error);
  job.workerId = undefined;

  await Promise.all([
    redis.set(jobKey(jobId), job),
    removeJobFromQueue(redis, jobId),
  ]);

  return job;
}

export async function getJob(jobId: string) {
  const redis = createQueueRedis();
  return redis.get<QueueJob>(jobKey(jobId));
}

export async function deleteJob(jobId: string) {
  const redis = createQueueRedis();
  await Promise.all([
    redis.del(jobKey(jobId)),
    redis.del(claimKey(jobId)),
    redis.zrem(READY_KEY, jobId),
    redis.zrem(DELAYED_KEY, jobId),
  ]);
}

export async function getQueueDepth() {
  const redis = createQueueRedis();
  const [ready, delayed] = await Promise.all([
    redis.zcard(READY_KEY),
    redis.zcard(DELAYED_KEY),
  ]);

  return {
    queue: QUEUE_NAME,
    ready,
    delayed,
    total: ready + delayed,
  };
}
