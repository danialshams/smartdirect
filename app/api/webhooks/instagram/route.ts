import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { executeAutomation } from "@/lib/automation/execute-automation";
import { findMatchingAutomation } from "@/lib/automation/find-matching-automation";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { reactToInstagramMessage } from "@/lib/instagram/react-to-message";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const MAX_API_RETRIES = 3;

// =========================================================
// Types
// =========================================================

type InstagramAccountData = {
  id: string;
  userId: string;
  igUserId: string;
  igUsername: string;
};

// =========================================================
// Helpers
// =========================================================

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/۰/g, "0")
    .replace(/۱/g, "1")
    .replace(/۲/g, "2")
    .replace(/۳/g, "3")
    .replace(/۴/g, "4")
    .replace(/۵/g, "5")
    .replace(/۶/g, "6")
    .replace(/۷/g, "7")
    .replace(/۸/g, "8")
    .replace(/۹/g, "9")
    .toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =========================================================
// Story Reply helpers
// =========================================================

type StoryReplyData = {
  isStoryReply: boolean;
  storyId: string | null;
  storyUrl: string | null;
};

function extractStoryReplyData(message: any): StoryReplyData {
  // -------------------------------------------------------
  // 1. PRIMARY / CURRENT META STORY REPLY STRUCTURE
  //
  // message.reply_to.story.id
  // message.reply_to.story.url
  // -------------------------------------------------------

  const replyToStory = message?.reply_to?.story;

  if (replyToStory) {
    const storyId =
      replyToStory?.id ??
      replyToStory?.media_id ??
      replyToStory?.mediaId ??
      null;

    const storyUrl =
      replyToStory?.url ??
      replyToStory?.permalink ??
      replyToStory?.link ??
      null;

    console.log("Story Reply detected through message.reply_to.story");

    console.log("Detected Story ID:", storyId ?? "NONE");

    console.log("Detected Story URL:", storyUrl ?? "NONE");

    if (storyId) {
      return {
        isStoryReply: true,
        storyId: String(storyId),
        storyUrl: storyUrl ? String(storyUrl) : null,
      };
    }

    return {
      isStoryReply: true,
      storyId: null,
      storyUrl: storyUrl ? String(storyUrl) : null,
    };
  }

  // -------------------------------------------------------
  // 2. Direct story field fallback
  // -------------------------------------------------------

  const directStory = message?.story;

  if (directStory) {
    const storyId =
      directStory?.id ?? directStory?.media_id ?? directStory?.mediaId ?? null;

    const storyUrl =
      directStory?.url ?? directStory?.permalink ?? directStory?.link ?? null;

    if (storyId) {
      return {
        isStoryReply: true,
        storyId: String(storyId),
        storyUrl: storyUrl ? String(storyUrl) : null,
      };
    }
  }

  // -------------------------------------------------------
  // 3. Attachment story fallback
  // -------------------------------------------------------

  const attachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];

  for (const attachment of attachments) {
    const attachmentType = String(attachment?.type ?? "").toLowerCase();

    const payload = attachment?.payload ?? {};

    const storyId =
      payload?.story_id ??
      payload?.storyId ??
      payload?.media_id ??
      payload?.mediaId ??
      attachment?.story_id ??
      attachment?.storyId ??
      null;

    const storyUrl =
      payload?.url ??
      payload?.story_url ??
      payload?.storyUrl ??
      attachment?.url ??
      null;

    if (
      storyId ||
      attachmentType === "story" ||
      attachmentType === "ig_story"
    ) {
      return {
        isStoryReply: true,
        storyId: storyId ? String(storyId) : null,
        storyUrl: storyUrl ? String(storyUrl) : null,
      };
    }
  }

  // -------------------------------------------------------
  // 4. Story-related top-level fields fallback
  // -------------------------------------------------------

  const storyId =
    message?.story_id ??
    message?.storyId ??
    message?.media_id ??
    message?.mediaId ??
    null;

  if (storyId) {
    return {
      isStoryReply: true,
      storyId: String(storyId),
      storyUrl: null,
    };
  }

  // -------------------------------------------------------
  // 5. Not a Story Reply
  // -------------------------------------------------------

  return {
    isStoryReply: false,
    storyId: null,
    storyUrl: null,
  };
}

// =========================================================
// GET
// Meta uses this endpoint to verify the webhook.
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK VERIFICATION");
    console.log("mode:", mode);
    console.log("token received:", Boolean(token));
    console.log("challenge received:", Boolean(challenge));
    console.log("========================================");

    const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error("INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured");

      return new NextResponse("Webhook verify token is not configured", {
        status: 500,
      });
    }

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Instagram webhook verification successful");

      return new NextResponse(challenge || "", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    console.error("Instagram webhook verification failed");

    return new NextResponse("Forbidden", {
      status: 403,
    });
  } catch (error) {
    console.error("Instagram webhook GET error:", error);

    return new NextResponse("Internal Server Error", {
      status: 500,
    });
  }
}

