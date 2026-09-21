import { NextRequest, NextResponse } from "next/server";

import { claimNextJob, completeJob, failJob, promoteDueJobs } from "@/lib/queue/core";
import type { QueueJob } from "@/lib/queue/types";
import { claimIdempotency, completeIdempotency, failIdempotency } from "@/lib/idempotency/store";
import { acquireLock, releaseLock } from "@/lib/lock/redis-lock";
import type { DistributedLockHandle } from "@/lib/lock/types";
import { handleInstagramWebhookJob } from "@/lib/webhook/worker-handler";
import { publishInstagramJob } from "@/lib/instagram/publishing";
import { enterObservabilityContext } from "@/lib/observability/context";
import { observabilityLogger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

async function handleJob(job: QueueJob) {
  enterObservabilityContext({ jobId: job.id });

  let lockHandle: DistributedLockHandle | undefined;

  try {
    const lock = await acquireLock({
      scope: "job",
      resourceId: job.id,
    });

    if (!lock.acquired) {
      throw new Error(`Distributed lock is already held for job ${job.id}.`);
    }

    lockHandle = lock.handle;

    if (job.idempotency) {
      const claim = await claimIdempotency({
        key: job.idempotency.key,
        tenantId: job.idempotency.tenantId,
        operation: job.idempotency.operation,
        resourceId: job.idempotency.resourceId,
      });

      if (!claim.claimed) {
        await completeJob(job.id);
        return { completed: true, skipped: true };
      }
    }

    if (job.type === "INSTAGRAM_WEBHOOK") {
      await handleInstagramWebhookJob(
        job as QueueJob<"INSTAGRAM_WEBHOOK">,
      );
    } else if (job.type === "PUBLISH") {
      await publishInstagramJob(
        (job as QueueJob<"PUBLISH">).payload.publishingJobId,
      );
    } else if (job.type === "TEST") {
      // TEST jobs are intentionally no-op in production.
    } else {
      throw new Error(`Unsupported production queue job type: ${job.type}`);
    }

    if (job.idempotency) {
      await completeIdempotency(job.idempotency.key, { jobId: job.id });
    }

    await completeJob(job.id);

    return { completed: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    observabilityLogger.error("serverless_queue_job_failed", {
      type: job.type,
      attempt: job.attempts,
      error: message,
    });

    if (job.idempotency) {
      try {
        await failIdempotency(job.idempotency.key, message);
      } catch (idempotencyError) {
        observabilityLogger.error("serverless_queue_idempotency_failure_marking_error", {
          error:
            idempotencyError instanceof Error
              ? idempotencyError.message
              : String(idempotencyError),
        });
      }
    }

    await failJob(job.id, error);
    throw error;
  } finally {
    if (lockHandle) {
      await releaseLock(lockHandle);
    }
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    await promoteDueJobs(20);

    const job = await claimNextJob(
      `vercel-cron-${Date.now()}`,
    );

    if (!job) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No queue job is ready.",
      });
    }

    try {
      const result = await handleJob(job);

      return NextResponse.json({
        success: true,
        processed: 1,
        jobId: job.id,
        type: job.type,
        ...result,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          processed: 1,
          jobId: job.id,
          type: job.type,
          error: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[Queue Cron] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Queue processing failed.",
      },
      { status: 500 },
    );
  }
}
