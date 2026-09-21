import { acquireLock, releaseLock } from "@/lib/lock/redis-lock";

export type ConversationLockScope = {
  instagramAccountId: string;
  participantId: string;
};

export async function acquireConversationLock(input: ConversationLockScope) {
  const resourceId = `${input.instagramAccountId}:${input.participantId}`;
  return acquireLock({ scope: "conversation", resourceId });
}

export async function withConversationLock<T>(
  input: ConversationLockScope,
  work: () => Promise<T>,
): Promise<T> {
  const result = await acquireConversationLock(input);
  if (!result.acquired || !result.handle) {
    throw new Error("CONVERSATION_LOCK_BUSY");
  }
  try {
    return await work();
  } finally {
    await releaseLock(result.handle);
  }
}
