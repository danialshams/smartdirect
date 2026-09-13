import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;

type ReactToInstagramMessageInput = {
  instagramAccountId: string;
  recipientId: string;
  messageId: string;
  reaction?: string;
};

type ReactToInstagramMessageResult = {
  success: boolean;
  recipientId?: string;
  messageId?: string;
  reaction?: string;
  error?: string;
  meta?: unknown;
};

function createTimeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true },
  );

  return controller.signal;
}

export async function reactToInstagramMessage({
  instagramAccountId,
  recipientId,
  messageId,
  reaction = "love",
}: ReactToInstagramMessageInput): Promise<ReactToInstagramMessageResult> {
  try {
    if (!instagramAccountId) {
      return {
        success: false,
        error: "شناسه Instagram Account الزامی است.",
      };
    }

    if (!recipientId) {
      return {
        success: false,
        error: "شناسه گیرنده پیام الزامی است.",
      };
    }

    if (!messageId) {
      return {
        success: false,
        error: "شناسه پیام الزامی است.",
      };
    }

    const instagramAccount = await prisma.instagramAccount.findUnique({
      where: {
        id: instagramAccountId,
      },
      select: {
        id: true,
        igUserId: true,
      },
    });

    if (!instagramAccount) {
      return {
        success: false,
        error: "اکانت اینستاگرام پیدا نشد.",
      };
    }

    const accessToken = await getValidInstagramAccessToken(instagramAccount.id);

    const url =
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}` +
      `/${encodeURIComponent(instagramAccount.igUserId)}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: recipientId,
        },
        sender_action: "react",
        payload: {
          message_id: messageId,
          reaction,
        },
      }),
      signal: createTimeoutSignal(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("[Instagram Message Reaction] Meta API error:", {
        status: response.status,
        data,
        instagramAccountId,
        igUserId: instagramAccount.igUserId,
        recipientId,
        messageId,
        reaction,
      });

      return {
        success: false,
        recipientId,
        messageId,
        reaction,
        error:
          data?.error?.message ||
          `Instagram API request failed with status ${response.status}.`,
        meta: data,
      };
    }

    console.log("[Instagram Message Reaction] Success:", {
      instagramAccountId,
      igUserId: instagramAccount.igUserId,
      recipientId,
      messageId,
      reaction,
      data,
    });

    return {
      success: true,
      recipientId,
      messageId,
      reaction,
      meta: data,
    };
  } catch (error) {
    console.error("[Instagram Message Reaction] Unexpected error:", error);

    return {
      success: false,
      recipientId,
      messageId,
      reaction,
      error:
        error instanceof Error
          ? error.message
          : "خطای ناشناخته هنگام واکنش به پیام.",
    };
  }
}