// =========================================================
// POST
// Instagram / Meta sends webhook events here.
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK EVENT");
    console.log("========================================");

    console.log("Webhook body:", JSON.stringify(body, null, 2));

    // =======================================================
    // 1. Validate webhook structure
    // =======================================================

    if (!body || body.object !== "instagram" || !Array.isArray(body.entry)) {
      console.error("Invalid Instagram webhook payload");

      return NextResponse.json(
        {
          success: false,
          message: "Invalid webhook payload",
        },
        {
          status: 400,
        },
      );
    }

    // =======================================================
    // 2. Process every entry
    // =======================================================

    for (const entry of body.entry) {
      const igUserId = entry.id;

      if (!igUserId) {
        console.error("Webhook entry does not contain Instagram user ID");

        continue;
      }

      console.log("Webhook Instagram User ID:", igUserId);

      // =====================================================
      // 3. Find connected Instagram account
      // =====================================================

      const instagramAccount = await prisma.instagramAccount.findUnique({
        where: {
          igUserId: String(igUserId),
        },
      });

      if (!instagramAccount) {
        console.warn("Instagram account not found:", igUserId);

        continue;
      }

      console.log("Instagram account found:", instagramAccount.igUsername);

      console.log("Database Instagram Account ID:", instagramAccount.id);

      const accountData: InstagramAccountData = {
        id: instagramAccount.id,
        userId: instagramAccount.userId,
        igUserId: instagramAccount.igUserId,
        igUsername: instagramAccount.igUsername,
      };

      // =====================================================
      // 4. Process messaging events
      // =====================================================

      if (Array.isArray(entry.messaging)) {
        console.log("Messaging events received:", entry.messaging.length);

        for (const messagingEvent of entry.messaging) {
          await processMessagingEvent(messagingEvent, accountData);
        }
      }

      // =====================================================
      // 5. Process comment changes
      // =====================================================

      if (Array.isArray(entry.changes)) {
        console.log("Change events received:", entry.changes.length);

        for (const change of entry.changes) {
          if (change.field !== "comments") {
            console.log("Ignoring webhook field:", change.field);

            continue;
          }

          await processCommentEvent(change.value, accountData);
        }
      }

      // =====================================================
      // 6. No changes or messaging
      // =====================================================

      if (!Array.isArray(entry.changes) && !Array.isArray(entry.messaging)) {
        console.log("Webhook entry has no changes or messaging array");
      }
    }

    // =======================================================
    // 7. Processing complete
    // =======================================================

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK PROCESSING COMPLETE");
    console.log("========================================");

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Instagram webhook POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}

// =========================================================
// Process Instagram messaging events
// =========================================================

