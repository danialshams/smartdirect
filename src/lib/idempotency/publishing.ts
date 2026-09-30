import {
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
  getIdempotencyRecord,
  retryFailedIdempotency,
} from "./store";
import { createIdempotencyKey } from "./key";

const PUBLISH_OPERATION = "PUBLISH_MEDIA";

type ClaimPublishingInput = { instagramAccountId: string; publishingJobId: string };
type ClaimPublishingResult = { claimed: boolean; key: string; leaseToken: string | null };

export async function claimPublishingExecution(input: ClaimPublishingInput): Promise<ClaimPublishingResult> {
  const key = createIdempotencyKey(
    { tenantId: input.instagramAccountId, operation: PUBLISH_OPERATION, resourceId: input.publishingJobId },
    input.publishingJobId,
  );
  const existing = await getIdempotencyRecord(key);

  if (existing?.status === "FAILED") {
    const retried = await retryFailedIdempotency(key);
    return { claimed: retried.claimed, key, leaseToken: retried.record.leaseToken };
  }

  const result = await claimIdempotency({
    key,
    tenantId: input.instagramAccountId,
    operation: PUBLISH_OPERATION,
    resourceId: input.publishingJobId,
  });
  return { claimed: result.claimed, key, leaseToken: result.record.leaseToken };
}

export async function completePublishingExecution(key: string, response?: unknown, leaseToken?: string | null): Promise<void> {
  await completeIdempotency(key, response, leaseToken);
}

export async function failPublishingExecution(key: string, error: unknown, leaseToken?: string | null): Promise<void> {
  const message = error instanceof Error ? error.message : "Instagram publishing failed.";
  await failIdempotency(key, message, leaseToken);
}
