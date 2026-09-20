import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";

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

    const data = await instagramApiRequest(
      `${encodeURIComponent(instagramAccount.igUserId)}/messages`,
      {
        method: "POST",
        accessToken,
        rateLimit: { instagramAccountId: instagramAccount.id, operation: "MESSAGE_TEXT" },
        body: {
          recipient: { id: recipientId },
          sender_action: "react",
          payload: { message_id: messageId, reaction },
        },
      },
    );

    return { success: true, recipientId, messageId, reaction, meta: data };
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
