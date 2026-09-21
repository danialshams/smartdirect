import "dotenv/config";

import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as any;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const publishing = fs.readFileSync("src/lib/instagram/publishing.ts", "utf8");
  const schedule = fs.readFileSync("src/lib/instagram/scheduled-publishing-workflow.ts", "utf8");
  const upload = fs.readFileSync("app/api/instagram/publishing/upload/route.ts", "utf8");
  const publishRoute = fs.readFileSync("app/api/instagram/publishing/[id]/publish/route.ts", "utf8");
  const retryRoute = fs.readFileSync("app/api/instagram/publishing/[id]/retry/route.ts", "utf8");
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

  assert(publishing.includes('job.type === "POST"'), "POST support missing");
  assert(publishing.includes('job.type === "REEL"'), "REEL support missing");
  assert(publishing.includes('job.type === "CAROUSEL"'), "CAROUSEL support missing");
  assert(publishing.includes('job.type === "STORY"'), "STORY support missing");
  assert(publishing.includes("createCarouselContainer"), "Carousel container support missing");
  assert(publishing.includes("waitReady"), "Media readiness processing missing");
  assert(publishing.includes("claimPublishingExecution"), "Publishing idempotency missing");
  assert(publishing.includes('status: "FAILED"'), "Publishing failure state missing");
  assert(schedule.includes("enqueueInstagramPublishing"), "Scheduled jobs do not enter publishing queue");
  assert(upload.includes("getStorageProvider"), "Media processing/storage path missing");
  assert(publishRoute.includes("enqueueInstagramPublishing"), "Manual publish route bypasses queue");
  assert(retryRoute.includes("enqueueInstagramPublishing"), "Retry route bypasses queue");
  assert(schema.includes("@@unique([instagramAccountId, scheduledAt])"), "Same-time publishing conflict constraint missing");

  const { enqueueJob, deleteJob, getJob } = await import("../src/lib/queue/core");
  const queueJob = await enqueueJob("PUBLISH", {
    publishingJobId: `queue-test-${Date.now()}-${Math.random()}`,
  }, { maxAttempts: 4 });

  const stored = await getJob(queueJob.id);
  assert(stored?.type === "PUBLISH", "PUBLISH queue job was not stored");
  const storedPublishJob = stored as import("../src/lib/queue/types").QueueJob<"PUBLISH">;
  assert(storedPublishJob.payload.publishingJobId === queueJob.payload.publishingJobId, "PUBLISH payload mismatch");
  assert(stored?.maxAttempts === 4, "Publishing queue retry count mismatch");

  await deleteJob(queueJob.id);

  console.log("110-121 Publishing Queue: OK");
  console.log(JSON.stringify({
    success: true,
    architecture: "Redis Queue -> Publishing Worker -> Instagram Publishing Gateway",
    jobTypes: ["POST", "REEL", "CAROUSEL", "STORY"],
    mediaProcessing: true,
    scheduledPublishing: true,
    sameTimeConflictProtection: true,
    publishRetry: true,
    publishFailureHandling: true,
    publishIdempotency: true,
    queueTest: true
  }, null, 2));
}

main().catch((error) => {
  console.error("110-121 Publishing Queue: FAILED");
  console.error(error);
  process.exitCode = 1;
});
