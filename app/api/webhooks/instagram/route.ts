import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { prisma } from "@/lib/prisma";
import {
  claimInstagramWebhookEvent,
  completeInstagramWebhookEvent,
  failInstagramWebhookEvent,
  retryInstagramWebhookEvent,
} from "@/lib/idempotency/webhook";
import { normalizeInstagramWebhookEvent } from "@/lib/webhook/normalize";
import { enqueueInstagramWebhookEvent } from "@/lib/webhook/queue";
import { processInstagramWebhookQueueJob } from "@/lib/webhook/workflow";

import { executeAutomation } from "@/lib/automation/execute-automation";
import { findAutomationByQuickReplyPayload, findMatchingAutomation } from "@/lib/automation/find-matching-automation";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { reactToInstagramMessage } from "@/lib/instagram/react-to-message";
import { InstagramApiError, instagramApiRequest } from "@/lib/instagram/client";
import { withConversationLock } from "@/lib/conversation/conversation-lock";
import {
  enterObservabilityContext,
  getRequestObservabilityContext,
} from "@/lib/observability/context";
import { observabilityLogger } from "@/lib/observability/logger";
import { recordFailure, recordLatency } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

const MAX_API_RETRIES = 3;

const FOLLOW_GATE_PAYLOAD_PREFIX = "SMARTDIRECT_FOLLOW_CHECK:";
const FOLLOW_GATE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// =========================================================
// Types
// =========================================================

type InstagramAccountData = {
  id: string;
  userId: string;
  igUserId: string;
  igUsername: string;
};

type InstagramFollowStatus = {
  success: boolean;
  isFollowing: boolean | null;
  error?: string;
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
  const requestContext = getRequestObservabilityContext(request);
  enterObservabilityContext(requestContext);
  const startedAt = Date.now();

  observabilityLogger.info("webhook_request_started", {
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    method: request.method,
    path: new URL(request.url).pathname,
  });

  try {
    const body = await request.json();

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK EVENT");
    console.log("========================================");

    observabilityLogger.info("webhook_payload_received", {
      entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
      object: body?.object ?? null,
    });

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

      enterObservabilityContext({
        tenantId: instagramAccount.userId,
        instagramAccountId: instagramAccount.id,
      });

      observabilityLogger.info("webhook_account_resolved", {
        igUserId: instagramAccount.igUserId,
        instagramUsername: instagramAccount.igUsername,
      });

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
          await processMessagingEventWithIdempotency(messagingEvent, accountData);
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

          await processCommentEventWithIdempotency(change.value, accountData);
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

    const latencyMs = Date.now() - startedAt;

    observabilityLogger.info("webhook_request_completed", {
      latencyMs,
    });
    void recordLatency("webhook", latencyMs);

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: {
          "x-request-id": requestContext.requestId,
          "x-correlation-id": requestContext.correlationId,
        },
      },
    );
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    observabilityLogger.error("webhook_request_failed", {
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    });
    void recordLatency("webhook", latencyMs);
    void recordFailure(
      "webhook",
      error instanceof Error ? error.constructor.name : "unknown",
    );

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      {
        status: 500,
        headers: {
          "x-request-id": requestContext.requestId,
          "x-correlation-id": requestContext.correlationId,
        },
      },
    );
  }
}

// =========================================================
// Webhook Idempotency wrappers
// =========================================================

async function processMessagingEventWithIdempotency(
  messagingEvent: any,
  instagramAccount: InstagramAccountData,
) {
  const normalizedEvent = normalizeInstagramWebhookEvent({
    type: "MESSAGING",
    event: messagingEvent,
    accountId: instagramAccount.id,
  });

  const claim = await claimInstagramWebhookEvent({
    instagramAccountId: instagramAccount.id,
    event: normalizedEvent.rawEvent,
    eventType: normalizedEvent.type,
    eventId: normalizedEvent.eventId,
  });

  if (!claim.claimed) {
    console.log("Duplicate Instagram messaging webhook skipped:", claim.eventId);
    return;
  }

  try {
    const queued = await enqueueInstagramWebhookEvent({
      instagramAccountId: instagramAccount.id,
      eventId: claim.eventId,
      eventType: "MESSAGING",
      event: messagingEvent,
      idempotencyKey: claim.key,
    });
    await start(processInstagramWebhookQueueJob, [queued.id]);
  } catch (error) {
    await failInstagramWebhookEvent(claim.key, error);
    throw error;
  }
}

