import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeInstagramToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 15000;
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type InstagramOAuthTokenResponse = {
  access_token?: string;
  user_id?: string | number;
  permissions?: string[];

  error?: string;
  error_type?: string;
  error_message?: string;
};

type InstagramProfileResponse = {
  id?: string;
  user_id?: string;
  username?: string;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };

  error_type?: string;
  error_message?: string;
};

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL || request.url;
}

function redirectToDashboard(request: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(
      `/dashboard?instagram=${encodeURIComponent(status)}`,
      getBaseUrl(request),
    ),
  );
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Instagram returned an invalid JSON response");
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    const oauthError = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    // =========================================================
    // 1. Instagram OAuth Error
    // =========================================================

    if (oauthError) {
      console.error("[Instagram OAuth] OAuth error:", {
        error: oauthError,
        errorReason,
        errorDescription,
      });

      return redirectToDashboard(request, "error");
    }

    // =========================================================
    // 2. Authorization Code
    // =========================================================

    if (!code) {
      console.error("[Instagram OAuth] Authorization code is missing");

      return redirectToDashboard(request, "code_missing");
    }

    // =========================================================
    // 3. State
    // =========================================================

    if (!state) {
      console.error("[Instagram OAuth] State is missing");

      return redirectToDashboard(request, "state_missing");
    }

    // =========================================================
    // 4. Decode State
    // =========================================================

    let stateData: {
      userId: string;
      timestamp: number;
    };

    try {
      const decodedState = Buffer.from(state, "base64url").toString("utf-8");

      stateData = JSON.parse(decodedState);
    } catch (error) {
      console.error("[Instagram OAuth] Invalid state:", error);

      return redirectToDashboard(request, "invalid_state");
    }

    // =========================================================
    // 5. Validate State Data
    // =========================================================

    if (
      !stateData ||
      typeof stateData.userId !== "string" ||
      !stateData.userId ||
      typeof stateData.timestamp !== "number" ||
      !Number.isFinite(stateData.timestamp)
    ) {
      console.error("[Instagram OAuth] Invalid state data");

      return redirectToDashboard(request, "invalid_state");
    }

    // =========================================================
    // 6. Validate State Age
    // =========================================================

    const stateAge = Date.now() - stateData.timestamp;

    if (stateAge < 0 || stateAge > STATE_MAX_AGE_MS) {
      console.error("[Instagram OAuth] State expired or invalid:", {
        stateAge,
      });

      return redirectToDashboard(request, "state_expired");
    }

    // =========================================================
    // 7. Environment Variables
    // =========================================================

    const clientId = process.env.INSTAGRAM_CLIENT_ID;

    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId) {
      console.error("[Instagram OAuth] INSTAGRAM_CLIENT_ID is missing");

      return redirectToDashboard(request, "configuration_error");
    }

    if (!clientSecret) {
      console.error("[Instagram OAuth] INSTAGRAM_CLIENT_SECRET is missing");

      return redirectToDashboard(request, "configuration_error");
    }

    if (!redirectUri) {
      console.error("[Instagram OAuth] INSTAGRAM_REDIRECT_URI is missing");

      return redirectToDashboard(request, "configuration_error");
    }

    // =========================================================
    // 8. Exchange Authorization Code
    // =========================================================

    console.log("[Instagram OAuth] Exchanging authorization code...");

    let tokenResponse: Response;

    try {
      tokenResponse = await fetchWithTimeout(
        "https://api.instagram.com/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }).toString(),
        },
      );
    } catch (error) {
      console.error(
        "[Instagram OAuth] Authorization code exchange request failed:",
        error,
      );

      return redirectToDashboard(request, "token_fetch_error");
    }

    let tokenData: InstagramOAuthTokenResponse;

    try {
      tokenData =
        await readJsonResponse<InstagramOAuthTokenResponse>(tokenResponse);
    } catch (error) {
      console.error("[Instagram OAuth] Token response parsing failed:", error);

      return redirectToDashboard(request, "token_invalid_response");
    }

    console.log("[Instagram OAuth] Short-lived token response:", {
      success: tokenResponse.ok,
      status: tokenResponse.status,
      user_id: tokenData.user_id,
      has_access_token: Boolean(tokenData.access_token),
      error: tokenData.error,
      error_type: tokenData.error_type,
      error_message: tokenData.error_message,
    });

    // =========================================================
    // 9. Validate Short-Lived Token
    // =========================================================

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[Instagram OAuth] Authorization code exchange failed:", {
        status: tokenResponse.status,
        error: tokenData.error,
        error_type: tokenData.error_type,
        error_message: tokenData.error_message,
      });

      return redirectToDashboard(request, "token_error");
    }

    const shortLivedToken = String(tokenData.access_token);

    const tokenUserId = tokenData.user_id ? String(tokenData.user_id) : null;

    // =========================================================
    // 10. Short-Lived -> Long-Lived Token
    // =========================================================

    console.log(
      "[Instagram OAuth] Exchanging short-lived token for long-lived token...",
    );

    let longLivedTokenData;

    try {
      longLivedTokenData = await exchangeInstagramToken(shortLivedToken);
    } catch (error) {
      console.error(
        "[Instagram OAuth] Long-lived token exchange failed:",
        error,
      );

      return redirectToDashboard(request, "long_lived_token_error");
    }

    const accessToken = longLivedTokenData.accessToken;

    const tokenExpiresAt = longLivedTokenData.expiresAt;

    console.log("[Instagram OAuth] Long-lived token ready:", {
      tokenUserId,
      expiresIn: longLivedTokenData.expiresIn,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    });

    // =========================================================
    // 11. Get Instagram Professional Account
    // =========================================================

    console.log("[Instagram OAuth] Getting Instagram profile...");

    const profileUrl = new URL(
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me`,
    );

    profileUrl.searchParams.set("fields", "id,user_id,username");

    profileUrl.searchParams.set("access_token", accessToken);

    let profileResponse: Response;

    try {
      profileResponse = await fetchWithTimeout(profileUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error("[Instagram OAuth] Profile request failed:", error);

      return redirectToDashboard(request, "profile_fetch_error");
    }

    let profileData: InstagramProfileResponse;

    try {
      profileData =
        await readJsonResponse<InstagramProfileResponse>(profileResponse);
    } catch (error) {
      console.error(
        "[Instagram OAuth] Profile response parsing failed:",
        error,
      );

      return redirectToDashboard(request, "profile_invalid_json");
    }

    console.log("[Instagram OAuth] Profile response:", {
      status: profileResponse.status,
      ok: profileResponse.ok,
      id: profileData.id,
      user_id: profileData.user_id,
      username: profileData.username,
      error: profileData.error,
      error_type: profileData.error_type,
      error_message: profileData.error_message,
    });

    // =========================================================
    // 12. Validate Profile Response
    // =========================================================

    if (!profileResponse.ok) {
      console.error("[Instagram OAuth] Profile request failed:", {
        status: profileResponse.status,
        data: profileData,
        tokenUserId,
      });

      return redirectToDashboard(request, "profile_error");
    }

    if (!profileData.user_id) {
      console.error(
        "[Instagram OAuth] Instagram professional user_id is missing:",
        profileData,
      );

      return redirectToDashboard(request, "instagram_user_id_missing");
    }

    // =========================================================
    // 13. Instagram Account Data
    // =========================================================

    const instagramUserId = String(profileData.user_id);

    const instagramAppScopedId = profileData.id
      ? String(profileData.id)
      : undefined;

    const instagramUsername = profileData.username?.trim() || "";

    if (!instagramUsername) {
      console.error(
        "[Instagram OAuth] Instagram username is missing:",
        profileData,
      );

      return redirectToDashboard(request, "instagram_username_missing");
    }

    console.log("[Instagram OAuth] Account information:", {
      tokenUserId,
      appScopedId: instagramAppScopedId,
      professionalUserId: instagramUserId,
      username: instagramUsername,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    });

    // =========================================================
    // 14. Find Existing Instagram Account
    // =========================================================

    console.log("[Instagram OAuth] Checking existing account...");

    const existingAccount = await prisma.instagramAccount.findFirst({
      where: {
        userId: stateData.userId,

        OR: [
          {
            igUserId: instagramUserId,
          },
          {
            igUsername: instagramUsername,
          },
        ],
      },
    });

    // =========================================================
    // 15. Save Instagram Account
    // =========================================================

    console.log("[Instagram OAuth] Saving Instagram account...");

    let instagramAccount;

    if (existingAccount) {
      console.log("[Instagram OAuth] Existing account found. Updating...");

      instagramAccount = await prisma.instagramAccount.update({
        where: {
          id: existingAccount.id,
        },
        data: {
          igUserId: instagramUserId,

          igUsername: instagramUsername,

          accessToken: accessToken,

          tokenExpiresAt: tokenExpiresAt,

          isConnected: true,
        },
      });
    } else {
      console.log("[Instagram OAuth] Creating new Instagram account...");

      instagramAccount = await prisma.instagramAccount.create({
        data: {
          userId: stateData.userId,

          igUserId: instagramUserId,

          igUsername: instagramUsername,

          accessToken: accessToken,

          tokenExpiresAt: tokenExpiresAt,

          isConnected: true,
        },
      });
    }

    // =========================================================
    // 16. Final Verification
    // =========================================================

    console.log("========================================");

    console.log("INSTAGRAM CONNECTION COMPLETE");

    console.log("Database account ID:", instagramAccount.id);

    console.log("Instagram user ID:", instagramAccount.igUserId);

    console.log("Instagram username:", instagramAccount.igUsername);

    console.log(
      "Token expires at:",
      instagramAccount.tokenExpiresAt?.toISOString(),
    );

    console.log("Connected:", instagramAccount.isConnected);

    console.log("========================================");

    // =========================================================
    // 17. Redirect
    // =========================================================

    return redirectToDashboard(request, "connected");
  } catch (error) {
    console.error("[Instagram OAuth] Unexpected callback error:", error);

    return redirectToDashboard(request, "error");
  }
}
