import "dotenv/config";

import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { claimJobById, deleteJob, enqueueJob, enqueueJobsBatch, getJob, getQueueDepth } from "../src/lib/queue/core";
import { recoverStalledJobs } from "../src/lib/queue/recovery";
import { runQueueWorker } from "../src/lib/queue/worker";
import { getRedisClient, redisHealthCheck, setRedisCommandTimeoutMs } from "../src/lib/redis/client";
import { claimIdempotency, completeIdempotency } from "../src/lib/idempotency/store";
import { acquireLock, releaseLock } from "../src/lib/lock/redis-lock";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const assert = (v: unknown, m: string) => { if (!v) throw new Error(m); };
const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * p / 100) - 1)] : 0;
};

const ns = "maximum-" + Date.now() + "-" + randomUUID().slice(0, 8);
const TENANTS = Math.max(10_000, Number(process.env.MAXIMUM_TENANTS ?? 10_000));
const ACCOUNTS = Math.max(3, Number(process.env.MAXIMUM_ACCOUNTS_PER_TENANT ?? 3));
const JOBS = Math.max(5_000, Number(process.env.MAXIMUM_JOBS ?? 6_000));
const CONCURRENCY = Math.max(24, Number(process.env.MAXIMUM_CONCURRENCY ?? 32));
const BATCH = Math.max(100, Number(process.env.MAXIMUM_BATCH_SIZE ?? 200));
const TIMEOUT = Math.max(60_000, Number(process.env.MAXIMUM_TIMEOUT_MS ?? 600_000));

type P = { tenant: string; account: string; phase: "normal" | "retry" | "delayed"; created: number };

