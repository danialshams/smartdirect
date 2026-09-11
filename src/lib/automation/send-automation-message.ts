import { AutomationMessageType } from "@/generated/prisma/client";

const INSTAGRAM_API_VERSION = "v26.0";

const MAX_API_RETRIES = 2;

const MAX_QUICK_REPLIES = 13;

const MAX_QUICK_REPLY_TITLE_LENGTH = 20;

type QuickReplyPayload = {
  id: string;
  title: string;
  payload: string;
};

export type AutomationMessagePayload = {
  instagramAccountId: string;

  accessToken: string;

  /**
   * Instagram-scoped ID شخصی که باید پیام را دریافت کند.
   *
   * این همان sender.id از پیام ورودی Webhook است.
   */
  recipientId: string;

  /**
   * Instagram Professional Account ID
   * متعلق به SmartDirect.
   *
   * این همان InstagramAccount.igUserId است.
   */
  instagramUserId: string;

  message: {
    id: string;

    messageType: AutomationMessageType;

    text: string | null;

    mediaUrl: string | null;

    mediaId: string | null;

    quickReplies?: QuickReplyPayload[];
  };
};

export type SendAutomationMessageResult = {
  success: boolean;

  igMessageId?: string;

  recipientId?: string;

  error?: string;

  response?: unknown;
};

