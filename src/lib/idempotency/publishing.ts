import {
  claimIdempotency,
  completeIdempotency,
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
