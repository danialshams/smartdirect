import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import {
  createQueueRedis,
  enqueueJob,
  getJob,
  completeJob,
  failJob,
} from "../src/lib/queue/core";
import { recoverStalledJobs, retryFailedJob } from "../src/lib/queue/recovery";

async function main() {
  const queueNamespace = `group18-recovery-${Date.now()}`;
  const redis = createQueueRedis();

  const failureJob = await enqueueJob(
    "TEST",
    { message: "failure-injection" },
    { maxAttempts: 1, queueNamespace },
  );

  const claimed = await (await import("../src/lib/queue/core")).claimNextJob("failure-test-worker", queueNamespace);

  if (!claimed || claimed.id !== failureJob.id) {
    throw new Error("Failed job test could not claim the injected job.");
  }

  await failJob(failureJob.id, new Error("INJECTED_FAILURE_FOR_TEST"));

  const failedRecord = await prisma.queueFailure.findUnique({
    where: { jobId: failureJob.id },
  });

  if (
    !failedRecord ||
    failedRecord.status !== "FAILED" ||
    failedRecord.lastError !== "INJECTED_FAILURE_FOR_TEST" ||
    failedRecord.attempts !== 1
  ) {
    throw new Error("Failed job storage/reason/retry count test failed.");
  }

  const retried = await retryFailedJob(failedRecord.id);
  const retriedJob = await getJob(retried.id);

  if (!retriedJob || retriedJob.status !== "waiting" || retriedJob.recoveryId !== failedRecord.id) {
    throw new Error("Manual retry did not requeue the failed job correctly.");
  }

  await completeJob(retried.id);

  const resolved = await prisma.queueFailure.findUnique({
    where: { id: failedRecord.id },
  });

  if (!resolved || resolved.status !== "RESOLVED") {
    throw new Error("Recovery resolution logging failed.");
  }

  const stalledJob = await enqueueJob(
    "TEST",
    { message: "stalled-injection" },
    { maxAttempts: 2, queueNamespace },
  );

  const stalledClaim = await (await import("../src/lib/queue/core")).claimNextJob("stalled-test-worker", queueNamespace);

  if (!stalledClaim || stalledClaim.id !== stalledJob.id) {
    throw new Error("Stalled job could not be claimed.");
  }

  await redis.zadd(`smartdirect:queue:${queueNamespace}:active`, {
    score: Date.now() - 120_000,
    member: stalledJob.id,
  });
  await redis.del(`smartdirect:queue:claim:${stalledJob.id}`);

  const recovery = await recoverStalledJobs(50, queueNamespace);

  if (recovery.recovered < 1) {
    throw new Error("Automatic stalled job recovery did not recover the job.");
  }

  const recovered = await getJob(stalledJob.id);

  if (!recovered || recovered.status !== "waiting") {
    throw new Error("Recovered stalled job is not waiting.");
  }

  await completeJob(stalledJob.id);

  await prisma.queueFailure.deleteMany({
    where: {
      OR: [
        { jobId: failureJob.id },
        { requeuedJobId: retried.id },
      ],
    },
  });

  await redis.del(`smartdirect:queue:job:${failureJob.id}`);
  await redis.del(`smartdirect:queue:job:${retried.id}`);
  await redis.del(`smartdirect:queue:job:${stalledJob.id}`);
  await redis.zrem(`smartdirect:queue:${queueNamespace}:failed`, failureJob.id);
  await redis.zrem(`smartdirect:queue:${queueNamespace}:active`, stalledJob.id);

  console.log(JSON.stringify({
    success: true,
    stages: {
      failedJobStorage: true,
      failureReason: true,
      retryCount: true,
      deadLetterQueue: true,
      manualRetry: true,
      automaticRecovery: true,
      stalledJobRecovery: true,
      permanentFailureDetection: true,
      recoveryLogging: true,
      recoveryTest: true,
      failureInjectionTest: true,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
