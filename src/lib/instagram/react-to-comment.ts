import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15_000;

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
    if (!instagramAccountId) {
      return {
        success: false,
        commentId,
        error: "Instagram account ID is missing",
      };
    }

    if (!commentId) {
      return {
        success: false,
        commentId,
        error: "Instagram comment ID is missing",
      };
    }

    const accessToken = await getValidInstagramAccessToken(instagramAccountId);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const url =
        `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${encodeURIComponent(commentId)}/likes` +
        `?access_token=${encodeURIComponent(accessToken)}`;

      console.log("[Instagram Comment Like] Sending like request:", {
        instagramAccountId,
        commentId,
      });

      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("[Instagram Comment Like] Meta API error:", {
          status: response.status,
          data,
          commentId,
        });

        const errorMessage =
          data?.error?.message ||
          data?.message ||
          `Instagram API returned HTTP ${response.status}`;

        return {
          success: false,
          commentId,
          error: errorMessage,
        };
      }

      console.log("[Instagram Comment Like] Like successful:", {
        commentId,
        response: data,
      });

      return {
        success: true,
        commentId,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error("[Instagram Comment Like] Unexpected error:", {
      commentId,
      error: errorMessage,
    });

    return {
      success: false,
      commentId,
      error: errorMessage,
    };
  }
}
