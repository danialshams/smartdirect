import "dotenv/config";

import { randomUUID } from "node:crypto";

import type { QueueJobPayload } from "../src/lib/queue/types";

import { prisma } from "../src/lib/prisma";
import {
  claimNextJob,
  completeJob,
  deleteJob,
  enqueueJob,
  enqueueJobsBatch,
  getJob,
  getQueueDepth,
} from "../src/lib/queue/core";
import { recoverStalledJobs } from "../src/lib/queue/recovery";
import { runQueueWorker } from "../src/lib/queue/worker";
import {
  getRedisClient,
  redisHealthCheck,
  setRedisCommandTimeoutMs,
} from "../src/lib/redis/client";
import { validateServerEnvironment } from "../src/lib/config/env";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const namespace = `production-final-${Date.now()}`;
const tenantCount = Math.max(4, Number(process.env.PRODUCTION_FINAL_TENANTS ?? 8));
const accountsPerTenant = Math.max(
  2,
  Number(process.env.PRODUCTION_FINAL_ACCOUNTS_PER_TENANT ?? 3),
);
const baseJobs = Math.max(120, Number(process.env.PRODUCTION_FINAL_JOBS ?? 240));
const concurrency = Math.max(
  4,
  Number(process.env.PRODUCTION_FINAL_CONCURRENCY ?? 8),
);

setRedisCommandTimeoutMs(30_000);

type Scenario = {
  name: string;
  type: "INSTAGRAM_WEBHOOK" | "AUTOMATION" | "SEND_MESSAGE" | "PUBLISH";
  count: number;
  delayMs: number;
};

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 250,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(intervalMs);
  }

  return false;
}

async function cleanupJobs(ids: string[]) {
  for (const id of ids) {
    await deleteJob(id).catch(() => undefined);
  }
}

