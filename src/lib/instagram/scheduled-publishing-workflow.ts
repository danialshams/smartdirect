import { sleep } from "workflow";

import { prisma } from "@/lib/prisma";
import { enqueueInstagramPublishing } from "@/lib/instagram/publishing-queue";
import { processPublishingQueueJobStep } from "@/lib/instagram/publishing-workflow";

async function publishScheduledJobStep(jobId: string) {
  "use step";

  const job = await prisma.instagramPublishJob.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      scheduledAt: true,
    },
  });

  if (!job) {
    return { ok: false, skipped: true, message: "Publishing job پیدا نشد." };
  }

  if (job.status !== "SCHEDULED") {
    return {
      ok: false,
      skipped: true,
      message: `Job در وضعیت ${job.status} است و انتشار زمان‌بندی‌شده لغو شد.`,
    };
  }

  if (job.scheduledAt && job.scheduledAt.getTime() > Date.now()) {
    return {
      ok: false,
      skipped: true,
      message: "زمان انتشار هنوز نرسیده است.",
    };
  }

  try {
    const queued = await enqueueInstagramPublishing(jobId, { maxAttempts: 4 });

    return {
      ok: true,
      skipped: false,
      queued: true,
      queueJobId: queued.job.id,
      processed: await processPublishingQueueJobStep(queued.job.id),
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      message:
        error instanceof Error ? error.message : "Instagram publishing failed.",
    };
  }
}

export async function scheduleInstagramPublish(
  jobId: string,
  scheduledAt: string,
) {
  "use workflow";

  const target = new Date(scheduledAt);

  if (target.getTime() > Date.now()) {
    await sleep(target);
  }

  return publishScheduledJobStep(jobId);
}
