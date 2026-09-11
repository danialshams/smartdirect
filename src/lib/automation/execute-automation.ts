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

  selectedQuickReplyId?: string | null;
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
  // 4. Determine first/current message
  // =========================================================

  let currentMessage = automation.messages[0];

  // =========================================================
  // 5. Quick Reply branch
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
  // 6. Prevent circular flow
  // =========================================================

  const visitedMessages = new Set<string>();

  const executedMessages: string[] = [];

  // =========================================================
  // 7. Execute flow
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
    // 8. Prepare Quick Replies
    // =======================================================

    const quickReplies = currentMessage.quickReplies.map((quickReply) => ({
      id: quickReply.id,

      title: quickReply.title,

      payload: quickReply.payload,
    }));

    // =======================================================
    // 9. Send message through Meta Adapter
    // =======================================================
    const result = await sendAutomationMessage({
      instagramAccountId: instagramAccount.id,

      recipientId: input.participantId,

      instagramUserId: instagramAccount.igUserId,

      message: {
        id: currentMessage.id,

        messageType: currentMessage.messageType,

        text: currentMessage.text,

        mediaUrl: currentMessage.mediaUrl,

        mediaId: currentMessage.mediaId,

        quickReplies,
      },
    });

    // =======================================================
    // 10. Sending failed
    // =======================================================

    if (!result.success) {
      console.error("[Automation Engine] Message sending failed:", {
        automationId: automation.id,

        messageId: currentMessage.id,

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
    // 11. Save outbound message
    // =======================================================

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,

        direction: MessageDirection.OUTBOUND,

        messageType: getConversationMessageType(currentMessage.messageType),

        text: currentMessage.text,

        mediaUrl: currentMessage.mediaUrl,

        mediaId: currentMessage.mediaId,

        igMessageId: result.igMessageId ?? null,
      },
    });

    executedMessages.push(currentMessage.id);

    // =======================================================
    // 12. Quick Reply means wait for user
    // =======================================================

    if (currentMessage.quickReplies.length > 0) {
      console.log("[Automation Engine] Waiting for Quick Reply.");

      break;
    }

    // =======================================================
    // 13. Find next message
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
  // 14. Update conversation
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

    /*
     * Showcase و Form هنوز Adapter
     * مستقل ندارند.
     */
    case "SHOWCASE":
      return MessageType.TEXT;

    case "FORM":
      return MessageType.TEXT;

    default:
      return MessageType.TEXT;
  }
}
