import {
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
  getIdempotencyRecord,
  retryFailedIdempotency,
} from "./store";
import { createIdempotencyKey } from "./key";

const PUBLISH_OPERATION = "PUBLISH_MEDIA";

type ClaimPublishingInput = {
  instagramAccountId: string;
  publishingJobId: string;
};

type ClaimPublishingResult = {
  claimed: boolean;
  key: string;
};

export async function claimPublishingExecution(
  input: ClaimPublishingInput,
): Promise<ClaimPublishingResult> {
  const key = createIdempotencyKey(
    {
      tenantId: input.instagramAccountId,
      operation: PUBLISH_OPERATION,
      resourceId: input.publishingJobId,
    },
    input.publishingJobId,
  );

  const existing = await getIdempotencyRecord(key);

  if (existing?.status === "FAILED") {
    const retried = await retryFailedIdempotency(key);
    return {
      claimed: retried.claimed,
      key,
    };
  }

  const result = await claimIdempotency({
    key,
    tenantId: input.instagramAccountId,
    operation: PUBLISH_OPERATION,
    resourceId: input.publishingJobId,
  });

  return {
    claimed: result.claimed,
    key,
  };
}

export async function completePublishingExecution(
  key: string,
  response?: unknown,
): Promise<void> {
  await completeIdempotency(key, response);
}

export async function failPublishingExecution(
  key: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : "Instagram publishing failed.";
  await failIdempotency(key, message);
}
