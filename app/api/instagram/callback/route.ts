import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Instagram OAuth error:", error);

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "کد احراز هویت اینستاگرام دریافت نشد" },
        { status: 400 },
      );
    }

    if (!state) {
      return NextResponse.json({ error: "State دریافت نشد" }, { status: 400 });
    }

    let stateData: {
      userId: string;
      timestamp: number;
    };

    try {
      stateData = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    } catch {
      return NextResponse.json({ error: "State نامعتبر است" }, { status: 400 });
    }

    if (!stateData.userId) {
      return NextResponse.json(
        { error: "شناسه کاربر در State وجود ندارد" },
        { status: 400 },
      );
    }

    // جلوگیری از استفاده از State قدیمی
    const stateAge = Date.now() - stateData.timestamp;

    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.json(
        { error: "درخواست اتصال منقضی شده است. دوباره تلاش کنید." },
        { status: 400 },
      );
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Instagram environment variables are missing");

      return NextResponse.json(
        { error: "تنظیمات Instagram در سرور کامل نیست" },
        { status: 500 },
      );
    }

    /*
     * Step 1:
     * Exchange authorization code for short-lived access token
     */

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
      user_id: tokenData.user_id,
    });

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Instagram token exchange failed:", tokenData);

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=token_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    const accessToken = tokenData.access_token;
    const instagramUserId = String(tokenData.user_id);

    /*
     * Step 2:
     * Get Instagram account information
     */

    const profileResponse = await fetch(
      `https://graph.instagram.com/v26.0/${instagramUserId}?fields=id,username&access_token=${encodeURIComponent(
        accessToken,
      )}`,
    );

    const profileData = await profileResponse.json();

    console.log("Instagram profile response:", {
      success: profileResponse.ok,
      status: profileResponse.status,
      data: profileData,
    });

    if (!profileResponse.ok || !profileData.id) {
      console.error("Instagram profile request failed:", profileData);

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=profile_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    /*
     * Step 3:
     * Save Instagram account in database
     */

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

    /*
     * Step 4:
     * Return user to dashboard
     */

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=connected",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  } catch (error) {
    console.error("Instagram callback error:", error);

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=error",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  }
}
