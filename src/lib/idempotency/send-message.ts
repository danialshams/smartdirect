import { claimIdempotency, completeIdempotency, failIdempotency } from "./store";
import { createIdempotencyKey } from "./key";

const SEND_MESSAGE_OPERATION = "SEND_MESSAGE";

type ClaimSendMessageInput = { instagramAccountId: string; messageId: string; executionId: string };
type ClaimSendMessageResult = { claimed: boolean; key: string; leaseToken: string | null };

export async function claimSendMessage(input: ClaimSendMessageInput): Promise<ClaimSendMessageResult> {
  const key = createIdempotencyKey(
    { tenantId: input.instagramAccountId, operation: SEND_MESSAGE_OPERATION, resourceId: input.messageId },
    input.executionId,
  );
  const result = await claimIdempotency({
    key,
    tenantId: input.instagramAccountId,
    operation: SEND_MESSAGE_OPERATION,
    resourceId: input.messageId,
  });
  return { claimed: result.claimed, key, leaseToken: result.record.leaseToken };
}

export async function completeSendMessage(key: string, response?: unknown, leaseToken?: string | null): Promise<void> {
  await completeIdempotency(key, response, leaseToken);
}

export async function failSendMessage(key: string, error: unknown, leaseToken?: string | null): Promise<void> {
  const message = error instanceof Error ? error.message : "Instagram message sending failed.";
  await failIdempotency(key, message, leaseToken);
}
