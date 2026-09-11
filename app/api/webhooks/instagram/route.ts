import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { executeAutomation } from "@/lib/automation/execute-automation";
import { findMatchingAutomation } from "@/lib/automation/find-matching-automation";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

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
    // IMPORTANT:
    // Ignore read / delivery / reaction / postback events
    // without a message object.
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
      } else if (messagingEvent?.postback) {
        console.log("Event type: POSTBACK");
      } else {
        console.log("Event type: OTHER");
      }

      console.log("No message object exists. Skipping automation processing.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // Extract actual message data
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

    console.log("Instagram account:", instagramAccount.igUsername);

    console.log("Sender ID:", senderId);

    console.log("Recipient ID:", recipientId);

    console.log("Message ID:", messageId);

    console.log("Message text:", messageText);

    console.log("Quick reply payload:", quickReplyPayload);

    console.log("Attachments:", attachments.length);

    console.log("Is echo:", isEcho);

    // =======================================================
    // 1. Ignore outgoing message echo
    // =======================================================

    if (isEcho) {
      console.log("This is an outgoing message echo.");

      console.log("Ignoring as incoming message.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // 2. Incoming message must have sender
    // =======================================================

    if (!senderId) {
      console.warn("Incoming Instagram message has no sender ID.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // 3. Log message ID
    // =======================================================

    if (!messageId) {
      console.warn("Instagram message does not contain a message ID (mid).");
    }

    console.log("REAL INCOMING INSTAGRAM MESSAGE");

    console.log("Sender Instagram-scoped ID:", senderId);

    console.log("Incoming message:", messageText || "[non-text message]");

    // =======================================================
    // 4. Prevent duplicate message processing
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
    // 5. Customer / participant ID
    // =======================================================

    const participantId = String(senderId);

    // =======================================================
    // 6. Find or create conversation
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
    // 7. Find active DM automation
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
    // 8. Resolve Quick Reply
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
    // 9. Determine incoming message type
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

    // =======================================================
    // Quick Reply
    // =======================================================

    if (quickReplyPayload) {
      incomingMessageType = "QUICK_REPLY";
    }

    // =======================================================
    // Attachments
    // =======================================================
    else if (attachments.length > 0) {
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
    // 10. Save incoming message
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
    // 11. No DM automation
    // =======================================================

    if (!automation) {
      console.log("No active DM automation found.");

      console.log("Message was still saved in conversation.");

      console.log("========================================");

      return;
    }

    // =======================================================
    // 12. Execute automation
    //
    // Normal message:
    //
    //   Starts from automation.messages[0]
    //
    // Quick Reply:
    //
    //   Starts from QuickReply.nextMessageId
    //
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

    // =======================================================
    // 1. Extract comment data
    // =======================================================

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

    // =======================================================
    // 2. Prevent duplicate comments
    // =======================================================

    const existingComment = await prisma.comment.findUnique({
      where: {
        igCommentId,
      },
    });

    if (existingComment) {
      console.log("Comment already exists:", igCommentId);

      return;
    }

    // =======================================================
    // 3. Save comment
    // =======================================================

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

    // =======================================================
    // 4. Find matching COMMENT automation
    // =======================================================

    const normalizedCommentText = normalizeText(text);

    console.log("Normalized comment text:", normalizedCommentText);

    console.log("Looking for matching COMMENT automation...");

    const matchedAutomation = await findMatchingAutomation({
      instagramAccountId: instagramAccount.id,

      triggerType: "COMMENT_KEYWORD",

      keyword: normalizedCommentText,

      mediaId: igMediaId,
    });

    // =======================================================
    // 5. No automation matched
    // =======================================================

    if (!matchedAutomation) {
      console.log(
        "No matching COMMENT automation found:",
        normalizedCommentText,
      );

      console.log("========================================");

      return;
    }

    // =======================================================
    // 6. Automation matched
    // =======================================================

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

    // =======================================================
    // 7. Get valid Instagram token
    //
    // IMPORTANT:
    // Do NOT use instagramAccount.accessToken directly.
    // =======================================================

    let accessToken: string;

    try {
      accessToken = await getValidInstagramAccessToken(instagramAccount.id);
    } catch (error) {
      console.error("Could not get valid Instagram access token:", error);

      return;
    }

    // =======================================================
    // 8. Public comment reply
    // =======================================================

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

    // =======================================================
    // 9. Execute automation flow
    // =======================================================

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

    // =======================================================
    // 10. Legacy private reply
    // =======================================================

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

    // =======================================================
    // 11. Update database
    // =======================================================

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

    // =======================================================
    // 12. Final result
    // =======================================================

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