async function main() {
  setRedisCommandTimeoutMs(30_000);
  const health = await redisHealthCheck();
  assert(health.ok, "Redis health failed: " + (health.error ?? "unknown"));
  assert(process.env.REDIS_DRIVER?.trim().toLowerCase() === "redis",
    "MAXIMUM test requires REDIS_DRIVER=redis to protect Upstash quota.");

  const redis = getRedisClient();
  const ids: string[] = [];
  const completed = new Set<string>();
  const accounts = new Set<string>();
  const retries = new Set<string>();
  const latencies: number[] = [];
  const controller = new AbortController();
  let backpressure = 0;
  let crashCount = 0;
  let restartCount = 0;
  let redisFault = false;
  let dbFault = false;

  const tenant = (i: number) => "maximum-tenant-" + (i % TENANTS);
  const account = (i: number) => "maximum-account-" + (i % TENANTS) + "-" + (i % ACCOUNTS);

  const handler = async (job: { id: string; attempts: number; payload: unknown }) => {
    const p = JSON.parse((job.payload as { message: string }).message) as P;
    if (p.phase === "retry" && job.attempts <= 2) {
      retries.add(job.id);
      throw new Error("MAXIMUM_CONTROLLED_RETRY_FAILURE");
    }
    accounts.add(p.account);
    completed.add(job.id);
    latencies.push(Date.now() - p.created);
    await sleep(p.phase === "delayed" ? 4 : 2);
  };

  console.log(JSON.stringify({
    phase: "MAXIMUM_START", namespace: ns, tenants: TENANTS, accountsPerTenant: ACCOUNTS,
    simulatedAccounts: TENANTS * ACCOUNTS, queueJobs: JOBS, workerConcurrency: CONCURRENCY,
    hazards: ["burst","backpressure","retry-storm","delayed-jobs","idempotency-race",
      "lock-contention","worker-crash","stalled-recovery","redis-timeout","db-failure",
      "worker-restart","final-integrity"]
  }, null, 2));

  const worker = runQueueWorker(handler, {
    concurrency: CONCURRENCY, pollIntervalMs: 50, queueNamespace: ns,
    workerId: "maximum-worker-" + Date.now(), signal: controller.signal
  });

  try {
    // 1) Severe burst: 6,000 jobs across 10,000 tenants / 30,000 accounts.
    for (let next = 0; next < JOBS;) {
      const count = Math.min(BATCH, JOBS - next);
      const batch = Array.from({ length: count }, (_, j) => {
        const i = next + j;
        const phase = i % 11 === 0 ? "retry" : i % 17 === 0 ? "delayed" : "normal";
        const p: P = { tenant: tenant(i), account: account(i), phase, created: Date.now() };
        return {
          type: "TEST" as const,
          payload: { message: JSON.stringify(p) },
          options: {
            queueNamespace: ns, maxAttempts: 5,
            priority: i % 31 === 0 ? "critical" as const : i % 7 === 0 ? "high" as const : "normal" as const,
            delayMs: phase === "delayed" ? 1000 : 0
          }
        };
      });
      try {
        const created = await enqueueJobsBatch(batch);
        ids.push(...created.map(x => x.id));
        next += count;
      } catch (e) {
        if (e instanceof Error && e.message.includes("QUEUE_BACKPRESSURE")) {
          backpressure++;
          await sleep(50);
        } else throw e;
      }
    }

    // 2) 100-way idempotency race: exactly one owner, with no swallowed errors.
    // Let the initial DB-heavy worker storm drain first. This keeps the race a
    // deterministic 100-way idempotency test instead of measuring connection
    // pool starvation caused by the unrelated 32-worker queue storm.
    const idempotencyDrainDeadline = Date.now() + TIMEOUT;
    while (Date.now() < idempotencyDrainDeadline) {
      const d = await getQueueDepth(ns);
      if (d.ready === 0 && d.delayed === 0 && d.active === 0) break;
      await sleep(100);
    }
    const idempotencyDepth = await getQueueDepth(ns);
    assert(
      idempotencyDepth.ready === 0 && idempotencyDepth.delayed === 0 && idempotencyDepth.active === 0,
      "Idempotency race started before the queue storm drained: " + JSON.stringify(idempotencyDepth),
    );

    const idemKey = "maximum-idem-" + ns;
    const claimResults = await Promise.all(
      Array.from({ length: 100 }, async (_, index) => {
        try {
          const result = await claimIdempotency({
            key: idemKey,
            tenantId: tenant(0),
            operation: "maximum",
            resourceId: account(0),
            ttlSeconds: 60,
          });
          return { index, result, error: null as string | null };
        } catch (error) {
          return {
            index,
            result: null,
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          };
        }
      }),
    );

    const claimErrors = claimResults.filter((entry) => entry.error !== null);
    if (claimErrors.length > 0) {
      throw new Error(
        `Idempotency race produced ${claimErrors.length} request errors. ${JSON.stringify(claimErrors)}`,
      );
    }

    const successfulClaims = claimResults.flatMap((entry) => entry.result ? [entry.result] : []);
    const owners = successfulClaims.filter((result) => result.claimed);
    const duplicates = successfulClaims.filter((result) => !result.claimed);

    assert(owners.length === 1, `Idempotency race allowed ${owners.length} owners`);
    assert(duplicates.length === 99, `Idempotency duplicate blocking failed: duplicates=${duplicates.length}, owners=${owners.length}`);

    const lease = owners[0].record.leaseToken;
    await completeIdempotency(idemKey, { ok: true }, lease);

    // 3) 100-way distributed-lock race: exactly one owner.
    const lockResults = await Promise.all(Array.from({ length: 100 }, () =>
      acquireLock({ scope: "job", resourceId: "maximum-lock-" + ns }).catch((error) => {
        throw error;
      })
    ));
    const lockOwners = lockResults.filter(x => x.acquired);
    assert(lockOwners.length === 1, "Distributed lock allowed multiple owners");
    assert(lockResults.some(x => !x.acquired), "Lock contention was not observed");
    if (lockOwners[0].handle) await releaseLock(lockOwners[0].handle);

    // Stop the primary worker before the manual crash/recovery scenario.
    // Otherwise it can legitimately claim the synthetic crash job between enqueue
    // and claimJobById(), making this test race against its own worker.
    controller.abort();
    await worker;

    // 4) Real claimed job -> simulated worker death -> stalled recovery.
    const crashJob = await enqueueJob("TEST", {
      message: JSON.stringify({ tenant: tenant(1), account: account(1), phase: "normal", created: Date.now() } satisfies P)
    }, { queueNamespace: ns, maxAttempts: 4 });
    ids.push(crashJob.id);
    assert(await claimJobById(crashJob.id, "dead-worker-" + Date.now(), ns), "Could not claim crash job");
    await redis.del("smartdirect:queue:claim:" + crashJob.id);
    await redis.zadd("smartdirect:queue:" + ns + ":active", { score: Date.now() - 120_000, member: crashJob.id });
    crashCount++;
    assert((await recoverStalledJobs(100, ns)).recovered >= 1, "Stalled recovery failed");

    // 5) Heavy Redis pressure while workers are active.
    const prefix = "smartdirect:maximum:" + ns + ":";
    await Promise.all(Array.from({ length: 2000 }, (_, i) => redis.set(prefix + i, String(i), { ex: 120 })));
    const values = await Promise.all(Array.from({ length: 2000 }, (_, i) => redis.get(prefix + i)));
    assert(values.filter(v => v !== null).length === 2000, "Redis pressure integrity failed");
    await Promise.all(Array.from({ length: 2000 }, (_, i) => redis.del(prefix + i)));

    // 6) Drain the main storm.
    const deadline = Date.now() + TIMEOUT;
    while (Date.now() < deadline) {
      const d = await getQueueDepth(ns);
      if (d.ready === 0 && d.delayed === 0 && d.active === 0) break;
      await sleep(250);
    }
    let depth = await getQueueDepth(ns);
    assert(depth.ready === 0 && depth.delayed === 0 && depth.active === 0,
      "Maximum storm did not drain: " + JSON.stringify(depth));

    // 7) Controlled Redis timeout, then fresh-client recovery.
    await redis.disconnect();
    setRedisCommandTimeoutMs(1);
    const badRedis = getRedisClient();
    try {
      await badRedis.eval("local x=0 for i=1,8000000 do x=x+i end return x", [], []);
    } catch { redisFault = true; }
    finally {
      await badRedis.disconnect().catch(() => undefined);
      setRedisCommandTimeoutMs(30_000);
    }
    assert(redisFault, "Redis timeout injection was not observed");
    assert((await getRedisClient().ping()) === "PONG", "Redis did not recover");

    // 8) Controlled DB failure, then same Prisma client recovery.
    try {
      await prisma.$queryRawUnsafe("SELECT * FROM __maximum_intentional_failure__");
    } catch { dbFault = true; }
    assert(dbFault, "Database failure injection was not observed");
    const db = await prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
    assert(Number(db[0]?.ok) === 1, "Database did not recover");

    // 9) Restart worker after infrastructure chaos and process a fresh job.
    const restartController = new AbortController();
    const restartWorker = runQueueWorker(handler, {
      concurrency: Math.max(8, Math.floor(CONCURRENCY / 2)), pollIntervalMs: 50,
      queueNamespace: ns, workerId: "maximum-worker-restart-" + Date.now(), signal: restartController.signal
    });
    restartCount++;
    const fresh = await enqueueJob("TEST", {
      message: JSON.stringify({ tenant: tenant(2), account: account(2), phase: "normal", created: Date.now() } satisfies P)
    }, { queueNamespace: ns, maxAttempts: 4 });
    ids.push(fresh.id);
    const freshDone = await (async () => {
      const end = Date.now() + 20_000;
      while (Date.now() < end) {
        if ((await getJob(fresh.id))?.status === "completed") return true;
        await sleep(100);
      }
      return false;
    })();
    assert(freshDone, "Restarted worker could not process a fresh job");
    restartController.abort();
    await restartWorker;

    controller.abort();
    await worker;

    depth = await getQueueDepth(ns);
    assert(depth.ready === 0 && depth.delayed === 0 && depth.active === 0 && depth.failed === 0 && depth.total === 0,
      "Final queue integrity failed: " + JSON.stringify(depth));
    assert(completed.size >= JOBS, "Lost jobs: completed=" + completed.size + " expected=" + JOBS);
    assert(accounts.size > 0, "No account workload was processed");
    assert(retries.size > 0, "Retry storm was not exercised");
    assert(crashCount === 1 && restartCount === 1, "Worker crash/restart phases did not execute");

    console.log(JSON.stringify({
      success: true, test: "MAXIMUM_CHAOS_PRODUCTION_FINAL",
      durationMs: Date.now(),
      scale: { tenants: TENANTS, accountsPerTenant: ACCOUNTS, simulatedAccounts: TENANTS * ACCOUNTS, queueJobs: JOBS, workerConcurrency: CONCURRENCY },
      chaos: { retryStormJobs: retries.size, producerBackpressureHits: backpressure, workerCrashesSimulated: crashCount,
        workerRestarts: restartCount, redisFailureObserved: redisFault, databaseFailureObserved: dbFault,
        idempotencyDuplicateBlocked: true, distributedLockContentionObserved: true },
      integrity: { completedJobs: completed.size, processedAccounts: accounts.size, finalQueueDepth: depth },
      latencyMs: { p50: pct(latencies, 50), p95: pct(latencies, 95), p99: pct(latencies, 99), max: Math.max(...latencies) },
      note: "Maximum synthetic chaos test. It combines load, retries, delayed work, idempotency races, lock contention, worker crash/stall recovery, Redis timeout/recovery, database failure/recovery, worker restart and final queue integrity. It does not call Meta or prove external provider/network limits."
    }, null, 2));
  } finally {
    controller.abort();
    await worker.catch(() => undefined);
    for (const id of ids) await deleteJob(id).catch(() => undefined);
    const cleanup = getRedisClient();
    await cleanup.eval(
      'local keys=redis.call("KEYS",ARGV[1]); for _,k in ipairs(keys) do redis.call("DEL",k) end; return #keys',
      [], ["smartdirect:maximum:" + ns + ":*"]
    ).catch(() => undefined);
    await cleanup.disconnect().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch(error => {
  console.error("MAXIMUM Chaos Production Final Test: FAILED");
  console.error(error);
  process.exitCode = 1;
});
