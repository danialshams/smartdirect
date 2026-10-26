import { prisma } from "@/lib/prisma";
import { accessBlockFromState } from "@/lib/subscription/access";

import {
  AutomationMessageType,
  MessageDirection,
  MessageType,
} from "@/generated/prisma/client";

import { sendAutomationMessage } from "./send-automation-message";
import { getAutomatedMessageBlockReason } from "@/lib/instagram/automated-message-policy";
import { scheduleSmartReminder } from "./smart-reminders";
import { evaluateAutomationConditions } from "./conditions";
import { resolveAutomationAction } from "./action";
import { resolveNextSequentialMessage, resolveQuickReplyDestination } from "./quick-reply-flow";
import {
  claimAutomationExecution,
  completeAutomationExecution,
  failAutomationExecution,
} from "@/lib/idempotency/automation";

type ExecuteAutomationInput = {
  automationId: string;
  instagramAccountId: string;
  participantId: string;
  igUserId: string;
  commentId?: string | null;
  selectedQuickReplyId?: string | null;
  selectedQuickReplyPayload?: string | null;
  executionId?: string | null;
};

type HandoffState = {
  active: boolean;
};

async function executeAutomationInternal(input: ExecuteAutomationInput) {
  let idempotencyKey: string | null = null;
  let idempotencyLeaseToken: string | null = null;

  try {
  // =========================================================
  // 1. Find Instagram account
  // =========================================================

  const instagramAccount = await prisma.instagramAccount.findFirst({
    where: {
      id: input.instagramAccountId,
    },
    include: { user: { select: { isBlocked: true, subscriptions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { status: true, expiresAt: true } } } } },
  });

  if (!instagramAccount) {
    throw new Error("Instagram account not found");
  }

  const accountBlock = accessBlockFromState(instagramAccount.user);
  if (accountBlock) return { success: true, executed: false, reason: accountBlock };

  // =========================================================
  // 2. Find automation
  // =========================================================

  const automation = await prisma.automation.findFirst({
    where: {
      id: input.automationId,
      instagramAccountId: input.instagramAccountId,
      isActive: true,
    },
    include: {
      messages: {
        orderBy: {
          order: "asc",
        },
        include: {
          quickReplies: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!automation) {
    throw new Error("Automation not found or inactive");
  }

  if (automation.messages.length === 0) {
    return {
      success: true,
      executed: false,
      reason: "NO_MESSAGES",
    };
  }

  // =========================================================
  // 3. Find or create conversation
  // =========================================================

  const conversation = await prisma.conversation.upsert({
    where: {
      instagramAccountId_participantId: {
        instagramAccountId: input.instagramAccountId,
        participantId: input.participantId,
      },
    },
    create: {
      userId: instagramAccount.userId,
      instagramAccountId: input.instagramAccountId,
      igUserId: input.igUserId,
      participantId: input.participantId,
      isActive: true,
    },
    update: {
      igUserId: input.igUserId,
    },
  });

  // A STOP preference survives unrelated future interactions; automated
  // replies only resume upon an explicit START from this participant.
  const policyBlock = await getAutomatedMessageBlockReason({
    instagramAccountId: input.instagramAccountId,
    participantId: input.participantId,
    isPrivateReply: Boolean(input.commentId),
  });
  if (policyBlock) return {
    success: true, executed: false, reason: policyBlock, conversationId: conversation.id,
  };

  // =========================================================
  // 4. Human Agent / Transfer-to-Operator guard
  //
  // The handoff state lives in a dedicated table so the existing
  // Conversation model remains backwards compatible. Every entry
  // point (DM, comment flow, story flow, ice breaker and menu) uses
  // this same automation engine, so one guard pauses all flow-based
  // automation consistently.
  // =========================================================

  const handoffRows = await prisma.$queryRaw<HandoffState[]>`
    SELECT "active"
    FROM "ConversationHandoff"
    WHERE "conversationId" = ${conversation.id}
    LIMIT 1
  `;

  const handoff = handoffRows[0];

  const conditions = evaluateAutomationConditions({
    automationIsActive: automation.isActive,
    humanHandoffActive: Boolean(handoff?.active),
  });

  if (!conditions.allowed) {
    console.log("[Automation Engine] Automation condition blocked execution.", {
      reason: conditions.reason,
      conversationId: conversation.id,
      automationId: automation.id,
      participantId: input.participantId,
    });

    return {
      success: true,
      executed: false,
      reason: "HUMAN_HANDOFF",
      conversationId: conversation.id,
    };
  }

  if (input.executionId?.trim()) {
    const claim = await claimAutomationExecution({
      instagramAccountId: input.instagramAccountId,
      automationId: input.automationId,
      executionId: input.executionId.trim(),
    });

    if (!claim.claimed) {
      console.log("[Automation Engine] Duplicate execution skipped.", {
        automationId: input.automationId,
        executionId: input.executionId,
      });

      return {
        success: true,
        executed: false,
        reason: "IDEMPOTENT_DUPLICATE",
      };
    }

    idempotencyKey = claim.key;
    idempotencyLeaseToken = claim.leaseToken;
  }

  // =========================================================
  // 5. Determine first/current message
  // =========================================================

  let currentMessage = automation.messages[0];

  // =========================================================
  // 6. Quick Reply branch
  //
  // A Quick Reply may point to an arbitrarily deep recursive
  // branch. Resolve the selected node directly from the stored
  // tree instead of converting only one level into a message.
  // =========================================================

  const selectedPayload =
    input.selectedQuickReplyPayload?.trim() ||
    (input.selectedQuickReplyId?.includes("::")
      ? input.selectedQuickReplyId.slice(input.selectedQuickReplyId.indexOf("::") + 2)
      : null);

  if (selectedPayload || input.selectedQuickReplyId) {
    const allQuickReplies = automation.messages.flatMap((message) => message.quickReplies);

    const rootReply = input.selectedQuickReplyId && !input.selectedQuickReplyId.includes("::")
      ? allQuickReplies.find((reply) => reply.id === input.selectedQuickReplyId)
      : null;

    type QuickReplyNode = Record<string, unknown>;
    const findNode = (node: unknown, payload: string): QuickReplyNode | null => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return null;
      const record = node as QuickReplyNode;
      if (record.payload === payload) return record;

      const children = [
        ...(Array.isArray(record.quickReplies) ? record.quickReplies : []),
        ...(Array.isArray(record.destinationQuickReplies) ? record.destinationQuickReplies : []),
      ];

      for (const child of children) {
        const found = findNode(child, payload);
        if (found) return found;
      }

      return null;
    };

    let selectedNode: QuickReplyNode | null = null;

    // A top-level quick reply has its destination stored directly in
    // that row's replyText. Nested replies are stored inside that JSON
    // tree and must be resolved by payload.
    if (rootReply?.replyText && input.selectedQuickReplyId && !input.selectedQuickReplyId.includes("::")) {
      try {
        selectedNode = JSON.parse(rootReply.replyText);
      } catch {
        selectedNode = null;
      }
    } else if (selectedPayload) {
      for (const reply of allQuickReplies) {
        if (!reply.replyText) continue;
        try {
          selectedNode = findNode(JSON.parse(reply.replyText), selectedPayload);
          if (selectedNode) break;
        } catch {
          // Ignore malformed legacy reply metadata and continue searching.
        }
      }
    }

    console.log("[Automation Engine] Quick Reply destination lookup:", {
      automationId: automation.id,
      selectedQuickReplyId: input.selectedQuickReplyId ?? null,
      selectedQuickReplyPayload: selectedPayload,
      found: Boolean(selectedNode),
      rootQuickReplyCount: allQuickReplies.length,
    });

    if (!selectedNode) {
      throw new Error("Quick reply destination not found");
    }

    const destination = selectedNode;

    // Root Quick Replies use "type"; nested nodes from the client
    // serializer use "destinationType". Normalize both shapes.
    const destinationType = typeof destination.type === "string"
      ? destination.type
      : typeof destination.destinationType === "string"
        ? destination.destinationType
        : null;

    const destinationText = typeof destination.text === "string"
      ? destination.text
      : typeof destination.destinationText === "string"
        ? destination.destinationText
        : null;

    const destinationQuestion = typeof destination.question === "string"
      ? destination.question
      : typeof destination.destinationQuestion === "string"
        ? destination.destinationQuestion
        : null;

    const destinationMessage = {
      id: `destination:${rootReply?.id ?? "payload"}:${selectedPayload ?? "selected"}:${Date.now()}`,
      messageType:
        destinationType === "TEXT" ? AutomationMessageType.TEXT :
        destinationType === "FORM" ? AutomationMessageType.FORM :
        destinationType === "SHOWCASE" ? AutomationMessageType.SHOWCASE :
        destinationType === "IMAGE" ? AutomationMessageType.IMAGE :
        destinationType === "VIDEO" ? AutomationMessageType.VIDEO :
        AutomationMessageType.AUDIO,
      text:
        destinationType === "FORM"
          ? (destinationQuestion ?? "")
          : destinationText,
      mediaUrl: typeof destination.mediaUrl === "string"
        ? destination.mediaUrl
        : typeof destination.destinationMediaUrl === "string"
          ? destination.destinationMediaUrl
          : null,
      mediaId: typeof destination.mediaId === "string"
        ? destination.mediaId
        : typeof destination.destinationMediaId === "string"
          ? destination.destinationMediaId
          : null,
      showcaseId: typeof destination.showcaseId === "string"
        ? destination.showcaseId
        : typeof destination.destinationShowcaseId === "string"
          ? destination.destinationShowcaseId
          : null,
      formId: typeof destination.formId === "string"
        ? destination.formId
        : typeof destination.destinationFormId === "string"
          ? destination.destinationFormId
          : null,
      quickReplies: (
        Array.isArray(destination.quickReplies)
          ? destination.quickReplies
          : Array.isArray(destination.destinationQuickReplies)
            ? destination.destinationQuickReplies
            : []
      ).map((item) => {
        const quickReply = item && typeof item === "object" && !Array.isArray(item)
          ? item as Record<string, unknown>
          : {};
        return {
          id: typeof quickReply.id === "string" ? quickReply.id : "",
          title: typeof quickReply.title === "string" ? quickReply.title : "",
          payload: typeof quickReply.payload === "string" ? quickReply.payload : "",
        };
      }),
    };

    console.log("[Automation Engine] Quick Reply destination resolved:", {
      automationId: automation.id,
      selectedQuickReplyId: input.selectedQuickReplyId ?? null,
      selectedQuickReplyPayload: selectedPayload,
      destinationType,
      destinationMessageType: destinationMessage.messageType,
      hasMediaUrl: Boolean(destinationMessage.mediaUrl),
      mediaUrl: destinationMessage.mediaUrl,
      hasMediaId: Boolean(destinationMessage.mediaId),
      mediaId: destinationMessage.mediaId,
      destinationText: destinationMessage.text,
      quickReplyCount: destinationMessage.quickReplies?.length ?? 0,
    });

    if ((destinationType === "IMAGE" || destinationType === "VIDEO" || destinationType === "AUDIO") && !destinationMessage.mediaUrl && !destinationMessage.mediaId) {
      throw new Error(`فایل مقصد ${destinationType} برای این پاسخ پیدا نشد.`);
    }

    const destinationResult = await sendAutomationMessage({
      instagramAccountId: instagramAccount.id,
      recipientId: input.participantId,
      instagramUserId: instagramAccount.igUserId,
      executionId: input.executionId ? `${input.executionId}:reply:${rootReply?.id ?? "payload"}:${selectedPayload ?? "selected"}` : null,
      message: destinationMessage,
    });

    console.log("[Automation Engine] Quick Reply destination send result:", {
      automationId: automation.id,
      destinationType,
      success: destinationResult.success,
      igMessageId: destinationResult.igMessageId ?? null,
      error: destinationResult.error ?? null,
    });

    if (!destinationResult.success) {
      throw new Error(destinationResult.error || "Quick reply destination could not be sent.");
    }

    const savedDestination = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: getConversationMessageType(destinationMessage.messageType),
        text: destinationResult.conversationText ?? destinationMessage.text ?? null,
        mediaUrl: destinationMessage.mediaUrl,
        mediaId: destinationMessage.mediaId,
        igMessageId: destinationResult.igMessageId ?? null,
      },
    });

    try {
      await scheduleSmartReminder({ automationId: automation.id, conversationId: conversation.id, anchorMessageId: savedDestination.id });
    } catch (error) {
      console.error("[SMART_REMINDER] scheduling after quick reply failed", error);
    }

    const quickReplyResult = {
      success: true,
      executed: true,
      conversationId: conversation.id,
      executedMessages: [destinationMessage.id],
    };

    if (idempotencyKey) {
      await completeAutomationExecution(idempotencyKey, quickReplyResult, idempotencyLeaseToken);
    }

    return quickReplyResult;
  }
  // =========================================================
  // 7. Prevent circular flow
  // =========================================================

  const visitedMessages = new Set<string>();
  const executedMessages: string[] = [];
  let lastAutomatedOutboundId: string | null = null;
  let privateReplyCommentId = input.commentId ?? null;
  const isCommentTriggeredFlow = Boolean(input.commentId);

  // =========================================================
  // 8. Execute flow
  // =========================================================

  while (currentMessage) {
    if (visitedMessages.has(currentMessage.id)) {
      throw new Error("Automation flow contains a circular reference");
    }

    visitedMessages.add(currentMessage.id);

    console.log("[Automation Engine] Executing message:", {
      automationId: automation.id,
      messageId: currentMessage.id,
      messageType: currentMessage.messageType,
      order: currentMessage.order,
      quickReplies: currentMessage.quickReplies.length,
    });

    // =======================================================
    // 9. Prepare Quick Replies
    // =======================================================

    const quickReplies = currentMessage.quickReplies.map((quickReply) => ({
      id: quickReply.id,
      title: quickReply.title,
      payload: quickReply.payload,
    }));

    // =======================================================
    // 10. Send message through Instagram Adapter
    // =======================================================

    resolveAutomationAction({
      messageType: currentMessage.messageType,
      text: currentMessage.text,
      mediaUrl: currentMessage.mediaUrl,
      mediaId: currentMessage.mediaId,
      formId: currentMessage.formId,
      showcaseId: currentMessage.showcaseId,
    });

    const result = await sendAutomationMessage({
      instagramAccountId: instagramAccount.id,
      recipientId: input.participantId,
      instagramUserId: instagramAccount.igUserId,
      executionId: input.executionId,
      commentId: privateReplyCommentId,
      message: {
        id: currentMessage.id,
        messageType: currentMessage.messageType,
        text: currentMessage.text,
        mediaUrl: currentMessage.mediaUrl,
        mediaId: currentMessage.mediaId,
        showcaseId: currentMessage.showcaseId,
        formId: currentMessage.formId,
        linkButtonUrl: currentMessage.linkButtonUrl,
        linkButtonTitle: currentMessage.linkButtonTitle,
        linkButtons: Array.isArray(currentMessage.linkButtons) ? currentMessage.linkButtons as Array<{ url: string; title: string }> : undefined,
        quickReplies,
      },
    });

    // =======================================================
    // 11. Sending failed
    // =======================================================

    if (!result.success) {
      console.error("[Automation Engine] Message sending failed:", {
        automationId: automation.id,
        messageId: currentMessage.id,
        messageType: currentMessage.messageType,
        error: result.error,
      });

      const failure = {
        success: false,
        executed: false,
        reason: "MESSAGE_NOT_SENT",
        error: result.error,
        conversationId: conversation.id,
        messageId: currentMessage.id,
      };

      if (idempotencyKey) {
        await failAutomationExecution(
          idempotencyKey,
          result.error ?? "Automation message could not be sent.",
        );
      }

      return failure;
    }

    // =======================================================
    // 12. Save outbound message
    // =======================================================

    const savedOutgoing = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        messageType: getConversationMessageType(currentMessage.messageType),
        text: result.conversationText ?? currentMessage.text ?? null,
        mediaUrl: currentMessage.mediaUrl,
        mediaId: currentMessage.mediaId,
        igMessageId: result.igMessageId ?? null,
      },
    });

    lastAutomatedOutboundId = savedOutgoing.id;
    executedMessages.push(currentMessage.id);

    // A comment-triggered flow gets exactly one Private Reply.
    // Never continue automatically with a normal DM: the recipient
    // must first respond before the 24-hour messaging window opens.
    if (isCommentTriggeredFlow) {
      privateReplyCommentId = null;
      break;
    }

    // =======================================================
    // 13. Quick Reply means wait for user
    // =======================================================

    if (currentMessage.quickReplies.length > 0) {
      console.log("[Automation Engine] Waiting for Quick Reply.");
      break;
    }

    // =======================================================
    // 14. Find next message
    // =======================================================

    const nextMessage = resolveNextSequentialMessage(automation.messages, currentMessage.id);

    if (!nextMessage) {
      break;
    }

    currentMessage = nextMessage;
  }

  // =========================================================
  // 15. Update conversation
  // =========================================================

  await prisma.conversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      lastMessageAt: new Date(),
      isActive: true,
    },
  });

  if (lastAutomatedOutboundId) {
    try {
      // Comment private replies alone never open the messaging window.
      // scheduleSmartReminder requires a prior inbound DM and checks that
      // the configured delay still fits within its 24-hour window.
      await scheduleSmartReminder({ automationId: automation.id, conversationId: conversation.id, anchorMessageId: lastAutomatedOutboundId });
    } catch (error) {
      console.error("[SMART_REMINDER] scheduling after automation failed", error);
    }
  }

  const result = {
    success: true,
    executed: true,
    conversationId: conversation.id,
    executedMessages,
  };

  if (idempotencyKey) {
    await completeAutomationExecution(idempotencyKey, result, idempotencyLeaseToken);
  }

  return result;
  } catch (error) {
    if (idempotencyKey) {
      await failAutomationExecution(idempotencyKey, error, idempotencyLeaseToken);
    }
    throw error;
  }
}


export async function executeAutomation(input: ExecuteAutomationInput) {
  const startedAt = Date.now();

  try {
    const result = await executeAutomationInternal(input);
    const { recordLatency } = await import("@/lib/observability/metrics");
    void recordLatency("automation", Date.now() - startedAt);
    return result;
  } catch (error) {
    const { recordLatency, recordFailure } = await import("@/lib/observability/metrics");
    void recordLatency("automation", Date.now() - startedAt);
    void recordFailure(
      "automation",
      error instanceof Error ? error.constructor.name : "unknown",
    );
    throw error;
  }
}

// =========================================================
// Convert Automation MessageType
// to Conversation MessageType
// =========================================================

function getConversationMessageType(
  messageType: AutomationMessageType,
): MessageType {
  switch (messageType) {
    case "TEXT":
      return MessageType.TEXT;
    case "IMAGE":
      return MessageType.IMAGE;
    case "VIDEO":
      return MessageType.VIDEO;
    case "AUDIO":
      return MessageType.AUDIO;
    case "SHOWCASE":
      return MessageType.TEXT;
    case "FORM":
      return MessageType.TEXT;
    default:
      return MessageType.TEXT;
  }
}
