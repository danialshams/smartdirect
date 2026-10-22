import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { enqueueInstagramPublishing } from "../src/lib/instagram/publishing-queue";
import { recoverDuePublishingJobs } from "../src/lib/instagram/portable-publishing-scheduler";
import { getJob, deleteJob } from "../src/lib/queue/core";
import { disconnectRedis } from "../src/lib/redis/client";

async function main() {
  const suffix = Date.now() + "-" + Math.floor(Math.random() * 1e7);
  const user = await prisma.user.create({
    data: { email: "ci-portable-" + suffix + "@example.invalid", name: "CI portability", password: "ci-only" },
  });
  const jobs: string[] = [];
  try {
    const account = await prisma.instagramAccount.create({
      data: { userId: user.id, igUserId: "ig-portable-" + suffix, igUsername: "ci_" + suffix, accessToken: "ci-token", isConnected: true },
    });
    const publish = await prisma.instagramPublishJob.create({
      data: {
        userId: user.id, instagramAccountId: account.id, type: "POST", status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 30000),
      },
    });
    // Fault injection: a failed Redis enqueue must restore the durable timer.
    const broken = await recoverDuePublishingJobs(30, async () => { throw new Error("REDIS_UNAVAILABLE"); });
    assert(broken.deferred >= 1);
    let dbJob = await prisma.instagramPublishJob.findUniqueOrThrow({ where: { id: publish.id } });
    assert.equal(dbJob.status, "SCHEDULED");
    assert.match(dbJob.errorMessage ?? "", /REDIS_UNAVAILABLE/);

    const fired = await recoverDuePublishingJobs(30, async (id, opts) => {
      const result = await enqueueInstagramPublishing(id, opts);
      jobs.push(result.job.id);
      return result;
    });
    assert(fired.queued >= 1);
    dbJob = await prisma.instagramPublishJob.findUniqueOrThrow({ where: { id: publish.id } });
    assert.equal(dbJob.status, "PROCESSING");
    assert.equal((await getJob(jobs[0]))?.type, "PUBLISH");
    const duplicate = await recoverDuePublishingJobs(30);
    assert.equal(duplicate.queued, 0, "Only one dispatcher may claim a scheduled publish");
    console.log("Portable due-publishing scheduler, Redis failure and duplicate recovery: OK");
  } finally {
    await Promise.allSettled(jobs.map(id => deleteJob(id)));
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
    await disconnectRedis().catch(() => undefined);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
