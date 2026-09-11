import { AutomationMessageType } from "@/generated/prisma/client";
import { createPublicFormToken } from "@/lib/forms/public-form-token";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { prisma } from "@/lib/prisma";

const INSTAGRAM_API_VERSION = "v26.0";

const MAX_API_RETRIES = 2;

const MAX_QUICK_REPLIES = 13;

const MAX_QUICK_REPLY_TITLE_LENGTH = 20;

const MAX_SHOWCASE_ITEMS = 10;

const FORM_TOKEN_EXPIRATION = "30d";

type QuickReplyPayload = {
  id: string;
  title: string;
  payload: string;
};

export type AutomationMessagePayload = {
  instagramAccountId: string;

  /**
   * Instagram-scoped ID شخصی که باید پیام را دریافت کند.
   */
  recipientId: string;

  /**
   * Instagram Professional Account ID
   * متعلق به SmartDirect.
   */
  instagramUserId: string;

  message: {
    id: string;

    messageType: AutomationMessageType;

    text: string | null;

    mediaUrl: string | null;

    mediaId: string | null;

    showcaseId?: string | null;

    formId?: string | null;

    quickReplies?: QuickReplyPayload[];
  };
};

export type SendAutomationMessageResult = {
  success: boolean;

  igMessageId?: string;

  recipientId?: string;

  error?: string;

  response?: unknown;

  /**
   * متنی که برای ثبت در ConversationMessage استفاده می‌شود.
   */
  conversationText?: string | null;

  /**
   * URL تولیدشده برای فرم.
   */
  formUrl?: string;
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

function getPublicAppUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (vercelProductionUrl) {
    return `https://${vercelProductionUrl.replace(/^https?:\/\//, "")}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  }

  throw new Error(
    "Public application URL is missing. Set NEXT_PUBLIC_APP_URL in production.",
  );
}

async function createPublicFormUrl({
  formId,
  instagramAccountId,
  instagramUserId,
  recipientId,
}: {
  formId: string;

  instagramAccountId: string;

  instagramUserId: string;

  recipientId: string;
}): Promise<string> {
  const token = await createPublicFormToken({
    formId,
    instagramAccountId,
    instagramUserId,
    recipientId,
  });

  const baseUrl = getPublicAppUrl();

  return `${baseUrl}/form/${encodeURIComponent(token)}`;
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

      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,

          error: errorMessage,

          response: responseData,
        };
      }

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

async function sendShowcase({
  instagramAccountId,
  instagramUserId,
  recipientId,
  accessToken,
  showcaseId,
}: {
  instagramAccountId: string;

  instagramUserId: string;

  recipientId: string;

  accessToken: string;

  showcaseId: string;
}): Promise<SendAutomationMessageResult> {
  const showcase = await prisma.showcase.findFirst({
    where: {
      id: showcaseId,

      instagramAccountId,

      isActive: true,
    },

    include: {
      items: {
        where: {
          isActive: true,
        },

        orderBy: {
          order: "asc",
        },

        take: MAX_SHOWCASE_ITEMS,
      },
    },
  });

  if (!showcase) {
    throw new Error("Showcase not found or inactive");
  }

  if (showcase.items.length === 0) {
    throw new Error("Showcase has no active items");
  }

  const elements = showcase.items.map((item) => {
    const element: Record<string, unknown> = {
      title: item.title.trim(),
    };

    if (item.description?.trim()) {
      element.subtitle = item.description.trim();
    }

    if (item.imageUrl?.trim()) {
      element.image_url = item.imageUrl.trim();
    }

    if (item.linkUrl?.trim()) {
      element.default_action = {
        type: "web_url",

        url: item.linkUrl.trim(),
      };

      element.buttons = [
        {
          type: "web_url",

          url: item.linkUrl.trim(),

          title: (item.buttonText?.trim() || "مشاهده").slice(0, 20),
        },
      ];
    }

    return element;
  });

  const body: Record<string, unknown> = {
    recipient: {
      id: recipientId,
    },

    messaging_type: "RESPONSE",

    message: {
      attachment: {
        type: "template",

        payload: {
          template_type: "generic",

          elements,
        },
      },
    },
  };

  const result = await callInstagramMessagesApi({
    instagramUserId,

    accessToken,

    body,
  });

  if (result.success) {
    result.conversationText =
      showcase.description?.trim() || showcase.title.trim();
  }

  return result;
}

async function sendForm({
  instagramAccountId,
  instagramUserId,
  recipientId,
  accessToken,
  formId,
}: {
  instagramAccountId: string;

  instagramUserId: string;

  recipientId: string;

  accessToken: string;

  formId: string;
}): Promise<SendAutomationMessageResult> {
  const form = await prisma.form.findFirst({
    where: {
      id: formId,

      instagramAccountId,

      isActive: true,
    },

    include: {
      fields: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!form) {
    throw new Error("Form not found or inactive");
  }

  if (form.fields.length === 0) {
    throw new Error("Form has no fields");
  }

  const formUrl = await createPublicFormUrl({
    formId: form.id,

    instagramAccountId,

    instagramUserId,

    recipientId,
  });

  const element: Record<string, unknown> = {
    title: form.title.trim(),

    subtitle: (
      form.description?.trim() || "برای تکمیل فرم روی دکمه زیر بزنید."
    ).slice(0, 640),

    buttons: [
      {
        type: "web_url",

        url: formUrl,

        title: "تکمیل فرم",
      },
    ],
  };

  const body: Record<string, unknown> = {
    recipient: {
      id: recipientId,
    },

    messaging_type: "RESPONSE",

    message: {
      attachment: {
        type: "template",

        payload: {
          template_type: "generic",

          elements: [element],
        },
      },
    },
  };

  const result = await callInstagramMessagesApi({
    instagramUserId,

    accessToken,

    body,
  });

  if (result.success) {
    result.formUrl = formUrl;

    result.conversationText = form.title.trim();
  }

  return result;
}

export async function sendAutomationMessage(
  payload: AutomationMessagePayload,
): Promise<SendAutomationMessageResult> {
  const { instagramAccountId, recipientId, instagramUserId, message } = payload;

  if (!instagramAccountId) {
    throw new Error("Instagram account ID is missing");
  }

  if (!recipientId) {
    throw new Error("Instagram recipient ID is missing");
  }

  if (!instagramUserId) {
    throw new Error("Instagram professional account ID is missing");
  }

  const accessToken = await getValidInstagramAccessToken(instagramAccountId);

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

    const result = await callInstagramMessagesApi({
      instagramUserId,

      accessToken,

      body,
    });

    if (result.success) {
      result.conversationText = message.text.trim();
    }

    return result;
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

    const result = await callInstagramMessagesApi({
      instagramUserId,

      accessToken,

      body,
    });

    if (result.success) {
      result.conversationText = null;
    }

    return result;
  }

  // =========================================================
  // SHOWCASE
  // =========================================================

  if (message.messageType === "SHOWCASE") {
    if (!message.showcaseId) {
      throw new Error("SHOWCASE automation message requires showcaseId");
    }

    return sendShowcase({
      instagramAccountId,

      instagramUserId,

      recipientId,

      accessToken,

      showcaseId: message.showcaseId,
    });
  }

  // =========================================================
  // FORM
  // =========================================================

  if (message.messageType === "FORM") {
    if (!message.formId) {
      throw new Error("FORM automation message requires formId");
    }

    return sendForm({
      instagramAccountId,

      instagramUserId,

      recipientId,

      accessToken,

      formId: message.formId,
    });
  }

  return {
    success: false,

    error: `Unsupported automation message type: ${message.messageType}`,
  };
}
