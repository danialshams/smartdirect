import { sleep } from "workflow";

import { prisma } from "@/lib/prisma";
import { publishInstagramJob } from "@/lib/instagram/publishing";

const MAX_ATTEMPTS = 2;

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
    const published = await publishInstagramJob(jobId);

    return {
      ok: true,
      skipped: false,
      mediaId: published.instagramMediaId,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      message: error instanceof Error ? error.message : "Instagram publishing failed.",
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

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = await publishScheduledJobStep(jobId);

    if (result.ok || result.skipped) {
      return result;
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep("10s");
    }
  }

  return {
    ok: false,
    skipped: false,
    message: "انتشار زمان‌بندی‌شده پس از تلاش مجدد ناموفق بود.",
  };
}