type InstagramApiResponse = {
  recipient_id?: string;

  message_id?: string;

  error?: {
    message?: string;

    type?: string;

    code?: number;

    error_subcode?: number;

    fbtrace_id?: string;
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function truncateQuickReplyTitle(title: string): string {
  const normalized = title.trim();

  if (normalized.length <= MAX_QUICK_REPLY_TITLE_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, MAX_QUICK_REPLY_TITLE_LENGTH);
}

function validateQuickReplies(quickReplies: QuickReplyPayload[]) {
  if (quickReplies.length > MAX_QUICK_REPLIES) {
    throw new Error(
      `Instagram supports a maximum of ${MAX_QUICK_REPLIES} quick replies`,
    );
  }

  return quickReplies.map((quickReply) => {
    const title = truncateQuickReplyTitle(quickReply.title);

    if (!title) {
      throw new Error("Quick reply title cannot be empty");
    }

    if (!quickReply.payload) {
      throw new Error("Quick reply payload cannot be empty");
    }

    return {
      content_type: "text",
      title,
      payload: quickReply.payload,
    };
  });
}

function getMediaAttachmentType(
  messageType: AutomationMessageType,
): "image" | "video" | "audio" {
  switch (messageType) {
    case "IMAGE":
      return "image";

    case "VIDEO":
      return "video";

    case "AUDIO":
      return "audio";

    default:
      throw new Error(`Unsupported media message type: ${messageType}`);
  }
}

async function callInstagramMessagesApi({
  instagramUserId,
  accessToken,
  body,
}: {
  instagramUserId: string;

  accessToken: string;

  body: Record<string, unknown>;
}): Promise<SendAutomationMessageResult> {
  const url = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${instagramUserId}/messages`;

  console.log("[Instagram Send API] URL:", url);

  // Access Token را هرگز در log چاپ نمی‌کنیم.
  console.log(
    "[Instagram Send API] Request body:",
    JSON.stringify(body, null, 2),
  );

  for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      console.log(`[Instagram Send API] Attempt ${attempt}/${MAX_API_RETRIES}`);

      const response = await fetch(url, {
        method: "POST",

        headers: {
          Authorization: `Bearer ${accessToken}`,

          "Content-Type": "application/json",

          Accept: "application/json",
        },

        body: JSON.stringify(body),

        cache: "no-store",
      });

      const responseText = await response.text();

      let responseData: InstagramApiResponse | string;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      console.log("[Instagram Send API] Response:", {
        status: response.status,

        ok: response.ok,

        data: responseData,
      });

      if (response.ok) {
        const data = responseData as InstagramApiResponse;

        console.log("[Instagram Send API] SUCCESS:", {
          recipientId: data.recipient_id,

          messageId: data.message_id,
        });

        return {
          success: true,

          igMessageId: data.message_id,

          recipientId: data.recipient_id,

          response: responseData,
        };
      }

      const errorData = responseData as InstagramApiResponse;

      const apiError = errorData?.error;

      const errorMessage =
        apiError?.message ?? `Instagram API returned HTTP ${response.status}`;

      console.error("[Instagram Send API] FAILED:", {
        status: response.status,

        errorMessage,

        errorType: apiError?.type,

        errorCode: apiError?.code,

        errorSubcode: apiError?.error_subcode,

        fbtraceId: apiError?.fbtrace_id,

        response: responseData,
      });

      // خطاهای 4xx را retry نمی‌کنیم.
      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,

          error: errorMessage,

          response: responseData,
        };
      }

      // برای خطاهای 5xx یک retry محدود.
      if (attempt < MAX_API_RETRIES) {
        await sleep(attempt * 1000);

        continue;
      }

      return {
        success: false,

        error: errorMessage,

        response: responseData,
      };
    } catch (error) {
      console.error("[Instagram Send API] Network error:", error);

      if (attempt < MAX_API_RETRIES) {
        await sleep(attempt * 1000);

        continue;
      }

      return {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown Instagram API error",
      };
    }
  }

  return {
    success: false,

    error: "Instagram API request failed",
  };
}

export async function sendAutomationMessage(
  payload: AutomationMessagePayload,
): Promise<SendAutomationMessageResult> {
  const { accessToken, recipientId, instagramUserId, message } = payload;

  if (!accessToken) {
    throw new Error("Instagram access token is missing");
  }

  if (!recipientId) {
    throw new Error("Instagram recipient ID is missing");
  }

  if (!instagramUserId) {
    throw new Error("Instagram professional account ID is missing");
  }

  console.log("[Automation] Sending message:", {
    messageId: message.id,

    messageType: message.messageType,

    recipientId,

    instagramUserId,
  });

  // =========================================================
  // TEXT
  // =========================================================

  if (message.messageType === "TEXT") {
    if (!message.text || !message.text.trim()) {
      throw new Error("TEXT automation message requires text");
    }

    const quickReplies = message.quickReplies ?? [];

    const messageBody: Record<string, unknown> = {
      text: message.text.trim(),
    };

    if (quickReplies.length > 0) {
      const formattedQuickReplies = validateQuickReplies(quickReplies);

      messageBody.quick_replies = formattedQuickReplies;
    }

    const body: Record<string, unknown> = {
      recipient: {
        id: recipientId,
      },

      messaging_type: "RESPONSE",

      message: messageBody,
    };

    return callInstagramMessagesApi({
      instagramUserId,

      accessToken,

      body,
    });
  }

  // =========================================================
  // IMAGE / VIDEO / AUDIO
  // =========================================================

  if (
    message.messageType === "IMAGE" ||
    message.messageType === "VIDEO" ||
    message.messageType === "AUDIO"
  ) {
    if (!message.mediaUrl && !message.mediaId) {
      throw new Error(
        `${message.messageType} automation message requires mediaUrl or mediaId`,
      );
    }

    const attachmentType = getMediaAttachmentType(message.messageType);

    const payloadData: Record<string, unknown> = {};

    if (message.mediaId) {
      payloadData.attachment_id = message.mediaId;
    } else if (message.mediaUrl) {
      payloadData.url = message.mediaUrl;
    }

    const body: Record<string, unknown> = {
      recipient: {
        id: recipientId,
      },

      messaging_type: "RESPONSE",

      message: {
        attachment: {
          type: attachmentType,

          payload: payloadData,
        },
      },
    };

    return callInstagramMessagesApi({
      instagramUserId,

      accessToken,

      body,
    });
  }

  // =========================================================
  // SHOWCASE
  // =========================================================

  if (message.messageType === "SHOWCASE") {
    return {
      success: false,

      error:
        "SHOWCASE is not directly supported by the current automation sender.",
    };
  }

  // =========================================================
  // FORM
  // =========================================================

  if (message.messageType === "FORM") {
    return {
      success: false,

      error: "FORM is not directly supported by the current automation sender.",
    };
  }

  return {
    success: false,

    error: `Unsupported automation message type: ${message.messageType}`,
  };
}
