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
import { findMatchingAutomation } from "@/lib/automation/find-matching-automation";
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

async function processFollowGatePostback({
  senderId,
  payload,
  instagramAccount,
  executionId,
}: {
  senderId: string;
  payload: string;
  instagramAccount: InstagramAccountData;
  executionId: string;
}): Promise<boolean> {
  try {
    if (!payload.startsWith(FOLLOW_GATE_PAYLOAD_PREFIX)) {
      return false;
    }

    const pendingGateId = payload.slice(FOLLOW_GATE_PAYLOAD_PREFIX.length);

    if (!pendingGateId) {
      console.warn("Follow Gate postback does not contain gate ID.");

      return true;
    }

    const participantId = String(senderId);

    console.log("========================================");

    console.log("FOLLOW GATE CHECK REQUESTED");

    console.log("Pending Gate ID:", pendingGateId);

    console.log("Participant ID:", participantId);

    console.log("Instagram Account ID:", instagramAccount.id);

    console.log("========================================");

    const pendingGate = await prisma.pendingFollowGate.findFirst({
      where: {
        id: pendingGateId,

        instagramAccountId: instagramAccount.id,

        participantId,

        status: "PENDING",
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

    if (!pendingGate) {
      console.warn(
        "Pending Follow Gate not found or no longer pending:",
        pendingGateId,
      );

      await sendDirectInstagramMessage({
        igUserId: instagramAccount.igUserId,

        participantId,

        accessToken: await getValidInstagramAccessToken(instagramAccount.id),

        text:
          "این درخواست فالو منقضی شده یا دیگر فعال نیست. " +
          "لطفاً دوباره از طریق کامنت درخواست را ارسال کنید.",
      });

      return true;
    }

    if (pendingGate.expiresAt.getTime() <= Date.now()) {
      await prisma.pendingFollowGate.update({
        where: {
          id: pendingGate.id,
        },

        data: {
          status: "EXPIRED",
        },
      });

      console.log("Follow Gate expired:", pendingGate.id);

      const accessToken = await getValidInstagramAccessToken(
        instagramAccount.id,
      );

      await sendDirectInstagramMessage({
        igUserId: instagramAccount.igUserId,

        participantId,

        accessToken,

        text:
          "مهلت این درخواست تمام شده است. " +
          "لطفاً دوباره روی پست کامنت بگذارید تا درخواست جدید ایجاد شود.",
      });

      return true;
    }

    if (!pendingGate.automation.isActive) {
      console.warn(
        "Follow Gate automation is no longer active:",
        pendingGate.automationId,
      );

      return true;
    }

    let accessToken: string;

    try {
      accessToken = await getValidInstagramAccessToken(instagramAccount.id);
    } catch (error) {
      console.error("Could not get valid access token for Follow Gate:", error);

      return true;
    }

    // =======================================================
    // Check actual Instagram follow status
    // =======================================================

    const followStatus = await getInstagramUserFollowStatus({
      instagramUserId: participantId,

      accessToken,
    });

    // =======================================================
    // API could not determine status
    // =======================================================

    if (!followStatus.success || followStatus.isFollowing === null) {
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

      await sendDirectInstagramMessage({
        igUserId: instagramAccount.igUserId,

        participantId,

        accessToken,

        text:
          "در حال حاضر امکان بررسی وضعیت فالو وجود ندارد. " +
          "لطفاً چند لحظه بعد دوباره «بررسی فالو» را بزنید.",
      });

      return true;
    }

    // =======================================================
    // User has NOT followed
    // =======================================================

    if (!followStatus.isFollowing) {
      console.log("User is NOT following the Instagram account.");

      const updatedGate = await prisma.pendingFollowGate.update({
        where: {
          id: pendingGate.id,
        },

        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      const gateText =
        pendingGate.automation.followGateText?.trim() ||
        "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.";

      await sendFollowGateMessage({
        instagramAccount,

        participantId,

        accessToken,

        pendingGateId: updatedGate.id,

        followGateText: gateText,
      });

      return true;
    }

    // =======================================================
    // User HAS followed
    // =======================================================

    console.log("========================================");

    console.log("USER FOLLOW VERIFIED");

    console.log("Pending Gate ID:", pendingGate.id);

    console.log("Automation ID:", pendingGate.automationId);

    console.log("Participant ID:", participantId);

    console.log("========================================");

    await prisma.pendingFollowGate.update({
      where: {
        id: pendingGate.id,
      },

      data: {
        status: "COMPLETED",

        attempts: {
          increment: 1,
        },
      },
    });

    const automation = pendingGate.automation;

    const hasDirectReply = Boolean(
      automation.replyText && automation.replyText.trim(),
    );

    const hasFlowMessages = automation.messages.length > 0;

    let directReplySent = false;

    // =======================================================
    // Final direct reply
    // =======================================================

    if (hasDirectReply && !hasFlowMessages) {
      directReplySent = await sendDirectInstagramMessage({
        igUserId: instagramAccount.igUserId,

        participantId,

        accessToken,

        text: automation.replyText!.trim(),
      });

      console.log("Final direct reply sent:", directReplySent);
    }

    // =======================================================
    // Final automation flow
    // =======================================================

    let automationExecuted = false;

    if (hasFlowMessages) {
      console.log("========================================");

      console.log("EXECUTING FOLLOW-GATED AUTOMATION");

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

      console.log("Follow-gated automation result:", result);
    }

    // =======================================================
    // Direct reply + flow
    //
    // Existing architecture normally lets Flow handle the
    // response when messages exist, so do not duplicate it.
    // =======================================================

    if (hasDirectReply && hasFlowMessages) {
      console.log("Automation has both direct reply and Flow messages.");

      console.log(
        "Following existing behavior: Flow handles the final response.",
      );
    }

    console.log("========================================");

    console.log("FOLLOW GATE COMPLETED");

    console.log("Direct reply sent:", directReplySent);

    console.log("Flow executed:", automationExecuted);

    console.log("========================================");

    return true;
  } catch (error) {
    console.error("Error processing Follow Gate postback:", error);

    return true;
  }
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
  executionId: string,
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
    // Follow Gate
    //
    // Must be checked BEFORE Ice Breaker / Persistent Menu
    // so the reserved Follow Gate payload is not treated as
    // an unknown menu payload.
    // =======================================================

    if (payload.startsWith(FOLLOW_GATE_PAYLOAD_PREFIX)) {
      await processFollowGatePostback({
        senderId: participantId,

        payload,

        instagramAccount,
        executionId,
      });

      return;
    }

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
      executionId: sourceId,
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
  executionId: string,
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

    const commenterIgUserId = value.from?.id ? String(value.from.id) : null;

    if (!igCommentId || !igMediaId || !text || !username) {
      console.warn("Incomplete Instagram comment payload:", value);

      return;
    }

    console.log("========================================");

    console.log("INSTAGRAM COMMENT");

    console.log("commentId:", igCommentId);

    console.log("mediaId:", igMediaId);

    console.log("username:", username);

    console.log("commenterIgUserId:", commenterIgUserId);

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

    console.log("Message count:", matchedAutomation.messages.length);

    console.log("Like Comment:", matchedAutomation.likeComment);

    console.log("Require Follow:", matchedAutomation.requireFollow);

    console.log(
      "Follow Gate Text:",
      matchedAutomation.followGateText ?? "DEFAULT",
    );

    console.log("Instagram Comment ID:", igCommentId);

    console.log("Username:", username);

    console.log("Commenter Instagram-scoped ID:", commenterIgUserId);

    console.log("========================================");

    // =======================================================
    // Validate Comment automation output
    // =======================================================

    const hasPublicCommentReply = Boolean(
      matchedAutomation.commentReplyText &&
      matchedAutomation.commentReplyText.trim(),
    );

    const hasPrivateReply = Boolean(
      matchedAutomation.replyText && matchedAutomation.replyText.trim(),
    );

    const hasFlowMessages = matchedAutomation.messages.length > 0;

    const hasLikeComment = matchedAutomation.likeComment === true;

    const requiresFollow = matchedAutomation.requireFollow === true;

    if (
      !hasPublicCommentReply &&
      !hasPrivateReply &&
      !hasFlowMessages &&
      !hasLikeComment
    ) {
      console.log(
        "Comment automation has no public reply, private reply, flow, or like action.",
      );

      console.log("Nothing will be executed.");

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
      console.error("Could not get valid Instagram access token:", error);

      return;
    }

    // =======================================================
    // Public comment reply
    //
    // This is intentionally sent BEFORE Follow Gate.
    // =======================================================

    let publicCommentReplySent = false;

    if (hasPublicCommentReply) {
      publicCommentReplySent = await sendPublicCommentReply({
        igCommentId,

        accessToken,

        replyText: matchedAutomation.commentReplyText!.trim(),
      });
    } else {
      console.log(
        "No public comment reply text configured. Skipping public reply.",
      );
    }

    // =======================================================
    // FOLLOW GATE
    // =======================================================

    if (requiresFollow) {
      console.log("========================================");

      console.log("FOLLOW GATE ENABLED FOR COMMENT AUTOMATION");

      console.log("Automation ID:", matchedAutomation.id);

      console.log("Commenter ID:", commenterIgUserId ?? "MISSING");

      console.log("========================================");

      if (!commenterIgUserId) {
        console.error(
          "Follow Gate requires commenter Instagram-scoped ID, but it is missing.",
        );

        return;
      }

      // =====================================================
      // Check whether user already follows the account
      //
      // If true -> execute final content immediately.
      // If false/unknown -> create pending gate and send gate.
      // =====================================================

      const followStatus = await getInstagramUserFollowStatus({
        instagramUserId: commenterIgUserId,

        accessToken,
      });

      // =====================================================
      // Already following
      // =====================================================

      if (followStatus.success && followStatus.isFollowing === true) {
        console.log("Commenter already follows the account.");

        console.log("Follow Gate will be bypassed.");

        let automationExecuted = false;

        let privateReplySent = false;

        if (hasFlowMessages) {
          console.log("========================================");

          console.log("EXECUTING COMMENT FLOW - USER ALREADY FOLLOWS");

          console.log("Automation ID:", matchedAutomation.id);

          console.log("Commenter Instagram-scoped ID:", commenterIgUserId);

          console.log("Message count:", matchedAutomation.messages.length);

          console.log("========================================");

          const result = await executeAutomation({
            automationId: matchedAutomation.id,

            instagramAccountId: instagramAccount.id,

            participantId: commenterIgUserId,

            igUserId: commenterIgUserId,

            commentId: igCommentId,

            selectedQuickReplyId: null,
            executionId,

          });

          automationExecuted = result.success && result.executed;

          console.log("Comment automation engine result:", result);
        } else if (hasPrivateReply) {
          privateReplySent = await sendPrivateReply({
            igUserId: instagramAccount.igUserId,

            igCommentId,

            accessToken,

            replyText: matchedAutomation.replyText!.trim(),
          });
        }

        if (publicCommentReplySent || privateReplySent || automationExecuted) {
          await prisma.comment.update({
            where: {
              id: comment.id,
            },

            data: {
              replied: true,

              replyText:
                matchedAutomation.commentReplyText ??
                matchedAutomation.replyText ??
                null,
            },
          });
        }

        console.log("========================================");

        console.log("COMMENT AUTOMATION RESULT - ALREADY FOLLOWING");

        console.log("Public comment reply sent:", publicCommentReplySent);

        console.log("Automation engine executed:", automationExecuted);

        console.log("Private reply sent:", privateReplySent);

        console.log("========================================");

        return;
      }

      // =====================================================
      // Follow status unknown / API failure
      //
      // Fail closed: do not release final content.
      // =====================================================

      if (!followStatus.success || followStatus.isFollowing === null) {
        console.warn(
          "Could not determine current follow status. Follow Gate remains active.",
        );
      }

      // =====================================================
      // Find existing pending gate
      //
      // This prevents creating a new gate every time the same
      // user comments repeatedly while the old gate is active.
      // =====================================================

      let pendingGate = await prisma.pendingFollowGate.findFirst({
        where: {
          instagramAccountId: instagramAccount.id,

          automationId: matchedAutomation.id,

          participantId: commenterIgUserId,

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

            automationId: matchedAutomation.id,

            participantId: commenterIgUserId,

            status: "PENDING",

            attempts: 0,

            expiresAt: new Date(Date.now() + FOLLOW_GATE_EXPIRATION_MS),
          },
        });

        console.log("New Pending Follow Gate created:", pendingGate.id);
      } else {
        console.log("Existing Pending Follow Gate reused:", pendingGate.id);
      }

      const gateText =
        matchedAutomation.followGateText?.trim() ||
        "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.";

      const gateSent = await sendFollowGateMessage({
        instagramAccount,

        participantId: commenterIgUserId,

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

      console.log("FOLLOW GATE RESULT");

      console.log("Gate sent:", gateSent);

      console.log("Pending Gate ID:", pendingGate.id);

      console.log("Final content execution: BLOCKED UNTIL FOLLOW");

      console.log("========================================");

      // =====================================================
      // VERY IMPORTANT:
      //
      // Do NOT execute:
      //
      // executeAutomation()
      //
      // and do NOT send:
      //
      // replyText
      //
      // here.
      //
      // They are released only after the follow check succeeds.
      // =====================================================

      return;
    }

    // =======================================================
    // Normal Comment Automation
    //
    // This section runs only when Follow Gate is disabled.
    // =======================================================

    let automationExecuted = false;

    if (hasFlowMessages) {
      const commenterIgUserId = value.from?.id;

      if (!commenterIgUserId) {
        console.warn(
          "Comment does not contain commenter Instagram-scoped ID. Flow cannot execute.",
        );
      } else {
        console.log("========================================");

        console.log("EXECUTING COMMENT FLOW AUTOMATION");

        console.log("Automation ID:", matchedAutomation.id);

        console.log("Commenter Instagram-scoped ID:", commenterIgUserId);

        console.log("Message count:", matchedAutomation.messages.length);

        console.log("========================================");

        const result = await executeAutomation({
          automationId: matchedAutomation.id,

          instagramAccountId: instagramAccount.id,

          participantId: String(commenterIgUserId),

          igUserId: String(commenterIgUserId),

          commentId: igCommentId,

          selectedQuickReplyId: null,
        executionId,
        });

        automationExecuted = result.success && result.executed;

        console.log("Comment automation engine result:", result);
      }
    } else {
      console.log("No Comment Flow messages configured.");
    }

    let privateReplySent = false;

    if (!hasFlowMessages && hasPrivateReply) {
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

          replyText: matchedAutomation.replyText!.trim(),
        });
      }
    } else if (!hasFlowMessages) {
      console.log("No private reply configured. Skipping.");
    } else {
      console.log(
        "Flow messages exist. Direct private reply is skipped because Flow handles the response.",
      );
    }

    const automationCompleted = hasFlowMessages
      ? automationExecuted
      : publicCommentReplySent || privateReplySent;

    if (automationCompleted) {
      await prisma.comment.update({
        where: {
          id: comment.id,
        },

        data: {
          replied: true,

          replyText:
            matchedAutomation.commentReplyText ??
            matchedAutomation.replyText ??
            null,
        },
      });

      console.log("Comment marked as replied.");
    }

    console.log("========================================");

    console.log("INSTAGRAM COMMENT AUTOMATION RESULT");

    console.log("Public comment reply sent:", publicCommentReplySent);

    console.log("Automation engine executed:", automationExecuted);

    console.log("Private reply sent:", privateReplySent);

    console.log("Like comment enabled:", hasLikeComment);

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
  try {
    await instagramApiRequest(`/${igCommentId}/replies`, {
      method: "POST",
      accessToken,
      body: new URLSearchParams({ message: replyText }),
    });
    return true;
  } catch (error) {
    console.error("Instagram public comment reply failed:", error);
    return false;
  }
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
  try {
    await instagramApiRequest(`/${igUserId}/messages`, {
      method: "POST",
      accessToken,
      body: {
        recipient: { comment_id: igCommentId },
        message: { text: replyText },
      },
    });

    return true;
  } catch (error) {
    console.error("Instagram private reply failed:", error);
    return false;
  }
}
