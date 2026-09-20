import { prisma } from "@/lib/prisma";

import {
  AutomationMessageType,
  MessageDirection,
  MessageType,
} from "@/generated/prisma/client";

import { sendAutomationMessage } from "./send-automation-message";

type ExecuteAutomationInput = {
  automationId: string;
  instagramAccountId: string;
  participantId: string;
  igUserId: string;
  commentId?: string | null;
  selectedQuickReplyId?: string | null;
};

type HandoffState = {
  active: boolean;
};

export async function executeAutomation(input: ExecuteAutomationInput) {
  // =========================================================
  // 1. Find Instagram account
  // =========================================================

  const instagramAccount = await prisma.instagramAccount.findFirst({
    where: {
      id: input.instagramAccountId,
    },
  });

  if (!instagramAccount) {
    throw new Error("Instagram account not found");
  }

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
      isActive: true,
      igUserId: input.igUserId,
    },
  });

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

  if (handoff?.active) {
    console.log("[Automation Engine] Human handoff is active; automation paused.", {
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

  // =========================================================
  // 5. Determine first/current message
  // =========================================================

  let currentMessage = automation.messages[0];

  // =========================================================
  // 6. Quick Reply branch
  // =========================================================

  if (input.selectedQuickReplyId) {
    const selectedQuickReply = await prisma.quickReply.findFirst({
      where: {
        id: input.selectedQuickReplyId,
        automationMessage: {
          automationId: automation.id,
        },
      },
    });

    if (!selectedQuickReply) {
      throw new Error("Quick reply not found");
    }

    if (!selectedQuickReply.nextMessageId) {
      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          lastMessageAt: new Date(),
          isActive: true,
        },
      });

      return {
        success: true,
        executed: false,
        reason: "FLOW_FINISHED",
        conversationId: conversation.id,
      };
    }

    const nextMessage = automation.messages.find(
      (message) => message.id === selectedQuickReply.nextMessageId,
    );

    if (!nextMessage) {
      throw new Error("Quick reply destination message not found");
    }

    currentMessage = nextMessage;
  }

  // =========================================================
  // 7. Prevent circular flow
  // =========================================================

  const visitedMessages = new Set<string>();
  const executedMessages: string[] = [];
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

    const result = await sendAutomationMessage({
      instagramAccountId: instagramAccount.id,
      recipientId: input.participantId,
      instagramUserId: instagramAccount.igUserId,
      commentId: privateReplyCommentId,
      message: {
        id: currentMessage.id,
        messageType: currentMessage.messageType,
        text: currentMessage.text,
        mediaUrl: currentMessage.mediaUrl,
        mediaId: currentMessage.mediaId,
        showcaseId: currentMessage.showcaseId,
        formId: currentMessage.formId,
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

      return {
        success: false,
        executed: false,
        reason: "MESSAGE_NOT_SENT",
        error: result.error,
        conversationId: conversation.id,
        messageId: currentMessage.id,
      };
    }

    // =======================================================
    // 12. Save outbound message
    // =======================================================

    await prisma.conversationMessage.create({
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

    const currentIndex = automation.messages.findIndex(
      (message) => message.id === currentMessage.id,
    );

    const nextMessage = automation.messages[currentIndex + 1];

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

  return {
    success: true,
    executed: true,
    conversationId: conversation.id,
    executedMessages,
  };
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