async function processCommentEventWithIdempotency(
  value: any,
  instagramAccount: InstagramAccountData,
) {
  const normalizedEvent = normalizeInstagramWebhookEvent({
    type: "COMMENT",
    event: value,
    accountId: instagramAccount.id,
  });

  const claim = await claimInstagramWebhookEvent({
    instagramAccountId: instagramAccount.id,
    event: normalizedEvent.rawEvent,
    eventType: normalizedEvent.type,
    eventId: normalizedEvent.eventId,
  });

  if (!claim.claimed) {
    console.log("Duplicate Instagram comment webhook skipped:", claim.eventId);
    return;
  }

  try {
    const queued = await enqueueInstagramWebhookEvent({
      instagramAccountId: instagramAccount.id,
      eventId: claim.eventId,
      eventType: "COMMENT",
      event: value,
      idempotencyKey: claim.key,
    });
    await start(processInstagramWebhookQueueJob, [queued.id]);
  } catch (error) {
    await failInstagramWebhookEvent(claim.key, error);
    throw error;
  }
}

// =========================================================
// Queued Instagram webhook processor
// =========================================================

export async function processQueuedInstagramWebhookEvent(
  payload: {
    instagramAccountId: string;
    eventId: string;
    eventType: "MESSAGING" | "COMMENT";
    event: unknown;
  },
  attempt = 1,
) {
  const instagramAccount = await prisma.instagramAccount.findUnique({
    where: {
      id: payload.instagramAccountId,
    },
  });

  if (!instagramAccount) {
    throw new Error(
      `Instagram account not found for queued webhook: ${payload.instagramAccountId}`,
    );
  }

  const accountData: InstagramAccountData = {
    id: instagramAccount.id,
    userId: instagramAccount.userId,
    igUserId: instagramAccount.igUserId,
    igUsername: instagramAccount.igUsername,
  };

  const webhookEventKey = `smartdirect:idempotency:v1:webhook:${accountData.id}:${payload.eventType}:${createHash("sha256").update(payload.eventId).digest("hex")}`;

  if (attempt > 1) {
    const reclaimed = await retryInstagramWebhookEvent(webhookEventKey);

    if (!reclaimed) {
      console.log(
        "Queued Instagram webhook retry skipped because the event is not in FAILED state:",
        payload.eventId,
      );
      return;
    }
  }

  try {
    if (payload.eventType === "MESSAGING") {
      await processMessagingEvent(
        payload.event,
        accountData,
        payload.eventId,
      );
    } else {
      await processCommentEvent(
        payload.event,
        accountData,
        payload.eventId,
      );
    }

    await completeInstagramWebhookEvent(webhookEventKey);
  } catch (error) {
    await failInstagramWebhookEvent(webhookEventKey, error);
    throw error;
  }
}

// =========================================================
// Process Instagram read / seen receipt
//
// Meta's `messaging_seen` event can provide either:
//
// 1. `read.mid`       -> the latest message the customer has seen
// 2. `read.watermark` -> timestamp up to which messages were seen
//
// We support both forms.
// =========================================================