async function processMessagingEvent(
  messagingEvent: any,
  instagramAccount: InstagramAccountData,
) {
  try {
    console.log("========================================");
    console.log("INSTAGRAM MESSAGING EVENT");
    console.log("========================================");

    const senderId = messagingEvent?.sender?.id;

    const recipientId = messagingEvent?.recipient?.id;

    const message = messagingEvent?.message;

    // =======================================================
    // POSTBACK
    // =======================================================

    const postbackPayload = messagingEvent?.postback?.payload
      ? String(messagingEvent.postback.payload)
      : null;

    const postbackTitle = messagingEvent?.postback?.title
      ? String(messagingEvent.postback.title)
      : null;

    if (postbackPayload) {
      console.log("========================================");
      console.log("INSTAGRAM POSTBACK EVENT");
      console.log("========================================");

      console.log("Sender ID:", senderId ?? "undefined");

      console.log("Recipient ID:", recipientId ?? "undefined");

      console.log("Postback title:", postbackTitle ?? "undefined");

      console.log("Postback payload:", postbackPayload);

      await processInstagramPostback(
        {
          senderId,
          recipientId,
          payload: postbackPayload,
          title: postbackTitle,
        },
        instagramAccount,
      );

      console.log("========================================");

      return;
    }

    // =======================================================
    // Ignore non-message events
    // =======================================================

    if (!message) {
      console.log("IGNORING NON-MESSAGE INSTAGRAM EVENT");

      console.log("Sender ID:", senderId ?? "undefined");

      console.log("Recipient ID:", recipientId ?? "undefined");

      if (messagingEvent?.read) {
        console.log("Event type: READ");
      } else if (messagingEvent?.delivery) {
        console.log("Event type: DELIVERY");
      } else if (messagingEvent?.reaction) {
        console.log("Event type: REACTION");
      } else {
        console.log("Event type: OTHER");
      }

      console.log("No message object exists. Skipping automation processing.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // Extract message
    // =======================================================

    const messageId = message?.mid ? String(message.mid) : null;

    const messageText = typeof message?.text === "string" ? message.text : null;

    const isEcho = message?.is_echo === true;

    const quickReplyPayload = message?.quick_reply?.payload
      ? String(message.quick_reply.payload)
      : null;

    const attachments = Array.isArray(message?.attachments)
      ? message.attachments
      : [];

    // =======================================================
    // Detect Story Reply
    // =======================================================

    const storyReply = extractStoryReplyData(message);

    console.log("Instagram account:", instagramAccount.igUsername);

    console.log("Sender ID:", senderId);

    console.log("Recipient ID:", recipientId);

    console.log("Message ID:", messageId);

    console.log("Message text:", messageText);

    console.log("Quick reply payload:", quickReplyPayload);

    console.log("Attachments:", attachments.length);

    console.log("Is echo:", isEcho);

    console.log("Is Story Reply:", storyReply.isStoryReply);

    console.log("Story ID:", storyReply.storyId);

    console.log("Story URL:", storyReply.storyUrl);

    // =======================================================
    // Ignore outgoing echo
    // =======================================================

    if (isEcho) {
      console.log("This is an outgoing message echo.");

      console.log("Ignoring as incoming message.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // Incoming message must have sender
    // =======================================================

    if (!senderId) {
      console.warn("Incoming Instagram message has no sender ID.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // STORY REPLY
    //
    // IMPORTANT:
    // This MUST happen before normal DM automation.
    // =======================================================

    if (storyReply.isStoryReply) {
      console.log("========================================");
      console.log("STORY REPLY DETECTED - BYPASSING NORMAL DM");
      console.log("========================================");

      await processInstagramStoryReply(
        {
          messagingEvent,
          message,
          messageId,
          senderId: String(senderId),
          recipientId: recipientId ? String(recipientId) : null,
          messageText,
          attachments,
          storyId: storyReply.storyId,
          storyUrl: storyReply.storyUrl,
        },
        instagramAccount,
      );

      console.log("========================================");

      return;
    }

    // =======================================================
    // Normal DM continues below
    // =======================================================

    console.log("REAL INCOMING INSTAGRAM MESSAGE");

    console.log("Sender Instagram-scoped ID:", senderId);

    console.log("Incoming message:", messageText || "[non-text message]");

    // =======================================================
    // Prevent duplicate message processing
    // =======================================================

    if (messageId) {
      const existingMessage = await prisma.conversationMessage.findUnique({
        where: {
          igMessageId: messageId,
        },
      });

      if (existingMessage) {
        console.log("Incoming Instagram message already processed:", messageId);

        console.log("Skipping duplicate webhook event.");

        console.log("========================================");

        return;
      }
    }

    // =======================================================
    // Customer / participant ID
    // =======================================================

    const participantId = String(senderId);

    // =======================================================
    // Find or create conversation
    // =======================================================

    let conversation = await prisma.conversation.findUnique({
      where: {
        instagramAccountId_participantId: {
          instagramAccountId: instagramAccount.id,
          participantId,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: instagramAccount.userId,
          instagramAccountId: instagramAccount.id,
          igUserId: participantId,
          participantId,
          isActive: true,
          lastMessageAt: new Date(),
        },
      });

      console.log("New Instagram conversation created:", conversation.id);
    } else {
      console.log("Existing Instagram conversation found:", conversation.id);

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          lastMessageAt: new Date(),
          isActive: true,
        },
      });
    }

    // =======================================================
    // Find active DM automation
    // =======================================================

    const automation = await findMatchingAutomation({
      instagramAccountId: instagramAccount.id,
      triggerType: "DM",
    });

    if (automation) {
      console.log("DM automation found:", automation.id);
    } else {
      console.log("No active DM automation found.");
    }

    // =======================================================
    // Resolve Quick Reply
    // =======================================================

    let selectedQuickReplyId: string | null = null;

    if (quickReplyPayload && automation) {
      console.log("Resolving Quick Reply payload:", quickReplyPayload);

      const selectedQuickReply = automation.messages
        .flatMap((automationMessage) => automationMessage.quickReplies)
        .find((quickReply) => quickReply.payload === quickReplyPayload);

      if (selectedQuickReply) {
        selectedQuickReplyId = selectedQuickReply.id;

        console.log("========================================");

        console.log("QUICK REPLY SELECTED");

        console.log("Quick Reply ID:", selectedQuickReply.id);

        console.log("Quick Reply title:", selectedQuickReply.title);

        console.log("Quick Reply payload:", selectedQuickReply.payload);

        console.log(
          "Next Message ID:",
          selectedQuickReply.nextMessageId ?? "NONE",
        );

        console.log("========================================");
      } else {
        console.warn(
          "Quick reply payload does not belong to this automation:",
          quickReplyPayload,
        );
      }
    } else if (quickReplyPayload && !automation) {
      console.warn("Quick reply received but no active DM automation exists.");
    }

    // =======================================================
    // Determine incoming message type
    // =======================================================

    let incomingMessageType:
      | "TEXT"
      | "QUICK_REPLY"
      | "IMAGE"
      | "VIDEO"
      | "AUDIO"
      | "STICKER"
      | "REACTION" = "TEXT";

    let incomingMediaUrl: string | null = null;

    if (quickReplyPayload) {
      incomingMessageType = "QUICK_REPLY";
    } else if (attachments.length > 0) {
      const attachmentType = String(attachments[0]?.type ?? "").toLowerCase();

      const attachmentUrl = attachments[0]?.payload?.url ?? null;

      incomingMediaUrl = attachmentUrl;

      if (attachmentType === "image") {
        incomingMessageType = "IMAGE";
      } else if (attachmentType === "video") {
        incomingMessageType = "VIDEO";
      } else if (attachmentType === "audio" || attachmentType === "voice") {
        incomingMessageType = "AUDIO";
      } else if (attachmentType === "sticker") {
        incomingMessageType = "STICKER";
      } else {
        incomingMessageType = "TEXT";
      }
    }

    // =======================================================
    // Save incoming message
    // =======================================================

    const incomingConversationMessage = await prisma.conversationMessage.create(
      {
        data: {
          conversationId: conversation.id,

          direction: "INBOUND",

          messageType: incomingMessageType,

          text: messageText,

          mediaUrl: incomingMediaUrl,

          mediaId: null,

          igMessageId: messageId,

          quickReplyId: selectedQuickReplyId,

          createdAt: new Date(),
        },
      },
    );

    console.log(
      "Incoming Instagram message saved:",
      incomingConversationMessage.id,
    );

    console.log("Incoming message type:", incomingMessageType);

    // =======================================================
    // No DM automation
    // =======================================================

    if (!automation) {
      console.log("No active DM automation found.");

      console.log("Message was still saved in conversation.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // Optional DM reaction
    //
    // Only react when the user enabled:
    // likeIncomingDm = true
    // =======================================================

    if (automation.likeIncomingDm && messageId) {
      console.log("========================================");
      console.log("DM REACTION ENABLED");
      console.log("========================================");

      console.log("Reacting to incoming DM:", {
        messageId,
        recipientId: participantId,
        reaction: "love",
      });

      const reactionResult = await reactToInstagramMessage({
        instagramAccountId: instagramAccount.id,
        recipientId: participantId,
        messageId,
        reaction: "love",
      });

      console.log("DM reaction result:", reactionResult);

      console.log("========================================");
    } else {
      console.log(
        "DM reaction skipped:",
        !automation.likeIncomingDm
          ? "likeIncomingDm is disabled"
          : "messageId is missing",
      );
    }

    // =======================================================
    // Execute DM automation
    // =======================================================

    console.log("========================================");

    console.log("EXECUTING DM AUTOMATION");

    console.log("Automation ID:", automation.id);

    console.log("Selected Quick Reply ID:", selectedQuickReplyId ?? "NONE");

    console.log("Participant ID:", participantId);

    console.log("========================================");

    const result = await executeAutomation({
      automationId: automation.id,

      instagramAccountId: instagramAccount.id,

      participantId,

      igUserId: participantId,

      selectedQuickReplyId,
    });

    console.log("DM automation execution result:", result);

    console.log("========================================");
  } catch (error) {
    console.error("Error processing Instagram messaging event:", error);

    console.log("========================================");
  }
}

// =========================================================
// Process Instagram Story Reply
// =========================================================

async function processInstagramStoryReply(
  {
    messagingEvent,
    message,
    messageId,
    senderId,
    recipientId,
    messageText,
    attachments,
    storyId,
    storyUrl,
  }: {
    messagingEvent: any;
    message: any;
    messageId: string | null;
    senderId: string;
    recipientId: string | null;
    messageText: string | null;
    attachments: any[];
    storyId: string | null;
    storyUrl: string | null;
  },
  instagramAccount: InstagramAccountData,
) {
  try {
    console.log("========================================");
    console.log("INSTAGRAM STORY REPLY");
    console.log("========================================");

    console.log("Instagram account:", instagramAccount.igUsername);

    console.log("Sender ID:", senderId);

    console.log("Recipient ID:", recipientId);

    console.log("Message ID:", messageId);

    console.log("Story ID:", storyId);

    console.log("Story URL:", storyUrl);

    console.log("Story Reply text:", messageText);

    console.log("Attachments:", attachments.length);

    console.log("Raw Story Reply message:", JSON.stringify(message, null, 2));

    console.log(
      "Raw messaging event:",
      JSON.stringify(messagingEvent, null, 2),
    );

    // =======================================================
    // Validate Story ID
    // =======================================================

    if (!storyId) {
      console.warn("Story Reply detected but Story ID was not found.");

      return;
    }

    // =======================================================
    // Validate text
    // =======================================================

    if (!messageText || !messageText.trim()) {
      console.log("Story Reply has no text.");

      return;
    }

    // =======================================================
    // Normalize keyword
    // =======================================================

    const normalizedKeyword = normalizeText(messageText);

    console.log("Normalized Story Reply keyword:", normalizedKeyword);

    // =======================================================
    // Participant
    // =======================================================

    const participantId = String(senderId);

    // =======================================================
    // Prevent duplicate webhook event
    // =======================================================

    if (messageId) {
      const existingMessage = await prisma.conversationMessage.findUnique({
        where: {
          igMessageId: messageId,
        },
      });

      if (existingMessage) {
        console.log("Story Reply already processed:", messageId);

        return;
      }
    }

    // =======================================================
    // Find / create conversation
    // =======================================================

    let conversation = await prisma.conversation.findUnique({
      where: {
        instagramAccountId_participantId: {
          instagramAccountId: instagramAccount.id,
          participantId,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: instagramAccount.userId,

          instagramAccountId: instagramAccount.id,

          igUserId: participantId,

          participantId,

          isActive: true,

          lastMessageAt: new Date(),
        },
      });

      console.log("New conversation created for Story Reply:", conversation.id);
    } else {
      conversation = await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          igUserId: participantId,

          lastMessageAt: new Date(),

          isActive: true,
        },
      });

      console.log(
        "Existing conversation updated for Story Reply:",
        conversation.id,
      );
    }

    // =======================================================
    // Determine incoming message type
    // =======================================================

    let incomingMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STICKER" =
      "TEXT";

    let incomingMediaUrl: string | null = null;

    if (attachments.length > 0) {
      const attachmentType = String(attachments[0]?.type ?? "").toLowerCase();

      incomingMediaUrl = attachments[0]?.payload?.url ?? null;

      if (attachmentType === "image") {
        incomingMessageType = "IMAGE";
      } else if (attachmentType === "video") {
        incomingMessageType = "VIDEO";
      } else if (attachmentType === "audio" || attachmentType === "voice") {
        incomingMessageType = "AUDIO";
      } else if (attachmentType === "sticker") {
        incomingMessageType = "STICKER";
      }
    }

    // =======================================================
    // Save Story Reply as inbound message
    // =======================================================

    const savedMessage = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,

        direction: "INBOUND",

        messageType: incomingMessageType,

        text: messageText,

        mediaUrl: incomingMediaUrl,

        mediaId: storyId,

        igMessageId: messageId,

        quickReplyId: null,

        createdAt: new Date(),
      },
    });

    console.log("Story Reply saved:", savedMessage.id);

    // =======================================================
    // Find STORY_REPLY automation
    // =======================================================

    console.log("Looking for STORY_REPLY automation...");

    console.log({
      instagramAccountId: instagramAccount.id,
      triggerType: "STORY_REPLY_KEYWORD",
      keyword: normalizedKeyword,
      mediaId: storyId,
    });

    const automation = await findMatchingAutomation({
      instagramAccountId: instagramAccount.id,

      triggerType: "STORY_REPLY_KEYWORD",

      keyword: normalizedKeyword,

      mediaId: storyId,
    });

    // =======================================================
    // No matching automation
    // =======================================================

    if (!automation) {
      console.log("No matching STORY_REPLY automation found.");

      console.log({
        instagramAccountId: instagramAccount.id,
        triggerType: "STORY_REPLY_KEYWORD",
        keyword: normalizedKeyword,
        mediaId: storyId,
      });

      console.log("========================================");

      return;
    }

    // =======================================================
    // Automation matched
    // =======================================================

    console.log("========================================");

    console.log("STORY REPLY AUTOMATION MATCHED");

    console.log("Automation ID:", automation.id);

    console.log("Trigger type:", automation.triggerType);

    console.log("Keyword:", automation.keyword);

    console.log("Story ID:", storyId);

    console.log("Direct reply text:", automation.replyText ?? "NONE");

    console.log("Message count:", automation.messages.length);

    console.log("Like Story Reply:", automation.likeStoryReply);

    console.log("========================================");

    // =======================================================
    // Optional Story Reply reaction
    //
    // Only react when:
    // likeStoryReply = true
    // =======================================================

    if (automation.likeStoryReply && messageId) {
      console.log("========================================");
      console.log("STORY REPLY REACTION ENABLED");
      console.log("========================================");

      console.log("Reacting to Story Reply:", {
        messageId,
        recipientId: participantId,
        reaction: "love",
      });

      const reactionResult = await reactToInstagramMessage({
        instagramAccountId: instagramAccount.id,
        recipientId: participantId,
        messageId,
        reaction: "love",
      });

      console.log("Story Reply reaction result:", reactionResult);

      console.log("========================================");
    } else {
      console.log(
        "Story Reply reaction skipped:",
        !automation.likeStoryReply
          ? "likeStoryReply is disabled"
          : "messageId is missing",
      );
    }

    // =======================================================
    // Validate automation output
    //
    // Allowed:
    //
    // 1. Direct reply only
    // 2. Flow only
    // 3. Direct reply + Flow
    // 4. Neither -> nothing to send
    // =======================================================

    const hasDirectReply = Boolean(
      automation.replyText && automation.replyText.trim(),
    );

    const hasFlowMessages = automation.messages.length > 0;

    if (!hasDirectReply && !hasFlowMessages && !automation.likeStoryReply) {
      console.log("Story Reply automation has no reply, flow, or reaction.");

      console.log("Nothing will be sent.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // Get valid access token
    // =======================================================

    let accessToken: string;

    try {
      accessToken = await getValidInstagramAccessToken(instagramAccount.id);
    } catch (error) {
      console.error(
        "Could not get valid Instagram access token for Story Reply:",
        error,
      );

      return;
    }

    // =======================================================
    // 1. DIRECT REPLY
    //
    // Story Reply -> normal Instagram Messages API
    //
    // IMPORTANT:
    // This is NOT the same as Comment private reply.
    // For Story Reply we use:
    //
    // recipient.id = sender Instagram-scoped ID
    // =======================================================

    let directReplySent = false;

    if (hasDirectReply) {
      console.log("========================================");

      console.log("SENDING STORY REPLY DIRECT MESSAGE");

      console.log("Recipient Instagram-scoped ID:", participantId);

      console.log("Reply text:", automation.replyText);

      directReplySent = await sendStoryReplyMessage({
        igUserId: instagramAccount.igUserId,

        participantId,

        accessToken,

        replyText: automation.replyText!.trim(),
      });

      console.log("Story Reply direct message sent:", directReplySent);

      console.log("========================================");
    } else {
      console.log("No direct reply text configured.");
    }

    // =======================================================
    // 2. FLOW AUTOMATION
    //
    // If Flow messages exist, execute them.
    //
    // executeAutomation handles:
    // TEXT
    // IMAGE
    // VIDEO
    // AUDIO
    // SHOWCASE
    // FORM
    // QUICK REPLY
    // =======================================================

    let automationExecuted = false;

    if (hasFlowMessages) {
      console.log("========================================");

      console.log("EXECUTING STORY REPLY FLOW AUTOMATION");

      console.log("Automation ID:", automation.id);

      console.log("Message count:", automation.messages.length);

      console.log("Participant ID:", participantId);

      console.log("========================================");

      const result = await executeAutomation({
        automationId: automation.id,

        instagramAccountId: instagramAccount.id,

        participantId,

        igUserId: participantId,

        selectedQuickReplyId: null,
      });

      automationExecuted = result.success && result.executed;

      console.log("Story Reply flow execution result:", result);
    } else {
      console.log("No Story Reply Flow messages configured.");
    }

    // =======================================================
    // Final result
    // =======================================================

    console.log("========================================");

    console.log("STORY REPLY AUTOMATION RESULT");

    console.log("Direct reply sent:", directReplySent);

    console.log("Flow executed:", automationExecuted);

    console.log("Has direct reply:", hasDirectReply);

    console.log("Flow message count:", automation.messages.length);

    console.log("========================================");
  } catch (error) {
    console.error("Error processing Instagram Story Reply:", error);

    console.log("========================================");
  }
}

// =========================================================
// Send direct message as response to Instagram Story Reply
// =========================================================

async function sendStoryReplyMessage({
  igUserId,
  participantId,
  accessToken,
  replyText,
}: {
  igUserId: string;
  participantId: string;
  accessToken: string;
  replyText: string;
}): Promise<boolean> {
  const url =
    `https://graph.instagram.com/` +
    `${INSTAGRAM_API_VERSION}/` +
    `${igUserId}/messages`;

  const requestBody = {
    recipient: {
      id: participantId,
    },

    message: {
      text: replyText,
    },
  };

  console.log("========================================");

  console.log("SENDING STORY REPLY MESSAGE");

  console.log("Instagram Messages API URL:", url);

  console.log("Story Reply recipient:", participantId);

  console.log(
    "Story Reply request body:",
    JSON.stringify(
      {
        recipient: {
          id: participantId,
        },
        message: {
          text: replyText,
        },
      },
      null,
      2,
    ),
  );

  for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      console.log(`Story Reply message attempt ${attempt}/${MAX_API_RETRIES}`);

      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${accessToken}`,

          Accept: "application/json",
        },

        body: JSON.stringify(requestBody),

        cache: "no-store",
      });

      const responseText = await response.text();

      let responseData: unknown;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = responseText;
      }

      if (response.ok) {
        console.log("========================================");

        console.log("INSTAGRAM STORY REPLY MESSAGE SENT SUCCESSFULLY");

        console.log("HTTP Status:", response.status);

        console.log("Instagram API response:", responseData);

        console.log("========================================");

        return true;
      }

      console.error(`Story Reply message attempt ${attempt} failed.`);

      console.error("HTTP Status:", response.status);

      console.error("Instagram API response:", responseData);

      if (attempt < MAX_API_RETRIES) {
        const delay = attempt * 1000;

        console.log(`Waiting ${delay}ms before Story Reply retry...`);

        await sleep(delay);
      }
    } catch (error) {
      console.error(
        `Story Reply message request error on attempt ${attempt}:`,
        error,
      );

      if (attempt < MAX_API_RETRIES) {
        const delay = attempt * 1000;

        console.log(`Waiting ${delay}ms before Story Reply retry...`);

        await sleep(delay);
      }
    }
  }

  console.error("========================================");

  console.error("INSTAGRAM STORY REPLY MESSAGE FAILED");

  console.error("========================================");

  return false;
}

// =========================================================
// Process Instagram Ice Breaker / Persistent Menu
// postback event
// =========================================================

async function processInstagramPostback(
  {
    senderId,
    recipientId,
    payload,
    title,
  }: {
    senderId: any;
    recipientId: any;
    payload: string;
    title: string | null;
  },
  instagramAccount: InstagramAccountData,
) {
  try {
    if (!senderId) {
      console.warn("Instagram postback has no sender ID.");

      return;
    }

    const participantId = String(senderId);

    console.log("Processing Instagram postback:", {
      payload,
      title,
      participantId,
      recipientId,
      instagramAccountId: instagramAccount.id,
    });

    // =======================================================
    // Ice Breaker
    // =======================================================

    const iceBreaker = await prisma.iceBreaker.findFirst({
      where: {
        instagramAccountId: instagramAccount.id,

        payload,

        isActive: true,
      },

      include: {
        automation: {
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
        },
      },
    });

    if (iceBreaker) {
      console.log("========================================");

      console.log("ICE BREAKER SELECTED");

      console.log("Ice Breaker ID:", iceBreaker.id);

      console.log("Question:", iceBreaker.question);

      console.log("Payload:", iceBreaker.payload);

      console.log("Automation ID:", iceBreaker.automationId);

      console.log("Automation active:", iceBreaker.automation.isActive);

      console.log("========================================");

      await executeEntryPointAutomation({
        automationId: iceBreaker.automationId,

        participantId,

        igUserId: participantId,

        instagramAccount,

        source: "ICE_BREAKER",

        sourceId: iceBreaker.id,

        sourceTitle: iceBreaker.question,

        payload,
      });

      return;
    }

    // =======================================================
    // Persistent Menu
    // =======================================================

    const persistentMenuItem = await prisma.persistentMenuItem.findFirst({
      where: {
        payload,

        persistentMenu: {
          instagramAccountId: instagramAccount.id,

          enabled: true,
        },
      },

      include: {
        automation: {
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
        },

        persistentMenu: true,
      },
    });

    if (persistentMenuItem) {
      console.log("========================================");

      console.log("PERSISTENT MENU ITEM SELECTED");

      console.log("Persistent Menu Item ID:", persistentMenuItem.id);

      console.log("Title:", persistentMenuItem.title);

      console.log("Payload:", persistentMenuItem.payload);

      console.log("Automation ID:", persistentMenuItem.automationId ?? "NONE");

      console.log("Menu ID:", persistentMenuItem.persistentMenuId);

      console.log("========================================");

      if (!persistentMenuItem.automationId || !persistentMenuItem.automation) {
        console.warn(
          "Persistent Menu item is not connected to an active automation.",
        );

        await saveEntryPointInteraction({
          instagramAccount,

          participantId,

          title: persistentMenuItem.title,

          payload,

          source: "PERSISTENT_MENU",
        });

        return;
      }

      await executeEntryPointAutomation({
        automationId: persistentMenuItem.automationId,

        participantId,

        igUserId: participantId,

        instagramAccount,

        source: "PERSISTENT_MENU",

        sourceId: persistentMenuItem.id,

        sourceTitle: persistentMenuItem.title,

        payload,
      });

      return;
    }

    // =======================================================
    // Unknown postback
    // =======================================================

    console.warn("Unknown Instagram postback payload:", payload);

    console.log("No Ice Breaker or Persistent Menu item matched.");

    await saveEntryPointInteraction({
      instagramAccount,

      participantId,

      title,

      payload,

      source: "UNKNOWN_POSTBACK",
    });
  } catch (error) {
    console.error("Error processing Instagram postback:", error);
  }
}

// =========================================================
// Execute Automation triggered by Ice Breaker / Menu
// =========================================================

async function executeEntryPointAutomation({
  automationId,
  participantId,
  igUserId,
  instagramAccount,
  source,
  sourceId,
  sourceTitle,
  payload,
}: {
  automationId: string;
  participantId: string;
  igUserId: string;
  instagramAccount: InstagramAccountData;
  source: "ICE_BREAKER" | "PERSISTENT_MENU";
  sourceId: string;
  sourceTitle: string;
  payload: string;
}) {
  try {
    console.log("========================================");

    console.log("EXECUTING ENTRY POINT AUTOMATION");

    console.log("========================================");

    console.log("Source:", source);

    console.log("Source ID:", sourceId);

    console.log("Source title:", sourceTitle);

    console.log("Payload:", payload);

    console.log("Automation ID:", automationId);

    console.log("Participant ID:", participantId);

    console.log("========================================");

    const automation = await prisma.automation.findFirst({
      where: {
        id: automationId,

        instagramAccountId: instagramAccount.id,

        isActive: true,
      },

      select: {
        id: true,
      },
    });

    if (!automation) {
      console.warn(
        "Entry point automation not found or inactive:",
        automationId,
      );

      await saveEntryPointInteraction({
        instagramAccount,

        participantId,

        title: sourceTitle,

        payload,

        source,
      });

      return;
    }

    const conversation = await getOrCreateConversation({
      instagramAccount,

      participantId,

      igUserId,
    });

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,

        direction: "INBOUND",

        messageType: "TEXT",

        text: sourceTitle || payload,

        mediaUrl: null,

        mediaId: null,

        igMessageId: null,

        quickReplyId: null,

        createdAt: new Date(),
      },
    });

    const result = await executeAutomation({
      automationId,

      instagramAccountId: instagramAccount.id,

      participantId,

      igUserId,

      selectedQuickReplyId: null,
    });

    console.log("Entry point automation result:", {
      source,
      sourceId,
      automationId,
      payload,
      result,
    });

    console.log("========================================");
  } catch (error) {
    console.error(`Error executing ${source} automation:`, error);
  }
}

// =========================================================
// Get or create Instagram conversation
// =========================================================

async function getOrCreateConversation({
  instagramAccount,
  participantId,
  igUserId,
}: {
  instagramAccount: InstagramAccountData;
  participantId: string;
  igUserId: string;
}) {
  let conversation = await prisma.conversation.findUnique({
    where: {
      instagramAccountId_participantId: {
        instagramAccountId: instagramAccount.id,

        participantId,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: instagramAccount.userId,

        instagramAccountId: instagramAccount.id,

        igUserId,

        participantId,

        isActive: true,

        lastMessageAt: new Date(),
      },
    });

    console.log(
      "New Instagram conversation created for entry point:",
      conversation.id,
    );
  } else {
    conversation = await prisma.conversation.update({
      where: {
        id: conversation.id,
      },

      data: {
        igUserId,

        lastMessageAt: new Date(),

        isActive: true,
      },
    });

    console.log(
      "Existing Instagram conversation updated for entry point:",
      conversation.id,
    );
  }

  return conversation;
}

// =========================================================
// Save Ice Breaker / Persistent Menu interaction
// =========================================================

async function saveEntryPointInteraction({
  instagramAccount,
  participantId,
  title,
  payload,
  source,
}: {
  instagramAccount: InstagramAccountData;
  participantId: string;
  title: string | null;
  payload: string;
  source: "ICE_BREAKER" | "PERSISTENT_MENU" | "UNKNOWN_POSTBACK";
}) {
  try {
    const conversation = await getOrCreateConversation({
      instagramAccount,

      participantId,

      igUserId: participantId,
    });

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,

        direction: "INBOUND",

        messageType: "TEXT",

        text: title || payload,

        mediaUrl: null,

        mediaId: null,

        igMessageId: null,

        quickReplyId: null,

        createdAt: new Date(),
      },
    });

    console.log("Entry point interaction saved:", {
      source,
      title,
      payload,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("Could not save Instagram entry point interaction:", error);
  }
}

// =========================================================
// Process Instagram comment event
// =========================================================

async function processCommentEvent(
  value: any,
  instagramAccount: InstagramAccountData,
) {
  try {
    if (!value) {
      console.warn("Instagram comment webhook value is empty");

      return;
    }

    const igCommentId = value.id;

    const igMediaId = value.media?.id;

    const text = value.text;

    const username = value.from?.username;

    if (!igCommentId || !igMediaId || !text || !username) {
      console.warn("Incomplete Instagram comment payload:", value);

      return;
    }

    console.log("========================================");

    console.log("INSTAGRAM COMMENT");

    console.log("commentId:", igCommentId);

    console.log("mediaId:", igMediaId);

    console.log("username:", username);

    console.log("text:", text);

    console.log("========================================");

    const existingComment = await prisma.comment.findUnique({
      where: {
        igCommentId,
      },
    });

    if (existingComment) {
      console.log("Comment already exists:", igCommentId);

      return;
    }

    const comment = await prisma.comment.create({
      data: {
        userId: instagramAccount.userId,

        igMediaId,

        igCommentId,

        text,

        username,

        replied: false,
      },
    });

    console.log("Instagram comment saved:", comment.id);

    const normalizedCommentText = normalizeText(text);

    console.log("Normalized comment text:", normalizedCommentText);

    const matchedAutomation = await findMatchingAutomation({
      instagramAccountId: instagramAccount.id,

      triggerType: "COMMENT_KEYWORD",

      keyword: normalizedCommentText,

      mediaId: igMediaId,
    });

    if (!matchedAutomation) {
      console.log(
        "No matching COMMENT automation found:",
        normalizedCommentText,
      );

      console.log("========================================");

      return;
    }

    console.log("========================================");

    console.log("COMMENT AUTOMATION MATCHED");

    console.log("Automation ID:", matchedAutomation.id);

    console.log("Trigger type:", matchedAutomation.triggerType);

    console.log("Keyword:", matchedAutomation.keyword);

    console.log("Comment reply text:", matchedAutomation.commentReplyText);

    console.log("Private reply text:", matchedAutomation.replyText);

    console.log("Instagram Comment ID:", igCommentId);

    console.log("Username:", username);

    console.log("========================================");

    let accessToken: string;

    try {
      accessToken = await getValidInstagramAccessToken(instagramAccount.id);
    } catch (error) {
      console.error("Could not get valid Instagram access token:", error);

      return;
    }

    let publicCommentReplySent = false;

    if (
      matchedAutomation.commentReplyText &&
      matchedAutomation.commentReplyText.trim()
    ) {
      publicCommentReplySent = await sendPublicCommentReply({
        igCommentId,

        accessToken,

        replyText: matchedAutomation.commentReplyText,
      });
    } else {
      console.log(
        "No public comment reply text configured. Skipping public reply.",
      );
    }

    let automationExecuted = false;

    if (matchedAutomation.messages.length > 0) {
      const commenterIgUserId = value.from?.id;

      if (!commenterIgUserId) {
        console.warn(
          "Comment does not contain commenter Instagram-scoped ID. Flow cannot execute.",
        );
      } else {
        const result = await executeAutomation({
          automationId: matchedAutomation.id,

          instagramAccountId: instagramAccount.id,

          participantId: String(commenterIgUserId),

          igUserId: String(commenterIgUserId),
        });

        automationExecuted = result.success && result.executed;

        console.log("Comment automation engine result:", result);
      }
    }

    let privateReplySent = false;

    if (
      matchedAutomation.messages.length === 0 &&
      matchedAutomation.replyText &&
      matchedAutomation.replyText.trim()
    ) {
      const commenterIgUserId = value.from?.id;

      if (!commenterIgUserId) {
        console.warn(
          "Commenter Instagram-scoped ID is missing. Private reply cannot be sent.",
        );
      } else {
        privateReplySent = await sendPrivateReply({
          igUserId: instagramAccount.igUserId,

          igCommentId,

          accessToken,

          replyText: matchedAutomation.replyText,
        });
      }
    } else if (matchedAutomation.messages.length === 0) {
      console.log("No legacy private reply configured. Skipping.");
    }

    if (privateReplySent || automationExecuted) {
      await prisma.comment.update({
        where: {
          id: comment.id,
        },

        data: {
          replied: true,

          replyText: matchedAutomation.replyText ?? null,
        },
      });

      console.log("Comment marked as replied.");
    }

    console.log("========================================");

    console.log("INSTAGRAM AUTOMATION RESULT");

    console.log("Public comment reply sent:", publicCommentReplySent);

    console.log("Automation engine executed:", automationExecuted);

    console.log("Legacy private reply sent:", privateReplySent);

    console.log("========================================");
  } catch (error) {
    console.error("Error processing Instagram comment:", error);
  }
}

// =========================================================
// Send public reply under Instagram comment
// =========================================================

async function sendPublicCommentReply({
  igCommentId,
  accessToken,
  replyText,
}: {
  igCommentId: string;
  accessToken: string;
  replyText: string;
}): Promise<boolean> {
  const url =
    `https://graph.instagram.com/` +
    `${INSTAGRAM_API_VERSION}/` +
    `${igCommentId}/replies`;

  console.log("========================================");

  console.log("SENDING PUBLIC INSTAGRAM COMMENT REPLY");

  console.log("Instagram comment reply URL:", url);

  for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      console.log(`Public comment reply attempt ${attempt}/${MAX_API_RETRIES}`);

      const body = new URLSearchParams({
        message: replyText,
      });

      const response = await fetch(url, {
        method: "POST",

        headers: {
          Authorization: `Bearer ${accessToken}`,

          "Content-Type": "application/x-www-form-urlencoded",

          Accept: "application/json",
        },

        body,

        cache: "no-store",
      });

      const responseText = await response.text();

      let responseData: unknown;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = responseText;
      }

      if (response.ok) {
        console.log("INSTAGRAM PUBLIC COMMENT REPLY SENT SUCCESSFULLY");

        console.log("Instagram API response:", responseData);

        console.log("========================================");

        return true;
      }

      console.error(`Public comment reply attempt ${attempt} failed.`);

      console.error("HTTP Status:", response.status);

      console.error("Instagram API response:", responseData);

      if (attempt < MAX_API_RETRIES) {
        const delay = attempt * 1000;

        console.log(`Waiting ${delay}ms before public reply retry...`);

        await sleep(delay);
      }
    } catch (error) {
      console.error(
        `Public comment reply request error on attempt ${attempt}:`,
        error,
      );

      if (attempt < MAX_API_RETRIES) {
        const delay = attempt * 1000;

        await sleep(delay);
      }
    }
  }

  console.error("INSTAGRAM PUBLIC COMMENT REPLY FAILED");

  console.log("========================================");

  return false;
}

