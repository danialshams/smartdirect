import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { enqueueInstagramPublishing } from "../src/lib/instagram/publishing-queue";
import { recoverDuePublishingJobs, acknowledgePortablePublishingDispatch, PORTABLE_PUBLISH_DISPATCH_PENDING } from "../src/lib/instagram/portable-publishing-scheduler";
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
    assert.equal(dbJob.errorMessage, PORTABLE_PUBLISH_DISPATCH_PENDING);
    // Crash injection after CAS but before Redis enqueue: the database
    // retains an unacknowledged dispatch which the scanner can resume.
    const abandoned = await prisma.instagramPublishJob.create({
      data: {
        userId: user.id, instagramAccountId: account.id, type: "POST",
        status: "PROCESSING", scheduledAt: new Date(Date.now() - 300000),
        lastAttemptAt: new Date(Date.now() - 180000),
        errorMessage: PORTABLE_PUBLISH_DISPATCH_PENDING,
      },
    });
    const recovered = await recoverDuePublishingJobs(30, async (id, opts) => {
      const result = await enqueueInstagramPublishing(id, opts);
      jobs.push(result.job.id);
      return result;
    });
    assert.equal(recovered.recovered, 1, "Only abandoned pre-worker dispatch may be replayed");
    assert.equal((await prisma.instagramPublishJob.findUniqueOrThrow({ where: { id: abandoned.id } })).errorMessage, PORTABLE_PUBLISH_DISPATCH_PENDING);
    await acknowledgePortablePublishingDispatch(abandoned.id);
    await prisma.instagramPublishJob.update({
      where: { id: abandoned.id },
      data: { lastAttemptAt: new Date(Date.now() - 180000) },
    });
    const noReplay = await recoverDuePublishingJobs(30);
    assert.equal(noReplay.queued, 0, "Acknowledged worker must not be replayed");
    await acknowledgePortablePublishingDispatch(publish.id);
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
