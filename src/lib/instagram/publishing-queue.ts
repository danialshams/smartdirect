import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue/core";
import type { QueueJob } from "@/lib/queue/types";

const DEFAULT_MAX_ATTEMPTS = 4;

export type PublishingQueueResult = {
  job: QueueJob<"PUBLISH">;
  publishingJobId: string;
};

export async function enqueueInstagramPublishing(
  publishingJobId: string,
  options: { delayMs?: number; maxAttempts?: number } = {},
): Promise<PublishingQueueResult> {
  const publishingJob = await prisma.instagramPublishJob.findUnique({
    where: { id: publishingJobId },
    select: {
      id: true,
      status: true,
      instagramAccountId: true,
      userId: true,
    },
  });

  if (!publishingJob) {
    throw new Error("Publishing Job پیدا نشد.");
  }

  if (["PUBLISHED", "CANCELLED"].includes(publishingJob.status)) {
    throw new Error(`Publishing Job در وضعیت ${publishingJob.status} قابل Queue شدن نیست.`);
  }

  const job = await enqueueJob(
    "PUBLISH",
    { publishingJobId: publishingJob.id },
    {
      delayMs: Math.max(0, options.delayMs ?? 0),
      maxAttempts: Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
      priority: "normal",
    },
  );

  return {
    job,
    publishingJobId: publishingJob.id,
  };
}
