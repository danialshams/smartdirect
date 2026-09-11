import { prisma } from "@/lib/prisma";

const INSTAGRAM_API_VERSION = "v26.0";

// حدود 60 روز
const DEFAULT_TOKEN_LIFETIME_SECONDS = 60 * 24 * 60 * 60;

// وقتی کمتر از 7 روز مانده، refresh می‌کنیم
const REFRESH_THRESHOLD_SECONDS = 7 * 24 * 60 * 60;

type InstagramTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

function getInstagramAppSecret(): string {
  const secret = process.env.INSTAGRAM_CLIENT_SECRET;

  if (!secret) {
    throw new Error("INSTAGRAM_CLIENT_SECRET is not configured");
  }

  return secret;
}

/**
 * تبدیل Short-Lived Token به Long-Lived Token
 */
export async function exchangeInstagramToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  expiresIn: number;
}> {
  const clientSecret = getInstagramAppSecret();

  const url = new URL("https://graph.instagram.com/access_token");

  url.searchParams.set("grant_type", "ig_exchange_token");

  url.searchParams.set("client_secret", clientSecret);

  url.searchParams.set("access_token", shortLivedToken);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as InstagramTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error("[Instagram Token] Long-lived token exchange failed:", {
      status: response.status,
      error: data.error,
    });

    throw new Error(
      data.error?.message ||
        "تبدیل توکن اینستاگرام به Long-Lived Token ناموفق بود",
    );
  }

  const expiresIn =
    typeof data.expires_in === "number"
      ? data.expires_in
      : DEFAULT_TOKEN_LIFETIME_SECONDS;

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
 * Refresh کردن Long-Lived Token
 *
 * Token باید هنوز معتبر باشد و حداقل 24 ساعت از
 * دریافت/refresh قبلی آن گذشته باشد.
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
  });

  if (!account) {
    throw new Error("Instagram account not found");
  }

  if (!account.accessToken) {
    throw new Error("Instagram access token is missing");
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  
  url.searchParams.set("grant_type", "ig_refresh_token");

  url.searchParams.set("access_token", account.accessToken);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as InstagramTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error("[Instagram Token] Refresh failed:", {
      instagramAccountId,
      status: response.status,
      error: data.error,
    });

    // اگر Meta توکن را invalid کرده باشد،
    // اتصال را قطع‌شده علامت می‌زنیم.
    await prisma.instagramAccount.update({
      where: {
        id: instagramAccountId,
      },
      data: {
        isConnected: false,
      },
    });

    throw new Error(data.error?.message || "تمدید توکن اینستاگرام ناموفق بود");
  }

  const expiresIn =
    typeof data.expires_in === "number"
      ? data.expires_in
      : DEFAULT_TOKEN_LIFETIME_SECONDS;

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
  });

  console.log("[Instagram Token] Token refreshed successfully:", {
    instagramAccountId: updatedAccount.id,
    igUserId: updatedAccount.igUserId,
    username: updatedAccount.igUsername,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * بررسی اینکه Token نیاز به Refresh دارد یا خیر
 */
function shouldRefreshToken(tokenExpiresAt: Date | null): boolean {
  if (!tokenExpiresAt) {
    return true;
  }

  const remainingSeconds = (tokenExpiresAt.getTime() - Date.now()) / 1000;

  return remainingSeconds <= REFRESH_THRESHOLD_SECONDS;
}

/**
 * همیشه از این تابع برای گرفتن Token استفاده کن.
 *
 * اگر Token سالم باشد:
 * همان Token را برمی‌گرداند.
 *
 * اگر کمتر از 7 روز تا انقضا مانده باشد:
 * Token را Refresh می‌کند.
 */
export async function getValidInstagramAccessToken(
  instagramAccountId: string,
): Promise<string> {
  const account = await prisma.instagramAccount.findUnique({
    where: {
      id: instagramAccountId,
    },
    select: {
      id: true,
      accessToken: true,
      tokenExpiresAt: true,
      isConnected: true,
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

  if (!shouldRefreshToken(account.tokenExpiresAt)) {
    return account.accessToken;
  }

  console.log("[Instagram Token] Token needs refresh:", {
    instagramAccountId,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
  });

  const refreshed = await refreshInstagramToken(instagramAccountId);

  return refreshed.accessToken;
}
