import { prisma } from "@/lib/prisma";
import { InstagramApiError, instagramApiRequest } from "@/lib/instagram/client";
import { deleteCachedJson, getCachedJson, setCachedJson, cacheKey } from "@/lib/cache/redis-cache";

const REFRESH_THRESHOLD_SECONDS = 7 * 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 15000;

type InstagramTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };

  error_type?: string;
  error_message?: string;
};

type InstagramTokenResult = {
  accessToken: string;
  expiresAt: Date;
  expiresIn: number;
};

function getInstagramAppSecret(): string {
  const secret = process.env.INSTAGRAM_CLIENT_SECRET;

  if (!secret) {
    throw new Error("INSTAGRAM_CLIENT_SECRET is not configured");
  }

  return secret;
}

function getErrorMessage(data: InstagramTokenResponse): string {
  return (
    data.error?.message ||
    data.error_message ||
    "Instagram token operation failed"
  );
}

function getRemainingSeconds(tokenExpiresAt: Date | null): number | null {
  if (!tokenExpiresAt) {
    return null;
  }

  return Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000);
}

function isTokenExpired(tokenExpiresAt: Date | null): boolean {
  if (!tokenExpiresAt) {
    return true;
  }

  return tokenExpiresAt.getTime() <= Date.now();
}

function shouldRefreshToken(tokenExpiresAt: Date | null): boolean {
  if (!tokenExpiresAt) {
    return true;
  }

  const remainingSeconds = getRemainingSeconds(tokenExpiresAt);

  if (remainingSeconds === null) {
    return true;
  }

  return remainingSeconds <= REFRESH_THRESHOLD_SECONDS;
}

