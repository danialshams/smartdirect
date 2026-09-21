export type QuickReplyFlowMessage = {
  id: string;
  quickReplies: Array<{ id: string; nextMessageId: string | null }>;
};

export function resolveQuickReplyDestination(messages: QuickReplyFlowMessage[], selectedQuickReplyId: string): string | null {
  const reply = messages.flatMap((message) => message.quickReplies).find((item) => item.id === selectedQuickReplyId);
  if (!reply) throw new Error("Quick reply not found");
  return reply.nextMessageId;
}

export function resolveNextSequentialMessage<T extends { id: string }>(messages: T[], currentMessageId: string): T | null {
  const index = messages.findIndex((message) => message.id === currentMessageId);
  if (index < 0) throw new Error("Current automation message not found");
  return messages[index + 1] ?? null;
}
