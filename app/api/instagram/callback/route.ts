import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    // 2. Check authorization code
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
    // 3. Check state
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
    // 4. Decode state
    // =========================================================

    let stateData: {
      userId: string;
      timestamp: number;
    };

    try {
      stateData = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8"),
      );
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
    // 5. Validate state data
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
    // 6. Check state expiration
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
    // 7. Check Instagram environment variables
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
    // 8. Exchange authorization code for access token
    // =========================================================

    console.log("Instagram OAuth: exchanging authorization code...");

    const tokenResponse = await fetch(
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
      },
    );

    const tokenData = await tokenResponse.json();

    console.log("Instagram token response:", {
      success: tokenResponse.ok,
      status: tokenResponse.status,
      user_id: tokenData.user_id,
      has_access_token: Boolean(tokenData.access_token),
    });

    // =========================================================
    // 9. Validate access token response
    // =========================================================

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Instagram token exchange failed:", {
        status: tokenResponse.status,
        data: tokenData,
      });

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=token_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    const accessToken = tokenData.access_token;
    const instagramUserId = String(tokenData.user_id);

    // =========================================================
    // 10. Get Instagram profile
    // =========================================================

    console.log("Instagram OAuth: getting profile...");

    const profileUrl =
      `https://graph.instagram.com/v26.0/${instagramUserId}` +
      `?fields=id,username&access_token=${encodeURIComponent(accessToken)}`;

    const profileResponse = await fetch(profileUrl, {
      method: "GET",
      cache: "no-store",
    });

    const profileData = await profileResponse.json();

    console.log("Instagram profile response:", {
      success: profileResponse.ok,
      status: profileResponse.status,
      id: profileData.id,
      username: profileData.username,
      has_error: Boolean(profileData.error),
    });

    // =========================================================
    // 11. Validate Instagram profile
    // =========================================================

    if (!profileResponse.ok || !profileData.id) {
      console.error("Instagram profile request failed:", {
        status: profileResponse.status,
        data: profileData,
      });

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=profile_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    // =========================================================
    // 12. Save Instagram account in database
    // =========================================================

    console.log("Instagram OAuth: saving account to database...");

    await prisma.instagramAccount.upsert({
      where: {
        igUserId: instagramUserId,
      },

      update: {
        userId: stateData.userId,
        igUsername: profileData.username || "",
        accessToken,
        isConnected: true,
      },

      create: {
        userId: stateData.userId,
        igUserId: instagramUserId,
        igUsername: profileData.username || "",
        accessToken,
        isConnected: true,
      },
    });

    console.log("Instagram account saved successfully:", {
      instagramUserId,
      username: profileData.username,
      userId: stateData.userId,
    });

    // =========================================================
    // 13. Redirect user back to dashboard
    // =========================================================

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=connected",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  } catch (error) {
    // =========================================================
    // 14. Unexpected error
    // =========================================================

    console.error("Instagram callback unexpected error:", error);

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=error",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  }
}