async function processInstagramReadReceipt(
  messagingEvent: any,
  instagramAccount: InstagramAccountData,
) {
  try {
    const senderId = messagingEvent?.sender?.id;
    const read = messagingEvent?.read;

    if (!senderId || !read) {
      console.warn("Instagram read receipt is missing sender/read data.");

      return;
    }

    const participantId = String(senderId);

    // =======================================================
    // Read Message ID
    // =======================================================

    const readMid =
      typeof read.mid === "string" && read.mid.trim() ? read.mid.trim() : null;

    // =======================================================
    // Read Watermark
    //
    // Meta may send the watermark as either a number or string.
    // =======================================================

    const watermarkRaw = read.watermark;

    const readWatermark =
      typeof watermarkRaw === "number"
        ? watermarkRaw
        : typeof watermarkRaw === "string" && watermarkRaw.trim()
          ? Number(watermarkRaw)
          : null;

    // =======================================================
    // Find conversation
    // =======================================================

    const conversation = await prisma.conversation.findUnique({
      where: {
        instagramAccountId_participantId: {
          instagramAccountId: instagramAccount.id,
          participantId,
        },
      },

      select: {
        id: true,
      },
    });

    if (!conversation) {
      console.log(
        "Instagram read receipt received for a conversation that is not stored yet:",
        participantId,
      );

      return;
    }

    // =======================================================
    // Prefer message ID when Meta provides one
    //
    // This is more precise because it does not depend on clock
    // synchronization between Meta and our database.
    // =======================================================
const recentOutboundMessages = await prisma.conversationMessage.findMany({
  where: {
    conversationId: conversation.id,
    direction: "OUTBOUND",
  },
  orderBy: {
    createdAt: "desc",
  },
  take: 10,
  select: {
    id: true,
    text: true,
    igMessageId: true,
    createdAt: true,
    seenAt: true,
  },
});

console.log("========================================");
console.log("OUTBOUND MESSAGES BEFORE SEEN MATCH");
console.log(
  JSON.stringify(
    recentOutboundMessages.map((msg) => ({
      id: msg.id,
      text: msg.text,
      igMessageId: msg.igMessageId,
      createdAt: msg.createdAt,
      seenAt: msg.seenAt,
      isReadMidMatch: msg.igMessageId === readMid,
    })),
    null,
    2,
  ),
);
console.log("Meta read.mid:", readMid);
console.log("========================================");
    let anchorCreatedAt: Date | null = null;

    if (readMid) {
      const anchor = await prisma.conversationMessage.findFirst({
        where: {
          conversationId: conversation.id,

          direction: "OUTBOUND",

          igMessageId: readMid,
        },

        select: {
          createdAt: true,
        },
      });

      anchorCreatedAt = anchor?.createdAt ?? null;
    }

    // =======================================================
    // Mark messages as Seen
    // =======================================================

    const seenAt = new Date();

    let updatedCount = 0;

    // =======================================================
    // CASE 1:
    // Meta gave us the exact message ID and that message exists
    // =======================================================

    if (anchorCreatedAt) {
      const result = await prisma.conversationMessage.updateMany({
        where: {
          conversationId: conversation.id,

          direction: "OUTBOUND",

          createdAt: {
            lte: anchorCreatedAt,
          },

          seenAt: null,
        },

        data: {
          seenAt,
        },
      });

      updatedCount = result.count;
    }

    // =======================================================
    // CASE 2:
    // Meta gave us a message ID but the message is not in DB
    //
    // This can happen if the webhook arrives before our outbound
    // message persistence finishes, or if the message was sent
    // outside SmartDirect.
    //
    // Preserve the existing fallback behavior.
    // =======================================================
    else if (readMid) {
      const result = await prisma.conversationMessage.updateMany({
        where: {
          conversationId: conversation.id,

          direction: "OUTBOUND",

          seenAt: null,
        },

        data: {
          seenAt,
        },
      });

      updatedCount = result.count;
    }

    // =======================================================
    // CASE 3:
    // Meta gave us only a watermark
    //
    // Watermark is a Unix timestamp in milliseconds.
    // Every outbound message created before or at that point
    // is considered Seen.
    // =======================================================
    else if (Number.isFinite(readWatermark)) {
      const watermarkDate = new Date(readWatermark as number);

      if (Number.isNaN(watermarkDate.getTime())) {
        console.warn(
          "Instagram read receipt contains an invalid watermark:",
          readWatermark,
        );

        return;
      }

      const result = await prisma.conversationMessage.updateMany({
        where: {
          conversationId: conversation.id,

          direction: "OUTBOUND",

          createdAt: {
            lte: watermarkDate,
          },

          seenAt: null,
        },

        data: {
          seenAt,
        },
      });

      updatedCount = result.count;
    }

    // =======================================================
    // CASE 4:
    // Neither message ID nor valid watermark exists
    // =======================================================
    else {
      console.warn(
        "Instagram read receipt has neither a usable message ID nor watermark. No message state was changed.",
      );

      return;
    }

    // =======================================================
    // Logging
    // =======================================================

    console.log("========================================");

    console.log("INSTAGRAM MESSAGE SEEN / READ RECEIPT");

    console.log("Participant ID:", participantId);

    console.log("Read message ID:", readMid ?? "NONE");

    console.log("Read watermark:", readWatermark ?? "NONE");

    console.log(
      "Read watermark date:",
      Number.isFinite(readWatermark)
        ? new Date(readWatermark as number).toISOString()
        : "NONE",
    );

    console.log("Conversation ID:", conversation.id);

    console.log("Outbound messages marked seen:", updatedCount);

    console.log("========================================");
  } catch (error) {
    console.error("Error processing Instagram read receipt:", error);
  }
}

