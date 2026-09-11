import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeInstagramToken } from "@/lib/instagram/token-manager";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // =========================================================
    // 1. Instagram OAuth Error
    // =========================================================

    if (error) {
      console.error("Instagram OAuth error:", {
        error,
        error_reason: searchParams.get("error_reason"),
        error_description: searchParams.get("error_description"),
      });

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    // =========================================================
    // 2. Authorization Code
    // =========================================================

    if (!code) {
      console.error("Instagram callback: code is missing");

      return NextResponse.json(
        {
          error: "کد احراز هویت اینستاگرام دریافت نشد",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 3. State
    // =========================================================

    if (!state) {
      console.error("Instagram callback: state is missing");

      return NextResponse.json(
        {
          error: "State دریافت نشد",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 4. Decode State
    // =========================================================

    let stateData: {
      userId: string;
      timestamp: number;
    };

    try {
      stateData = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    } catch (error) {
      console.error("Instagram callback: invalid state", error);

      return NextResponse.json(
        {
          error: "State نامعتبر است",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 5. Validate State
    // =========================================================

    if (!stateData.userId || !stateData.timestamp) {
      console.error("Instagram callback: invalid state data");

      return NextResponse.json(
        {
          error: "اطلاعات State ناقص یا نامعتبر است",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 6. State Expiration
    // =========================================================

    const stateAge = Date.now() - stateData.timestamp;

    if (stateAge > 10 * 60 * 1000) {
      console.error("Instagram callback: state expired");

      return NextResponse.json(
        {
          error: "درخواست اتصال منقضی شده است. دوباره تلاش کنید.",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 7. Environment
    // =========================================================

    const clientId = process.env.INSTAGRAM_CLIENT_ID;

    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId) {
      console.error("INSTAGRAM_CLIENT_ID is missing");

      return NextResponse.json(
        {
          error: "INSTAGRAM_CLIENT_ID تنظیم نشده است",
        },
        { status: 500 },
      );
    }

    if (!clientSecret) {
      console.error("INSTAGRAM_CLIENT_SECRET is missing");

      return NextResponse.json(
        {
          error: "INSTAGRAM_CLIENT_SECRET تنظیم نشده است",
        },
        { status: 500 },
      );
    }

    if (!redirectUri) {
      console.error("INSTAGRAM_REDIRECT_URI is missing");

      return NextResponse.json(
        {
          error: "INSTAGRAM_REDIRECT_URI تنظیم نشده است",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 8. Exchange Authorization Code
    // =========================================================

    console.log("Instagram OAuth: exchanging authorization code...");

    const tokenController = new AbortController();

    const tokenTimeout = setTimeout(() => {
      tokenController.abort();
    }, 15000);

    let tokenResponse: Response;

    try {
      tokenResponse = await fetch(
        "https://api.instagram.com/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }),
          signal: tokenController.signal,
          cache: "no-store",
        },
      );
    } catch (error) {
      console.error("Instagram token exchange FETCH ERROR:", error);

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=token_fetch_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    } finally {
      clearTimeout(tokenTimeout);
    }

    const tokenData = await tokenResponse.json();

    console.log("Instagram short-lived token response:", {
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
      console.error("Instagram token exchange failed:", {
        status: tokenResponse.status,
        error: tokenData.error,
        error_type: tokenData.error_type,
        error_message: tokenData.error_message,
      });

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=token_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    const shortLivedToken = String(tokenData.access_token);

    const tokenUserId = String(tokenData.user_id);

    // =========================================================
    // 10. Exchange Short-Lived → Long-Lived
    // =========================================================

    console.log(
      "Instagram OAuth: exchanging short-lived token for long-lived token...",
    );

    let longLivedTokenData;

    try {
      longLivedTokenData = await exchangeInstagramToken(shortLivedToken);
    } catch (error) {
      console.error("Instagram long-lived token exchange failed:", error);

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=long_lived_token_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    const accessToken = longLivedTokenData.accessToken;

    const tokenExpiresAt = longLivedTokenData.expiresAt;

    console.log("Instagram OAuth: long-lived token ready:", {
      tokenUserId,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    });

    // =========================================================
    // 11. Get Instagram Profile
    // =========================================================

    console.log("Instagram OAuth: getting Instagram professional account...");

    const profileUrl =
      `https://graph.instagram.com/${"v26.0"}/me` +
      `?fields=id,user_id,username` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    const profileController = new AbortController();

    const profileTimeout = setTimeout(() => {
      profileController.abort();
    }, 15000);

    let profileResponse: Response;

    try {
      profileResponse = await fetch(profileUrl, {
        method: "GET",
        cache: "no-store",
        signal: profileController.signal,
      });
    } catch (error) {
      console.error("Instagram profile FETCH ERROR:", error);

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=profile_fetch_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    } finally {
      clearTimeout(profileTimeout);
    }

    const profileText = await profileResponse.text();

    console.log("========================================");
    console.log("INSTAGRAM PROFILE RESPONSE");
    console.log("status:", profileResponse.status);
    console.log("ok:", profileResponse.ok);
    console.log("body:", profileText);
    console.log("========================================");

    // =========================================================
    // 12. Parse Profile
    // =========================================================

    let profileData: {
      id?: string;
      user_id?: string;
      username?: string;
    };

    try {
      profileData = JSON.parse(profileText);
    } catch {
      console.error("Instagram profile response is not valid JSON");

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=profile_invalid_json",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    // =========================================================
    // 13. Validate Profile
    // =========================================================

    if (!profileResponse.ok) {
      console.error("Instagram profile request failed:", {
        status: profileResponse.status,
        data: profileData,
        tokenUserId,
      });

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=profile_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    if (!profileData.user_id) {
      console.error(
        "Instagram profile response does not contain user_id:",
        profileData,
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=instagram_user_id_missing",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    // =========================================================
    // 14. Instagram IDs
    // =========================================================

    const instagramUserId = String(profileData.user_id);

    const instagramAppScopedId = profileData.id
      ? String(profileData.id)
      : undefined;

    const instagramUsername = profileData.username || "";

    console.log("========================================");
    console.log("INSTAGRAM OAUTH ID DEBUG");
    console.log("tokenUserId:", tokenUserId);
    console.log("appScopedId:", instagramAppScopedId);
    console.log("professionalUserId:", instagramUserId);
    console.log("username:", instagramUsername);
    console.log("tokenExpiresAt:", tokenExpiresAt.toISOString());
    console.log("========================================");

    // =========================================================
    // 15. Find Existing Account
    // =========================================================

    console.log("Instagram OAuth: checking existing account...");

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
    // 16. Save Instagram Account
    // =========================================================

    console.log("Instagram OAuth: saving account to database...");

    let instagramAccount;

    if (existingAccount) {
      console.log("Existing Instagram account found. Updating...");

      instagramAccount = await prisma.instagramAccount.update({
        where: {
          id: existingAccount.id,
        },
        data: {
          igUserId: instagramUserId,

          igUsername: instagramUsername,

          accessToken,

          tokenExpiresAt,

          isConnected: true,
        },
      });
    } else {
      console.log(
        "No existing Instagram account found. Creating new account...",
      );

      instagramAccount = await prisma.instagramAccount.create({
        data: {
          userId: stateData.userId,

          igUserId: instagramUserId,

          igUsername: instagramUsername,

          accessToken,

          tokenExpiresAt,

          isConnected: true,
        },
      });
    }

    // =========================================================
    // 17. Final Log
    // =========================================================

    console.log("========================================");

    console.log("INSTAGRAM CONNECTION COMPLETE");

    console.log("Webhook-compatible Instagram ID:", instagramAccount.igUserId);

    console.log("Instagram username:", instagramAccount.igUsername);

    console.log("Database account ID:", instagramAccount.id);

    console.log(
      "Token expires at:",
      instagramAccount.tokenExpiresAt?.toISOString(),
    );

    console.log("Connected:", instagramAccount.isConnected);

    console.log("========================================");

    // =========================================================
    // 18. Redirect
    // =========================================================

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=connected",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  } catch (error) {
    console.error("Instagram callback unexpected error:", error);

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=error",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  }
}
