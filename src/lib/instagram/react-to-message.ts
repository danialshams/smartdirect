import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { InstagramApiError, instagramApiRequest } from "@/lib/instagram/client";

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

const MAX_REACTION_ATTEMPTS = 3;
const REACTION_RETRY_DELAYS_MS = [2000, 5000];

export async function reactToInstagramMessage({
  instagramAccountId,
  recipientId,
  messageId,
  reaction = "love",
}: ReactToInstagramMessageInput): Promise<ReactToInstagramMessageResult> {
  try {
    if (!instagramAccountId) return { success: false, error: "شناسه Instagram Account الزامی است." };
    if (!recipientId) return { success: false, error: "شناسه گیرنده پیام الزامی است." };
    if (!messageId) return { success: false, error: "شناسه پیام الزامی است." };

    const instagramAccount = await prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { id: true, igUserId: true },
    });

    if (!instagramAccount) return { success: false, error: "اکانت اینستاگرام پیدا نشد." };

    const accessToken = await getValidInstagramAccessToken(instagramAccount.id);

    for (let attempt = 1; attempt <= MAX_REACTION_ATTEMPTS; attempt += 1) {
      try {
        const data = await instagramApiRequest(
          `${encodeURIComponent(instagramAccount.igUserId)}/messages`,
          {
            method: "POST",
            accessToken,
            rateLimit: {
              instagramAccountId: instagramAccount.id,
              operation: "MESSAGE_REACTION",
            },
            body: {
              recipient: { id: recipientId },
              sender_action: "react",
              payload: { message_id: messageId, reaction },
            },
          },
        );

        return { success: true, recipientId, messageId, reaction, meta: data };
      } catch (error) {
        const isTransient =
          error instanceof InstagramApiError && error.status >= 500 && error.status < 600;

        if (!isTransient || attempt === MAX_REACTION_ATTEMPTS) {
          throw error;
        }

        console.warn("[Instagram Reaction] Meta returned a transient reaction error.", {
          attempt,
          nextAttempt: attempt + 1,
          status: error.status,
          code: error.details?.code,
          subcode: error.details?.error_subcode,
          message: error.details?.message,
          fbtraceId: error.details?.fbtrace_id,
        });

        await new Promise((resolve) =>
          setTimeout(
            resolve,
            REACTION_RETRY_DELAYS_MS[attempt - 1] ??
              REACTION_RETRY_DELAYS_MS[REACTION_RETRY_DELAYS_MS.length - 1],
          ),
        );
      }
    }

    return {
      success: false,
      recipientId,
      messageId,
      reaction,
      error: "Instagram reaction request failed.",
    };
  } catch (error) {
    return {
      success: false,
      recipientId,
      messageId,
      reaction,
      error: error instanceof Error ? error.message : "خطای ناشناخته هنگام واکنش به پیام.",
    };
  }
}