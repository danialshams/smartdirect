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
    // 7. Check environment variables
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

    console.log(
      "Instagram OAuth: exchanging authorization code...",
    );

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
      console.error(
        "Instagram token exchange FETCH ERROR:",
        error,
      );

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

    console.log("Instagram token response:", {
      success: tokenResponse.ok,
      status: tokenResponse.status,
      user_id: tokenData.user_id,
      has_access_token: Boolean(tokenData.access_token),
      error: tokenData.error,
      error_type: tokenData.error_type,
      error_message: tokenData.error_message,
    });

    // =========================================================
    // 9. Validate access token response
    // =========================================================

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error(
        "Instagram token exchange failed:",
        {
          status: tokenResponse.status,
          data: tokenData,
        },
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=token_error",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    const accessToken = tokenData.access_token;

    // این ID مربوط به token exchange است.
    // برای Webhook از این ID استفاده نمی‌کنیم.
    const tokenUserId = String(tokenData.user_id);

    console.log(
      "Instagram OAuth: token received:",
      {
        tokenUserId,
      },
    );

    // =========================================================
    // 10. Get Instagram profile + Instagram Professional User ID
    // =========================================================

    console.log(
      "Instagram OAuth: getting Instagram professional account...",
    );

    /*
     * مهم:
     *
     * قبلاً این را داشتیم:
     *
     * fields=id,username
     *
     * که id آن شناسه app-scoped بود.
     *
     * برای Webhook باید user_id را بگیریم.
     *
     * user_id همان ID با فرمت 1784... است.
     */

    const profileUrl =
      `https://graph.instagram.com/v26.0/me` +
      `?fields=id,user_id,username` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    console.log(
      "Instagram profile request:",
      {
        endpoint:
          "https://graph.instagram.com/v26.0/me",
        tokenUserId,
      },
    );

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
      console.error(
        "Instagram profile FETCH ERROR:",
        error,
      );

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
    // 11. Parse profile response
    // =========================================================

    let profileData: {
      id?: string;
      user_id?: string;
      username?: string;
    };

    try {
      profileData = JSON.parse(profileText);
    } catch {
      console.error(
        "Instagram profile response is not valid JSON",
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard?instagram=profile_invalid_json",
          process.env.NEXTAUTH_URL || request.url,
        ),
      );
    }

    // =========================================================
    // 12. Validate profile response
    // =========================================================

    if (!profileResponse.ok) {
      console.error(
        "Instagram profile request failed:",
        {
          status: profileResponse.status,
          data: profileData,
          tokenUserId,
        },
      );

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
    // 13. Get correct Instagram Professional Account ID
    // =========================================================

    /*
     * این ID همان IDای است که Webhook در entry.id می‌فرستد.
     *
     * مثال:
     *
     * tokenUserId:
     * 29195065126747612
     *
     * app-scoped id:
     * 29195065126747613
     *
     * professional user_id:
     * 17841434583842416
     *
     * ما باید سومی را در دیتابیس ذخیره کنیم.
     */

    const instagramUserId = String(
      profileData.user_id,
    );

    const instagramAppScopedId = profileData.id
      ? String(profileData.id)
      : undefined;

    const instagramUsername =
      profileData.username || "";

    console.log("========================================");
    console.log("INSTAGRAM OAUTH ID DEBUG");
    console.log("tokenUserId:", tokenUserId);
    console.log(
      "appScopedId:",
      instagramAppScopedId,
    );
    console.log(
      "professionalUserId:",
      instagramUserId,
    );
    console.log(
      "username:",
      instagramUsername,
    );
    console.log("========================================");

    // =========================================================
    // 14. Find existing account
    // =========================================================

    /*
     * رکورد قبلی ما با ID اشتباه ذخیره شده بود:
     *
     * 29195065126747613
     *
     * بنابراین فقط upsert بر اساس igUserId کافی نیست،
     * چون در این حالت یک رکورد جدید ساخته می‌شود.
     *
     * ابتدا رکورد قبلی همین کاربر را بر اساس userId
     * و username پیدا می‌کنیم تا ID آن را اصلاح کنیم.
     */

    console.log(
      "Instagram OAuth: checking existing account...",
    );

    const existingAccount =
      await prisma.instagramAccount.findFirst({
        where: {
          userId: stateData.userId,
          igUsername: instagramUsername,
        },
      });

    // =========================================================
    // 15. Save Instagram account
    // =========================================================

    console.log(
      "Instagram OAuth: saving account to database...",
    );

    let instagramAccount;

    if (existingAccount) {
      console.log(
        "Existing Instagram account found. Updating ID...",
      );

      instagramAccount =
        await prisma.instagramAccount.update({
          where: {
            id: existingAccount.id,
          },

          data: {
            igUserId: instagramUserId,
            igUsername: instagramUsername,
            accessToken,
            isConnected: true,
          },
        });
    } else {
      console.log(
        "No existing Instagram account found. Creating new account...",
      );

      instagramAccount =
        await prisma.instagramAccount.create({
          data: {
            userId: stateData.userId,
            igUserId: instagramUserId,
            igUsername: instagramUsername,
            accessToken,
            isConnected: true,
          },
        });
    }

    console.log(
      "Instagram account saved successfully:",
      {
        databaseId: instagramAccount.id,
        instagramUserId:
          instagramAccount.igUserId,
        username:
          instagramAccount.igUsername,
        userId: instagramAccount.userId,
        isConnected:
          instagramAccount.isConnected,
      },
    );

    // =========================================================
    // 16. Final ID verification log
    // =========================================================

    console.log("========================================");
    console.log(
      "INSTAGRAM CONNECTION COMPLETE",
    );
    console.log(
      "Webhook-compatible Instagram ID:",
      instagramAccount.igUserId,
    );
    console.log(
      "Instagram username:",
      instagramAccount.igUsername,
    );
    console.log(
      "Database account ID:",
      instagramAccount.id,
    );
    console.log("========================================");

    // =========================================================
    // 17. Redirect user back to dashboard
    // =========================================================

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=connected",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  } catch (error) {
    // =========================================================
    // 18. Unexpected error
    // =========================================================

    console.error(
      "Instagram callback unexpected error:",
      error,
    );

    return NextResponse.redirect(
      new URL(
        "/dashboard?instagram=error",
        process.env.NEXTAUTH_URL || request.url,
      ),
    );
  }
}