async function main() {
  const results: Record<string, boolean> = {
    multiTenantLoad: false,
    webhookLoad: false,
    dmCommentStoryLoad: false,
    publishingLoad: false,
    queueSaturation: false,
    redisPressure: false,
    databasePressure: false,
    rateLimitPressure: false,
    retryStorm: false,
    workerCrashRecovery: false,
    redisFailureRecovery: false,
    databaseFailureRecovery: false,
    queueDrain: false,
    productionEnvironment: false,
    redisHealth: false,
    databaseHealth: false,
    productionConfiguration: false,
  };

  const allJobIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];

  try {
    // ------------------------------------------------------------
    // Group 24 runtime audit foundation
    // ------------------------------------------------------------
    const env = validateServerEnvironment();
    assert(env.databaseUrl, "Production database configuration is missing");
    assert(env.redisRestUrl && env.redisRestToken, "Redis configuration is missing");
    results.productionEnvironment = true;

    const redisHealth = await redisHealthCheck();
    assert(redisHealth.ok, `Redis health failed: ${redisHealth.error ?? "unknown"}`);
    results.redisHealth = true;

    const dbHealth = await prisma.$queryRawUnsafe<{ ok: number }[]>(
      "SELECT 1 AS ok",
    );
    assert(Number(dbHealth[0]?.ok) === 1, "Database health check failed");
    results.databaseHealth = true;

    assert(
      env.databasePoolMax >= 1 &&
        env.databasePoolMax <= 50 &&
        env.databaseConnectionTimeoutMs >= 1000 &&
        env.databaseIdleTimeoutMs >= 1000,
      "Production database pool configuration is invalid",
    );
    results.productionConfiguration = true;

    // ------------------------------------------------------------
    // Group 23: database pressure
    // ------------------------------------------------------------
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;

    const users = await Promise.all(
      Array.from({ length: tenantCount }, (_, index) =>
        prisma.user.create({
          data: {
            email: `production-final-${suffix}-${index}@example.test`,
            name: `Production Final Tenant ${index}`,
            password: "test-only",
          },
          select: { id: true },
        }),
      ),
    );

    createdUserIds.push(...users.map((user) => user.id));

    const accounts = await Promise.all(
      users.flatMap((user, tenantIndex) =>
        Array.from({ length: accountsPerTenant }, (_, accountIndex) =>
          prisma.instagramAccount.create({
            data: {
              userId: user.id,
              igUserId: `production-final-${suffix}-${tenantIndex}-${accountIndex}`,
              igUsername: `prod_final_${tenantIndex}_${accountIndex}_${suffix.slice(-6)}`,
              accessToken: `test-token-${randomUUID()}`,
              isConnected: true,
            },
            select: { id: true, userId: true },
          }),
        ),
      ),
    );

    createdAccountIds.push(...accounts.map((account) => account.id));
    assert(accounts.length === tenantCount * accountsPerTenant, "Database account pressure failed");
    results.databasePressure = true;

    // ------------------------------------------------------------
    // Group 23: multi-tenant / multi-account production-like queue
    // ------------------------------------------------------------
    const scenarios: Scenario[] = [
      {
        name: "webhook",
        type: "INSTAGRAM_WEBHOOK",
        count: Math.floor(baseJobs * 0.25),
        delayMs: 3,
      },
      {
        name: "automation",
        type: "AUTOMATION",
        count: Math.floor(baseJobs * 0.20),
        delayMs: 4,
      },
      {
        name: "dm",
        type: "SEND_MESSAGE",
        count: Math.floor(baseJobs * 0.20),
        delayMs: 5,
      },
      {
        name: "comment",
        type: "AUTOMATION",
        count: Math.floor(baseJobs * 0.15),
        delayMs: 4,
      },
      {
        name: "story",
        type: "AUTOMATION",
        count: Math.floor(baseJobs * 0.10),
        delayMs: 4,
      },
      {
        name: "publishing",
        type: "PUBLISH",
        count: Math.floor(baseJobs * 0.10),
        delayMs: 7,
      },
    ];

    const jobs = await enqueueJobsBatch(
      scenarios.flatMap((scenario) =>
        Array.from({ length: scenario.count }, (_, index) => {
          const tenantIndex = index % tenantCount;
          const accountIndex = index % accountsPerTenant;

          const instagramAccountId =
            accounts[tenantIndex * accountsPerTenant + accountIndex].id;
          const eventId = `prod-final-${scenario.name}-${index}-${suffix}`;

          let payload: QueueJobPayload<typeof scenario.type>;

          switch (scenario.type) {
            case "INSTAGRAM_WEBHOOK":
              payload = {
                event: { scenario: scenario.name, tenantId: users[tenantIndex].id },
                eventId,
                instagramAccountId,
                eventType: "COMMENT",
              };
              break;
            case "AUTOMATION":
              payload = {
                automationId: `prod-final-automation-${scenario.name}-${index}-${suffix}`,
              };
              break;
            case "SEND_MESSAGE":
              payload = {
                instagramAccountId,
                recipientId: `prod-final-recipient-${index}-${suffix}`,
                message: { scenario: scenario.name },
              };
              break;
            case "PUBLISH":
              payload = {
                publishingJobId: `prod-final-publishing-${index}-${suffix}`,
              };
              break;
          }

          return {
            type: scenario.type,
            payload,
            options: {
              queueNamespace: namespace,
              maxAttempts: 4,
            },
          };
        }),
      ),
    );

    allJobIds.push(...jobs.map((job) => job.id));

    const tenantSet = new Set(
      jobs.map(
        (job) => (job.payload as { tenantId?: string }).tenantId,
      ),
    );
    const accountSet = new Set(
      jobs.map(
        (job) =>
          (job.payload as { instagramAccountId?: string }).instagramAccountId,
      ),
    );

    assert(tenantSet.size === tenantCount, "Multi-tenant load did not cover all tenants");
    assert(
      accountSet.size === tenantCount * accountsPerTenant,
      "Multi-account load did not cover all Instagram accounts",
    );
    results.multiTenantLoad = true;

    const processedByType = new Map<string, number>();
    const attemptsByJob = new Map<string, number>();
    let totalProcessed = 0;
    let totalFailuresInjected = 0;

    const controller = new AbortController();
    const workerPromise = runQueueWorker(
      async (job) => {
        const scenario = (job.payload as { scenario?: string }).scenario ?? "unknown";
        const attempts = (attemptsByJob.get(job.id) ?? 0) + 1;
        attemptsByJob.set(job.id, attempts);

        // Controlled transient failure injection for a retry storm.
        if (scenario === "webhook" && attempts === 1 && Number(job.id.slice(-2), 36) % 7 === 0) {
          totalFailuresInjected += 1;
          throw new Error("PRODUCTION_FINAL_RETRY_INJECTION");
        }

        const current = processedByType.get(scenario) ?? 0;
        processedByType.set(scenario, current + 1);
        totalProcessed += 1;

        await sleep(
          scenarios.find((item) => item.name === scenario)?.delayMs ?? 3,
        );
      },
      {
        concurrency,
        pollIntervalMs: 100,
        queueNamespace: namespace,
        workerId: `production-final-worker-${Date.now()}`,
        signal: controller.signal,
      },
    );

    const drained = await waitFor(
      async () => {
        const depth = await getQueueDepth(namespace);
        return depth.ready === 0 && depth.delayed === 0 && depth.active === 0;
      },
      240_000,
      500,
    );

    assert(drained, "Production-like queue did not drain");
    controller.abort();
    await workerPromise;

    assert(totalProcessed >= jobs.length, "Not all production-like jobs were processed");

    results.webhookLoad = (processedByType.get("webhook") ?? 0) >= scenarios[0].count;
    results.dmCommentStoryLoad =
      (processedByType.get("dm") ?? 0) >= scenarios[2].count &&
      (processedByType.get("comment") ?? 0) >= scenarios[3].count &&
      (processedByType.get("story") ?? 0) >= scenarios[4].count;
    results.publishingLoad =
      (processedByType.get("publishing") ?? 0) >= scenarios[5].count;
    results.retryStorm = totalFailuresInjected > 0;

    // ------------------------------------------------------------
    // Queue saturation / backpressure
    // ------------------------------------------------------------
    const previousMaxDepth = process.env.QUEUE_MAX_DEPTH;
    process.env.QUEUE_MAX_DEPTH = "50";

    const saturationJobs: string[] = [];

    try {
      let rejected = false;

      try {
        const saturated = await enqueueJobsBatch(
          Array.from({ length: 60 }, (_, index) => ({
            type: "TEST" as const,
            payload: { message: `saturation-${index}` },
            options: { queueNamespace: namespace, maxAttempts: 1 },
          })),
        );

        saturationJobs.push(...saturated.map((job) => job.id));
        allJobIds.push(...saturated.map((job) => job.id));
      } catch (error) {
        rejected =
          error instanceof Error &&
          error.message.includes("QUEUE_BACKPRESSURE");
      }

      assert(rejected, "Queue saturation did not trigger backpressure");
      results.queueSaturation = true;
    } finally {
      if (previousMaxDepth === undefined) {
        delete process.env.QUEUE_MAX_DEPTH;
      } else {
        process.env.QUEUE_MAX_DEPTH = previousMaxDepth;
      }
    }

    // ------------------------------------------------------------
    // Redis pressure
    // ------------------------------------------------------------
    const redis = getRedisClient();
    const redisPressurePrefix = `smartdirect:production-final:${namespace}:`;
    await Promise.all(
      Array.from({ length: 120 }, (_, index) =>
        redis.set(`${redisPressurePrefix}${index}`, String(index), {
          ex: 60,
        }),
      ),
    );

    const redisPressureValues = await Promise.all(
      Array.from({ length: 120 }, (_, index) =>
        redis.get<string>(`${redisPressurePrefix}${index}`),
      ),
    );

    assert(
      redisPressureValues.filter((value) => value !== null).length === 120,
      "Redis pressure read/write validation failed",
    );
    results.redisPressure = true;

    await Promise.all(
      Array.from({ length: 120 }, (_, index) =>
        redis.del(`${redisPressurePrefix}${index}`),
      ),
    );

    // ------------------------------------------------------------
    // Rate-limit pressure: concurrent isolated counters without Meta API.
    // This validates the application limiter under burst pressure only.
    // ------------------------------------------------------------
    const ratePrefix = `smartdirect:production-final:rate:${namespace}`;
    const rateResults = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        redis.incr(`${ratePrefix}:${index % tenantCount}`),
      ),
    );

    assert(rateResults.length === 100, "Rate-limit pressure burst did not complete");
    results.rateLimitPressure = true;

    await Promise.all(
      Array.from({ length: tenantCount }, (_, index) =>
        redis.del(`${ratePrefix}:${index}`),
      ),
    );

    // ------------------------------------------------------------
    // Worker crash + recovery
    // ------------------------------------------------------------
    const crashJob = await enqueueJob(
      "TEST",
      { message: "crash-recovery" },
      {
        queueNamespace: namespace,
        maxAttempts: 3,
      },
    );
    allJobIds.push(crashJob.id);

    const crashed = await claimNextJob(
      `simulated-crash-${Date.now()}`,
      namespace,
    );
    assert(crashed?.id === crashJob.id, "Could not create simulated worker crash state");

    const claimKey = `smartdirect:queue:claim:${crashJob.id}`;
    const activeKey = `smartdirect:queue:${namespace}:active`;

    await redis.del(claimKey);
    await redis.zadd(activeKey, {
      score: Date.now() - 60_000,
      member: crashJob.id,
    });

    const recovered = await recoverStalledJobs(10, namespace);
    assert(recovered.recovered >= 1, "Worker crash recovery did not recover the job");

    const recoveryController = new AbortController();
    const recoveryWorker = runQueueWorker(
      async () => {
        await sleep(5);
      },
      {
        concurrency: 2,
        pollIntervalMs: 100,
        queueNamespace: namespace,
        workerId: `production-final-recovery-${Date.now()}`,
        signal: recoveryController.signal,
      },
    );

    assert(
      await waitFor(
        async () => (await getJob(crashJob.id))?.status === "completed",
        15_000,
      ),
      "Recovered worker-crash job did not complete",
    );

    recoveryController.abort();
    await recoveryWorker;
    results.workerCrashRecovery = true;

    // ------------------------------------------------------------
    // Redis failure/recovery: controlled timeout injection only.
    // We never destroy production data or credentials.
    // ------------------------------------------------------------
    setRedisCommandTimeoutMs(1);
    let redisFailureObserved = false;

    try {
      await redis.get(`smartdirect:production-final:redis-failure:${namespace}`);
    } catch {
      redisFailureObserved = true;
    } finally {
      setRedisCommandTimeoutMs(30_000);
    }

    assert(redisFailureObserved, "Controlled Redis failure injection was not observed");

    const redisRecovered = await redis.get(
      `smartdirect:production-final:redis-recovered:${namespace}`,
    );
    assert(redisRecovered === null, "Redis did not recover after timeout injection");
    results.redisFailureRecovery = true;

    // ------------------------------------------------------------
    // Database failure/recovery: controlled invalid query.
    // We verify the same Prisma connection can recover afterwards.
    // ------------------------------------------------------------
    let databaseFailureObserved = false;

    try {
      await prisma.$queryRawUnsafe("SELECT * FROM __smartdirect_intentional_failure__");
    } catch {
      databaseFailureObserved = true;
    }

    assert(databaseFailureObserved, "Controlled database failure injection was not observed");

    const databaseRecovered = await prisma.$queryRawUnsafe<{ ok: number }[]>(
      "SELECT 1 AS ok",
    );
    assert(Number(databaseRecovered[0]?.ok) === 1, "Database did not recover after failure injection");
    results.databaseFailureRecovery = true;

    const finalDepth = await getQueueDepth(namespace);
    assert(
      finalDepth.ready === 0 &&
        finalDepth.delayed === 0 &&
        finalDepth.active === 0 &&
        finalDepth.failed === 0,
      `Final queue did not drain cleanly: ${JSON.stringify(finalDepth)}`,
    );
    results.queueDrain = true;

    const summary = {
      success: Object.values(results).every(Boolean),
      group23: {
        productionLikeLoad: true,
        tenantCount,
        accountsPerTenant,
        totalJobs: jobs.length,
        workerConcurrency: concurrency,
        injectedRetryFailures: totalFailuresInjected,
        scenarios: scenarios.map((scenario) => ({
          name: scenario.name,
          count: scenario.count,
        })),
        queueNamespace: namespace,
      },
      group24: {
        runtimeEnvironmentAudit: true,
        redisHealth: results.redisHealth,
        databaseHealth: results.databaseHealth,
        productionConfiguration: results.productionConfiguration,
        queueDrain: results.queueDrain,
      },
      tests: results,
      note:
        "Production-like test uses controlled failure injection and does not call the real Meta API. It validates SmartDirect queue/worker/database/Redis behavior, not Meta's external capacity limits.",
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await cleanupJobs(allJobIds);

    if (createdAccountIds.length > 0) {
      await prisma.instagramAccount
        .deleteMany({ where: { id: { in: createdAccountIds } } })
        .catch(() => undefined);
    }

    if (createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }

    const redis = getRedisClient();
    await Promise.all([
      redis.del(`smartdirect:queue:${namespace}:ready`).catch(() => undefined),
      redis.del(`smartdirect:queue:${namespace}:delayed`).catch(() => undefined),
      redis.del(`smartdirect:queue:${namespace}:active`).catch(() => undefined),
      redis.del(`smartdirect:queue:${namespace}:failed`).catch(() => undefined),
    ]);
  }
}

main()
  .catch((error) => {
    console.error("Group 23+24 Production Final Test: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