// =========================================================
// Process Instagram messaging events
// =========================================================

async function processMessagingEvent(
  messagingEvent: any,
  instagramAccount: InstagramAccountData,
  executionId: string,
) {
  const senderId = messagingEvent?.sender?.id;

  if (!senderId) {
    return processMessagingEventLocked(
      messagingEvent,
      instagramAccount,
      executionId,
    );
  }

  return withConversationLock(
    {
      instagramAccountId: instagramAccount.id,
      participantId: String(senderId),
    },
    async () =>
      processMessagingEventLocked(
        messagingEvent,
        instagramAccount,
        executionId,
      ),
  );
}

async function processMessagingEventLocked(
  messagingEvent: any,
  instagramAccount: InstagramAccountData,
  executionId: string,
) {
  try {
    console.log("[Conversation Concurrency] Per-user conversation lock acquired.");

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
        executionId,
      );

      console.log("========================================");

      return;
    }

    // =======================================================
    // Real Instagram read receipt / seen event
    // =======================================================

    if (messagingEvent?.read) {
      await processInstagramReadReceipt(messagingEvent, instagramAccount);

      console.log("Instagram read receipt processed.");

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
        executionId,
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
    // Resolve automation
    //
    // For Quick Replies we MUST resolve by the payload itself.
    // The first active DM automation is not necessarily the automation
    // that sent this button, especially when multiple automations exist.
    // =======================================================

    let automation = null;

    if (quickReplyPayload) {
      console.log("Resolving Quick Reply payload across active automations:", quickReplyPayload);

      automation = await findAutomationByQuickReplyPayload({
        instagramAccountId: instagramAccount.id,
        payload: quickReplyPayload,
      });

      if (automation) {
        console.log("Quick Reply automation resolved:", automation.id);
        console.log("Quick Reply automation trigger:", automation.triggerType);
      } else {
        console.warn(
          "Quick reply payload does not belong to any active automation:",
          quickReplyPayload,
        );
      }
    } else {
      automation = await findMatchingAutomation({
        instagramAccountId: instagramAccount.id,
        triggerType: "DM",
      });

      if (automation) {
        console.log("DM automation found:", automation.id);
      } else {
        console.log("No active DM automation found.");
      }
    }

    // =======================================================
    // Resolve Quick Reply ID inside the resolved automation
    // =======================================================

    let selectedQuickReplyId: string | null = null;

    if (quickReplyPayload && automation) {
      const topLevelQuickReplies = automation.messages.flatMap(
        (automationMessage) => automationMessage.quickReplies,
      );

      const selectedQuickReply = topLevelQuickReplies.find(
        (quickReply) => quickReply.payload === quickReplyPayload,
      );

      if (selectedQuickReply) {
        selectedQuickReplyId = selectedQuickReply.id;

        console.log(
          "QUICK REPLY SELECTED:",
          selectedQuickReply.id,
          selectedQuickReply.title,
        );
      } else {
        const findNestedPayload = (node: unknown): boolean => {
          if (!node || typeof node !== "object") return false;

          const value = node as {
            payload?: unknown;
            quickReplies?: unknown;
          };

          if (value.payload === quickReplyPayload) return true;

          if (Array.isArray(value.quickReplies)) {
            return value.quickReplies.some((child) =>
              findNestedPayload(child),
            );
          }

          return false;
        };

        const root = topLevelQuickReplies.find((reply) => {
          if (!reply.replyText) return false;

          try {
            return findNestedPayload(JSON.parse(reply.replyText));
          } catch {
            return false;
          }
        });

        if (root) {
          selectedQuickReplyId = root.id + "::" + quickReplyPayload;

          console.log(
            "NESTED QUICK REPLY SELECTED:",
            quickReplyPayload,
            "root:",
            root.id,
          );
        } else {
          console.warn(
            "Quick reply payload was resolved to an automation but could not be resolved inside it:",
            quickReplyPayload,
          );
        }
      }
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

          quickReplyId: selectedQuickReplyId?.includes("::") ? selectedQuickReplyId.split("::")[0] : selectedQuickReplyId,

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

      // TEMPORARY REACTION-ONLY DIAGNOSTIC TEST.
      // This intentionally stops before executeAutomation().
      console.log("REACTION-ONLY TEST: Automation execution is temporarily skipped.");
      return;
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
      executionId: executionId,
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
  executionId: string,
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
    // FOLLOW GATE
    //
    // Story Reply هم مثل Comment باید قبل از ارسال محتوای اصلی
    // وضعیت Follow کاربر را بررسی کند.
    // اگر کاربر Follow نکرده باشد، محتوای نهایی ارسال نمی‌شود.
    // =======================================================

    if (automation.requireFollow) {
      console.log("========================================");
      console.log("FOLLOW GATE ENABLED FOR STORY REPLY AUTOMATION");
      console.log("Automation ID:", automation.id);
      console.log("Participant ID:", participantId);
      console.log("========================================");

      const followStatus = await getInstagramUserFollowStatus({
        instagramUserId: participantId,
        accessToken,
      });

      console.log("Story Reply follow status:", followStatus);

      // اگر کاربر از قبل فالو کرده، Gate را رد می‌کنیم و محتوای اصلی
      // در ادامه همین تابع ارسال خواهد شد.
      if (followStatus.success && followStatus.isFollowing === true) {
        console.log("Story Reply user already follows the account.");
        console.log("Story Reply Follow Gate bypassed.");
      } else {
        // در حالت false یا unknown، Fail Closed:
        // هیچ محتوای اصلی ارسال نمی‌شود.
        if (!followStatus.success || followStatus.isFollowing === null) {
          console.warn(
            "Could not determine Story Reply follow status. Follow Gate remains active.",
          );
        } else {
          console.log(
            "Story Reply user does NOT follow the account. Final content blocked.",
          );
        }

        let pendingGate = await prisma.pendingFollowGate.findFirst({
          where: {
            instagramAccountId: instagramAccount.id,
            automationId: automation.id,
            participantId,
            status: "PENDING",
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (!pendingGate) {
          pendingGate = await prisma.pendingFollowGate.create({
            data: {
              instagramAccountId: instagramAccount.id,
              automationId: automation.id,
              participantId,
              status: "PENDING",
              attempts: 0,
              expiresAt: new Date(Date.now() + FOLLOW_GATE_EXPIRATION_MS),
            },
          });

          console.log(
            "New Pending Follow Gate created for Story Reply:",
            pendingGate.id,
          );
        } else {
          console.log(
            "Existing Pending Follow Gate reused for Story Reply:",
            pendingGate.id,
          );
        }

        const gateText =
          automation.followGateText?.trim() ||
          "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.";

        const gateSent = await sendFollowGateMessage({
          instagramAccount,
          participantId,
          accessToken,
          pendingGateId: pendingGate.id,
          followGateText: gateText,
        });

        if (gateSent) {
          await prisma.pendingFollowGate.update({
            where: {
              id: pendingGate.id,
            },
            data: {
              attempts: {
                increment: 1,
              },
            },
          });
        }

        console.log("========================================");
        console.log("STORY REPLY FOLLOW GATE RESULT");
        console.log("Gate sent:", gateSent);
        console.log("Pending Gate ID:", pendingGate.id);
        console.log("Final content execution: BLOCKED UNTIL FOLLOW");
        console.log("========================================");

        // بسیار مهم: در حالت عدم Follow یا خطا در بررسی،
        // از این تابع خارج می‌شویم تا replyText یا Flow ارسال نشود.
        return;
      }
    } else {
      console.log("Follow Gate disabled for this Story Reply automation.");
    }

    // =======================================================
    // 1. DIRECT REPLY
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
        executionId,

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
  try {
    await instagramApiRequest(`/${igUserId}/messages`, {
      method: "POST",
      accessToken,
      body: {
        recipient: { id: participantId },
        message: { text: replyText },
      },
    });
    return true;
  } catch (error) {
    console.error("Instagram Story Reply message failed:", error);
    return false;
  }
}


// =========================================================
// Instagram Follow Gate
// =========================================================

async function getInstagramUserFollowStatus({
  instagramUserId,
  accessToken,
}: {
  instagramUserId: string;
  accessToken: string;
}): Promise<InstagramFollowStatus> {
  try {
    const data = await instagramApiRequest<{ is_user_follow_business?: boolean }>(
      `/${instagramUserId}`,
      {
        method: "GET",
        accessToken,
        params: { fields: "is_user_follow_business" },
      },
    );
    const rawValue = data?.is_user_follow_business;
    return {
      success: true,
      isFollowing:
        rawValue === true ? true : rawValue === false ? false : null,
    };
  } catch (error) {
    console.error("Instagram follow status request failed:", error);
    return {
      success: false,
      isFollowing: null,
      error:
        error instanceof InstagramApiError
          ? error.message
          : "FOLLOW_STATUS_CHECK_FAILED",
    };
  }
}


// =========================================================
// Send Follow Gate message
// =========================================================

async function sendFollowGateMessage({
  instagramAccount,
  participantId,
  accessToken,
  pendingGateId,
  followGateText,
}: {
  instagramAccount: InstagramAccountData;
  participantId: string;
  accessToken: string;
  pendingGateId: string;
  followGateText: string;
}): Promise<boolean> {
  const instagramProfileUrl = `https://www.instagram.com/${encodeURIComponent(
    instagramAccount.igUsername,
  )}/`;
  const postbackPayload = `${FOLLOW_GATE_PAYLOAD_PREFIX}${pendingGateId}`;

  try {
    await instagramApiRequest(`/${instagramAccount.igUserId}/messages`, {
      method: "POST",
      accessToken,
      body: {
        recipient: { id: participantId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: followGateText,
              buttons: [
                { type: "web_url", url: instagramProfileUrl, title: "فالو کردن" },
                { type: "postback", title: "بررسی فالو", payload: postbackPayload },
              ],
            },
          },
        },
      },
    });
    return true;
  } catch (error) {
    console.error("Instagram Follow Gate message failed:", error);
    return false;
  }
}


// =========================================================
// Send normal Instagram DM
// =========================================================

async function sendDirectInstagramMessage({
  igUserId,
  participantId,
  accessToken,
  text,
}: {
  igUserId: string;
  participantId: string;
  accessToken: string;
  text: string;
}): Promise<boolean> {
  try {
    await instagramApiRequest(`/${igUserId}/messages`, {
      method: "POST",
      accessToken,
      body: {
        recipient: { id: participantId },
        message: { text },
      },
    });
    return true;
  } catch (error) {
    console.error("Instagram direct message failed:", error);
    return false;
  }
}


// =========================================================
// Process Follow Gate postback
// =========================================================
