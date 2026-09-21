import {
  claimIdempotency,
  completeIdempotency,
  failIdempotency,
} from "./store";
import { createIdempotencyKey } from "./key";

const AUTOMATION_OPERATION = "AUTOMATION_EXECUTION";

type ClaimAutomationExecutionInput = {
  instagramAccountId: string;
  automationId: string;
  executionId: string;
};

type ClaimAutomationExecutionResult = {
  claimed: boolean;
  key: string;
};

export async function claimAutomationExecution(
  input: ClaimAutomationExecutionInput,
): Promise<ClaimAutomationExecutionResult> {
  const key = createIdempotencyKey(
    {
      tenantId: input.instagramAccountId,
      operation: AUTOMATION_OPERATION,
      resourceId: input.automationId,
    },
    input.executionId,
  );

  const result = await claimIdempotency({
    key,
    tenantId: input.instagramAccountId,
    operation: AUTOMATION_OPERATION,
    resourceId: input.automationId,
  });

  return {
    claimed: result.claimed,
    key,
  };
}

export async function completeAutomationExecution(
  key: string,
  response?: unknown,
): Promise<void> {
  await completeIdempotency(key, response);
}

export async function failAutomationExecution(
  key: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : "Automation execution failed.";

  await failIdempotency(key, message);
}
