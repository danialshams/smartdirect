import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";

type ReactToCommentResult = {
  success: boolean;
  commentId: string;
  error?: string;
};

export async function likeInstagramComment({
  instagramAccountId,
  commentId,
}: {
  instagramAccountId: string;
  commentId: string;
}): Promise<ReactToCommentResult> {
  try {
    if (!instagramAccountId) return { success: false, commentId, error: "Instagram account ID is missing" };
    if (!commentId) return { success: false, commentId, error: "Instagram comment ID is missing" };

    const accessToken = await getValidInstagramAccessToken(instagramAccountId);

    await instagramApiRequest(`${encodeURIComponent(commentId)}/likes`, {
      method: "POST",
      accessToken,
    });

    return { success: true, commentId };
  } catch (error) {
    return {
      success: false,
      commentId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
