import { runQueueWorker } from "../src/lib/queue/worker";
import { getRedisClient, disconnectRedis } from "../src/lib/redis/client";

const namespace = process.argv[2];
if (!namespace) throw new Error("namespace is required");
const controller = new AbortController();
process.on("SIGTERM", () => controller.abort());
process.on("SIGINT", () => controller.abort());

runQueueWorker(async (job) => {
  if (job.type !== "TEST") throw new Error("UNKNOWN_TEST_JOB");
  const key = "daira:test:parallel:" + namespace + ":" + (job.orderingKey || job.id);
  const redis = getRedisClient();
  const active = Number(await redis.incr(key));
  await redis.expire(key, 90);
  try {
    if (active > 1) throw new Error("SAME_CONVERSATION_EXECUTED_CONCURRENTLY:" + key);
    await new Promise(resolve => setTimeout(resolve, 15));
  } finally {
    await redis.decr(key);
  }
}, {
  queueNamespace: namespace,
  concurrency: 6,
  pollIntervalMs: 80,
  workerId: "ci-process-" + process.pid,
  signal: controller.signal,
}).then(async () => { await disconnectRedis(); }).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