// =========================================================
// Send private reply to Instagram commenter
// =========================================================

async function sendPrivateReply({
  igUserId,
  igCommentId,
  accessToken,
  replyText,
}: {
  igUserId: string;
  igCommentId: string;
  accessToken: string;
  replyText: string;
}): Promise<boolean> {
  const url =
    `https://graph.instagram.com/` +
    `${INSTAGRAM_API_VERSION}/` +
    `${igUserId}/messages`;

  console.log("========================================");

  console.log("SENDING INSTAGRAM PRIVATE REPLY");

  console.log("Instagram Messages API URL:", url);

  const requestBody = {
    recipient: {
      comment_id: igCommentId,
    },

    message: {
      text: replyText,
    },
  };

  for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      console.log(`Private reply attempt ${attempt}/${MAX_API_RETRIES}`);

      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${accessToken}`,

          Accept: "application/json",
        },

        body: JSON.stringify(requestBody),

        cache: "no-store",
      });

      const responseText = await response.text();

      let responseData: unknown;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = responseText;
      }

      if (response.ok) {
        console.log("INSTAGRAM PRIVATE REPLY SENT SUCCESSFULLY");

        console.log("Instagram API response:", responseData);

        console.log("========================================");

        return true;
      }

      console.error(`Private reply attempt ${attempt} failed.`);

      console.error("HTTP Status:", response.status);

      console.error("Instagram API response:", responseData);

      if (attempt < MAX_API_RETRIES) {
        const delay = attempt * 1000;

        console.log(`Waiting ${delay}ms before private reply retry...`);

        await sleep(delay);
      }
    } catch (error) {
      console.error(
        `Private reply request error on attempt ${attempt}:`,
        error,
      );

      if (attempt < MAX_API_RETRIES) {
        const delay = attempt * 1000;

        await sleep(delay);
      }
    }
  }

  console.error("INSTAGRAM PRIVATE REPLY FAILED");

  console.log("========================================");

  return false;
}
