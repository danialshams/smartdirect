import { createQueueRedis } from "@/lib/queue/core";

const WORKER_PREFIX = "smartdirect:monitoring:worker:";
const WORKER_TTL_SECONDS = Math.max(
  15,
  Number(process.env.WORKER_HEARTBEAT_TTL_SECONDS ?? 30),
);

export type WorkerHeartbeat = {
  workerId: string;
  pid?: number;
  hostname?: string;
  startedAt: number;
  lastHeartbeatAt: number;
};

function workerKey(workerId: string) {
  return `${WORKER_PREFIX}${workerId}`;
}

export async function writeWorkerHeartbeat(
  workerId: string,
  input: { pid?: number; hostname?: string; startedAt: number },
) {
  const redis = createQueueRedis();
  const now = Date.now();
  const heartbeat: WorkerHeartbeat = {
    workerId,
    pid: input.pid,
    hostname: input.hostname,
    startedAt: input.startedAt,
    lastHeartbeatAt: now,
  };

  await redis.set(workerKey(workerId), heartbeat, {
    ex: WORKER_TTL_SECONDS,
  });

  return heartbeat;
}

export async function removeWorkerHeartbeat(workerId: string) {
  const redis = createQueueRedis();
  await redis.del(workerKey(workerId));
}

export async function getWorkerHeartbeats(): Promise<WorkerHeartbeat[]> {
  const redis = createQueueRedis();
  const keys: string[] = [];
  let cursor = 0;

  do {
    const result = await redis.scan(cursor, {
      match: `${WORKER_PREFIX}*`,
      count: 100,
    });
    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);

  if (!keys.length) return [];

  const values = await Promise.all(
    keys.map((key) => redis.get<WorkerHeartbeat>(key)),
  );

  return values.filter(
    (value): value is WorkerHeartbeat =>
      Boolean(value?.workerId && value.lastHeartbeatAt),
  );
}

export function startWorkerHeartbeat(
  workerId: string,
  input: { pid?: number; hostname?: string },
) {
  const startedAt = Date.now();
  const intervalMs = Math.max(
    5_000,
    Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 10_000),
  );

  let stopped = false;

  const beat = async () => {
    if (stopped) return;

    try {
      await writeWorkerHeartbeat(workerId, {
        ...input,
        startedAt,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "monitoring:worker-heartbeat-failed",
          workerId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  void beat();
  const timer = setInterval(() => void beat(), intervalMs);

  return async () => {
    stopped = true;
    clearInterval(timer);
    try {
      await removeWorkerHeartbeat(workerId);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "monitoring:worker-heartbeat-remove-failed",
          workerId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };
}
