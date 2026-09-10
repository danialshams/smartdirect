import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";

const MAX_API_RETRIES = 3;

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
          igUserId,
        },
      });

      if (!instagramAccount) {
        console.warn("Instagram account not found:", igUserId);

        continue;
      }

      console.log("Instagram account found:", instagramAccount.igUsername);

      console.log("Database Instagram Account ID:", instagramAccount.id);

      // =====================================================
      // 4. Process messaging events
      // =====================================================

      if (Array.isArray(entry.messaging)) {
        console.log("Messaging events received:", entry.messaging.length);

        for (const messagingEvent of entry.messaging) {
          await processMessagingEvent(
            messagingEvent,
            instagramAccount.igUsername,
          );
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

          await processCommentEvent(change.value, instagramAccount);
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
  instagramUsername: string,
) {
  try {
    console.log("========================================");
    console.log("INSTAGRAM MESSAGING EVENT");
    console.log("========================================");

    const senderId = messagingEvent?.sender?.id;
    const recipientId = messagingEvent?.recipient?.id;

    const message = messagingEvent?.message;

    const messageId = message?.mid;
    const messageText = message?.text;

    const isEcho = message?.is_echo === true;

    console.log("Instagram account:", instagramUsername);
    console.log("Sender ID:", senderId);
    console.log("Recipient ID:", recipientId);
    console.log("Message ID:", messageId);
    console.log("Message text:", messageText);
    console.log("Is echo:", isEcho);

    // =======================================================
    // Outgoing message echo
    // =======================================================

    if (isEcho) {
      console.log(
        "This is an outgoing message echo. Ignoring as incoming message.",
      );

      console.log("========================================");

      return;
    }

    // =======================================================
    // Incoming message
    // =======================================================

    if (!senderId) {
      console.warn("Incoming messaging event has no sender ID.");

      return;
    }

    console.log("REAL INCOMING INSTAGRAM MESSAGE");
    console.log("Sender Instagram-scoped ID:", senderId);
    console.log("Incoming message:", messageText || "[non-text message]");

    // =======================================================
    // Quick reply
    // =======================================================

    if (message?.quick_reply) {
      console.log("Quick reply payload:", message.quick_reply.payload);
    }

    console.log("Incoming message received successfully.");

    console.log("========================================");
  } catch (error) {
    console.error("Error processing Instagram messaging event:", error);
  }
}

// =========================================================
// Process Instagram comment event
// =========================================================

async function processCommentEvent(
  value: any,
  instagramAccount: {
    id: string;
    userId: string;
    igUserId: string;
    igUsername: string;
    accessToken: string;
  },
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
    // 4. Normalize comment text
    // =======================================================

    const normalizedCommentText = normalizeText(text);

    console.log("Normalized comment text:", normalizedCommentText);

    // =======================================================
    // 5. Find active automations
    // =======================================================

    console.log("Looking for matching automation...");

    const automations = await prisma.automation.findMany({
      where: {
        instagramAccountId: instagramAccount.id,
        isActive: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log("Active automations found:", automations.length);

    // =======================================================
    // 6. Find matching automation
    // =======================================================

    const matchedAutomation = automations.find((automation) => {
      const normalizedKeyword = normalizeText(automation.keyword);

      return normalizedCommentText === normalizedKeyword;
    });

    // =======================================================
    // 7. No automation matched
    // =======================================================

    if (!matchedAutomation) {
      console.log(
        "No matching automation found for comment:",
        normalizedCommentText,
      );

      console.log("========================================");

      return;
    }

    // =======================================================
    // 8. Automation matched
    // =======================================================

    console.log("========================================");
    console.log("AUTOMATION MATCHED");

    console.log("Automation ID:", matchedAutomation.id);
    console.log("Keyword:", matchedAutomation.keyword);
    console.log("Comment reply text:", matchedAutomation.commentReplyText);
    console.log("Private reply text:", matchedAutomation.replyText);
    console.log("Instagram Comment ID:", igCommentId);
    console.log("Username:", username);

    console.log("========================================");

    // =======================================================
    // 9. Check if already replied
    // =======================================================

    if (comment.replied) {
      console.log("Comment already marked as replied. Skipping.");

      return;
    }

    // =======================================================
    // 10. Check access token
    // =======================================================

    if (!instagramAccount.accessToken) {
      console.error("Instagram access token is missing.");

      return;
    }

    // =======================================================
    // 11. Small delay
    // Give Instagram time to fully register the comment.
    // =======================================================

    console.log("Waiting 1000ms before sending Instagram replies...");

    await sleep(1000);

    // =======================================================
    // 12. Send public comment reply
    // =======================================================

    let publicCommentReplySent = false;

    if (
      matchedAutomation.commentReplyText &&
      matchedAutomation.commentReplyText.trim()
    ) {
      publicCommentReplySent = await sendPublicCommentReply({
        igCommentId,
        accessToken: instagramAccount.accessToken,
        replyText: matchedAutomation.commentReplyText,
      });
    } else {
      console.log(
        "No public comment reply text configured. Skipping public reply.",
      );
    }

    // =======================================================
    // 13. Send private reply
    // =======================================================

    const privateReplySent = await sendPrivateReply({
      igUserId: instagramAccount.igUserId,
      igCommentId,
      accessToken: instagramAccount.accessToken,
      replyText: matchedAutomation.replyText,
    });

    // =======================================================
    // 14. Update database
    // =======================================================

    if (privateReplySent) {
      await prisma.comment.update({
        where: {
          id: comment.id,
        },
        data: {
          replied: true,
          replyText: matchedAutomation.replyText,
        },
      });

      console.log("Comment marked as replied.");
    }

    // =======================================================
    // 15. Final result
    // =======================================================

    console.log("========================================");
    console.log("INSTAGRAM AUTOMATION RESULT");

    console.log("Public comment reply sent:", publicCommentReplySent);
    console.log("Private reply sent:", privateReplySent);

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
  const url = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${igCommentId}/replies`;

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
        },
        body,
        cache: "no-store",
      });

      const responseText = await response.text();

      let responseData: unknown;

      try {
        responseData = JSON.parse(responseText);
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
  const url = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${igUserId}/messages`;

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
        },
        body: JSON.stringify(requestBody),
        cache: "no-store",
      });

      const responseText = await response.text();

      let responseData: unknown;

      try {
        responseData = JSON.parse(responseText);
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
