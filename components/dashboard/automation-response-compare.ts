import type { MessageDraft, QuickReplyDraft } from "./automation-form-utils";

/**
 * Compare the recipient-visible response, not generated database IDs or
 * quick-reply payload tokens. Nested branching destinations are included.
 */
export function responseFingerprint(message: MessageDraft): string {
  const replies = (items: QuickReplyDraft[]): unknown[] => items.map((item) => ({
    isExit: item.isExit ?? false,
    title: item.title,
    destinationType: item.destinationType,
    destinationText: item.destinationText,
    destinationFormId: item.destinationFormId,
    destinationShowcaseId: item.destinationShowcaseId,
    destinationMediaUrl: item.destinationMediaUrl,
    destinationMediaId: item.destinationMediaId,
    destinationQuestion: item.destinationQuestion,
    destinationQuickReplies: replies(item.destinationQuickReplies),
  }));
  return JSON.stringify({
    messageType: message.messageType,
    text: message.text,
    mediaUrl: message.mediaUrl,
    mediaId: message.mediaId,
    showcaseId: message.showcaseId,
    formId: message.formId,
    quickReplies: replies(message.quickReplies),
  });
}

/** Sequence order is recipient-visible. Ignore generated database IDs and
 * quick-reply payloads exactly as responseFingerprint does for one message. */
export function responseSequenceFingerprint(messages: MessageDraft[]): string {
  return JSON.stringify(messages.map((message) => JSON.parse(responseFingerprint(message))));
}

function keywordsFingerprint(words: string[]): string {
  return JSON.stringify(Array.from(
    new Set(words.map((word) => word.trim().toLocaleLowerCase("fa-IR")).filter(Boolean)),
  ).sort());
}

/** Editing an existing DM rule requires a meaningful keyword, reply, or showcase change. */
export function directAutomationHasChanges({
  originalKeywords,
  currentKeywords,
  originalResponseSignature,
  currentMessage,
  currentMessages,
  showcaseDraftChanged = false,
}: {
  originalKeywords: string[];
  currentKeywords: string[];
  originalResponseSignature: string | null;
  currentMessage: MessageDraft;
  currentMessages?: MessageDraft[];
  showcaseDraftChanged?: boolean;
}): boolean {
  if (originalResponseSignature === null) return false;
  return keywordsFingerprint(originalKeywords) !== keywordsFingerprint(currentKeywords)
    || originalResponseSignature !== (currentMessages ? responseSequenceFingerprint(currentMessages) : responseFingerprint(currentMessage))
    || showcaseDraftChanged;
}