async function fetchInstagram<T = InstagramTokenResponse>(
  params: Record<string, string>,
): Promise<T> {
  return instagramApiRequest<T>("", {
    method: "GET",
    params,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}

/**
 * =========================================================
 * Short-Lived Token -> Long-Lived Token
 * =========================================================
 */
export async function exchangeInstagramToken(
  shortLivedToken: string,
): Promise<InstagramTokenResult> {
  if (!shortLivedToken) {
    throw new Error("Instagram short-lived access token is missing");
  }

  const clientSecret = getInstagramAppSecret();

  console.log(
    "[Instagram Token] Exchanging short-lived token for long-lived token...",
  );

  let data: InstagramTokenResponse;

  try {
    data = await fetchInstagram<InstagramTokenResponse>({
      grant_type: "ig_exchange_token",
      client_secret: clientSecret,
      access_token: shortLivedToken,
    });
  } catch (error) {
    console.error(
      "[Instagram Token] Long-lived token exchange request failed:",
      error,
    );

    throw new Error("Instagram token exchange request failed");
  }

  if (!data.access_token) {
    console.error("[Instagram Token] Long-lived token exchange failed:", {
      status: data.error?.code,
      error: data.error,
      error_type: data.error_type,
      error_message: data.error_message,
    });

    throw new Error(getErrorMessage(data));
  }

  /**
   * expiration باید از خود Meta دریافت شود.
   *
   * هیچ مقدار پیش‌فرضی مثل 60 روز قرار نمی‌دهیم.
   */
  if (typeof data.expires_in !== "number" || data.expires_in <= 0) {
    console.error(
      "[Instagram Token] Meta did not return a valid expires_in:",
      data,
    );

    throw new Error("Instagram did not return a valid token expiration time");
  }

  const expiresIn = Math.floor(data.expires_in);

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  console.log("[Instagram Token] Long-lived token received:", {
    expiresIn,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    accessToken: data.access_token,
    expiresAt,
    expiresIn,
  };
}

/**
 * =========================================================
 * Refresh Long-Lived Token
 * =========================================================
 */
export async function refreshInstagramToken(
  instagramAccountId: string,
): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const account = await prisma.instagramAccount.findUnique({
    where: {
      id: instagramAccountId,
    },
    select: {
      id: true,
      accessToken: true,
      tokenExpiresAt: true,
      isConnected: true,
      igUserId: true,
      igUsername: true,
    },
  });

  if (!account) {
    throw new Error("Instagram account not found");
  }

  if (!account.isConnected) {
    throw new Error("Instagram account is not connected");
  }

  if (!account.accessToken) {
    throw new Error("Instagram access token is missing");
  }

  /**
   * اگر Token هنوز معتبر است و بیشتر از 7 روز
   * اعتبار دارد، اصلاً Refresh نمی‌کنیم.
   *
   * این check باعث می‌شود اگر Cron یا Webhook
   * اشتباهی این تابع را زود صدا زد، Refresh بی‌دلیل
   * انجام نشود.
   */
  if (
    account.tokenExpiresAt &&
    !isTokenExpired(account.tokenExpiresAt) &&
    !shouldRefreshToken(account.tokenExpiresAt)
  ) {
    console.log("[Instagram Token] Token is still healthy. Refresh skipped:", {
      instagramAccountId,
      igUserId: account.igUserId,
      username: account.igUsername,
      expiresAt: account.tokenExpiresAt.toISOString(),
      remainingSeconds: getRemainingSeconds(account.tokenExpiresAt),
    });

    return {
      accessToken: account.accessToken,
      expiresAt: account.tokenExpiresAt,
    };
  }

  console.log("[Instagram Token] Refreshing token:", {
    instagramAccountId,
    igUserId: account.igUserId,
    username: account.igUsername,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    remainingSeconds: getRemainingSeconds(account.tokenExpiresAt),
  });

  let data: InstagramTokenResponse;

  try {
    data = await fetchInstagram<InstagramTokenResponse>({
      grant_type: "ig_refresh_token",
      access_token: account.accessToken,
    });
  } catch (error) {
    console.error("[Instagram Token] Refresh request failed:", {
      instagramAccountId,
      error,
    });

    /**
     * خطای شبکه یا timeout نباید باعث شود
     * اکانت disconnected شود.
     */
    throw new Error("Instagram token refresh request failed");
  }

  if (!data.access_token) {
    const errorCode = data.error?.code;
    const errorSubcode = data.error?.error_subcode;
    const errorMessage = getErrorMessage(data);

    console.error("[Instagram Token] Refresh failed:", {
      instagramAccountId,
      igUserId: account.igUserId,
      username: account.igUsername,
      status: errorCode,
      errorCode,
      errorSubcode,
      error: data.error,
      errorMessage,
    });

    /**
     * Error 190 یعنی Token دیگر معتبر نیست.
     *
     * در این حالت اتصال را قطع می‌کنیم
     * تا کاربر دوباره OAuth انجام دهد.
     */
    if (errorCode === 190) {
      await prisma.instagramAccount.update({
        where: {
          id: instagramAccountId,
        },
        data: {
          isConnected: false,
        },
      });

      await deleteCachedJson(cacheKey("instagram-token", instagramAccountId));
      await deleteCachedJson(cacheKey("instagram-account", instagramAccountId));
      throw new Error(
        "Instagram access token has expired and must be reconnected",
      );
    }

    /**
     * سایر خطاها را موقت در نظر می‌گیریم.
     *
     * مثلاً:
     * - rate limit
     * - server error
     * - network issue
     *
     * در این شرایط isConnected را تغییر نمی‌دهیم.
     */
    throw new Error(errorMessage);
  }

  /**
   * Refresh موفق بوده ولی Meta expiration
   * معتبر برنگردانده است.
   */
  if (typeof data.expires_in !== "number" || data.expires_in <= 0) {
    console.error(
      "[Instagram Token] Refresh succeeded but expires_in is invalid:",
      {
        instagramAccountId,
        data,
      },
    );

    throw new Error(
      "Instagram refresh response does not contain a valid expires_in",
    );
  }

  const expiresIn = Math.floor(data.expires_in);

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const updatedAccount = await prisma.instagramAccount.update({
    where: {
      id: instagramAccountId,
    },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
      isConnected: true,
    },
    select: {
      id: true,
      igUserId: true,
      igUsername: true,
      tokenExpiresAt: true,
    },
  });

  await setCachedJson(
    cacheKey("instagram-token", instagramAccountId),
    { accessToken: data.access_token, expiresAt: expiresAt.toISOString() },
    Math.min(300, Math.max(1, expiresIn)),
  );
  await deleteCachedJson(cacheKey("instagram-account", instagramAccountId));

  console.log("[Instagram Token] Token refreshed successfully:", {
    instagramAccountId: updatedAccount.id,
    igUserId: updatedAccount.igUserId,
    username: updatedAccount.igUsername,
    expiresIn,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * =========================================================
 * Get Valid Instagram Access Token
 * =========================================================
 */
export async function getValidInstagramAccessToken(
  instagramAccountId: string,
): Promise<string> {
  const cachedToken = await getCachedJson<{ accessToken: string; expiresAt: string }>(cacheKey("instagram-token", instagramAccountId));
  if (
    cachedToken &&
    new Date(cachedToken.expiresAt).getTime() - Date.now() > REFRESH_THRESHOLD_SECONDS * 1000
  ) {
    return cachedToken.accessToken;
  }

  const account = await prisma.instagramAccount.findUnique({
    where: {
      id: instagramAccountId,
    },
    select: {
      id: true,
      accessToken: true,
      tokenExpiresAt: true,
      isConnected: true,
      igUserId: true,
      igUsername: true,
    },
  });

  if (!account) {
    throw new Error("Instagram account not found");
  }

  if (!account.isConnected) {
    throw new Error("Instagram account is not connected. Reconnect Instagram.");
  }

  if (!account.accessToken) {
    throw new Error("Instagram access token is missing");
  }

  /**
   * رکوردهای قدیمی ممکن است tokenExpiresAt نداشته باشند.
   *
   * یک بار تلاش می‌کنیم Token را Refresh کنیم.
   *
   * اگر Token واقعاً منقضی شده باشد، Meta خطای 190
   * می‌دهد و refreshInstagramToken اکانت را
   * disconnected می‌کند.
   */
  if (!account.tokenExpiresAt) {
    console.warn("[Instagram Token] tokenExpiresAt is NULL:", {
      instagramAccountId,
      igUserId: account.igUserId,
      username: account.igUsername,
    });

    const refreshed = await refreshInstagramToken(instagramAccountId);

    return refreshed.accessToken;
  }

  const remainingSeconds = getRemainingSeconds(account.tokenExpiresAt);

  /**
   * بیشتر از 7 روز اعتبار دارد.
   * نیازی به Refresh نیست.
   */
  if (
    remainingSeconds !== null &&
    remainingSeconds > REFRESH_THRESHOLD_SECONDS
  ) {
    return account.accessToken;
  }

  /**
   * Token به محدوده Refresh رسیده است.
   */
  console.log("[Instagram Token] Token needs refresh:", {
    instagramAccountId,
    igUserId: account.igUserId,
    username: account.igUsername,
    tokenExpiresAt: account.tokenExpiresAt.toISOString(),
    remainingSeconds,
    remainingDays:
      remainingSeconds !== null
        ? (remainingSeconds / (24 * 60 * 60)).toFixed(2)
        : null,
  });

  const refreshed = await refreshInstagramToken(instagramAccountId);

  return refreshed.accessToken;
}
