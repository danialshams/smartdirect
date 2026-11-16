import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInstagramOAuthState } from "@/lib/instagram/oauth-state";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "ابتدا وارد حساب کاربری شوید",
        },
        { status: 401 },
      );
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId) {
      return NextResponse.json(
        {
          error: "INSTAGRAM_CLIENT_ID تنظیم نشده است",
        },
        { status: 500 },
      );
    }

    if (!redirectUri) {
      return NextResponse.json(
        {
          error: "INSTAGRAM_REDIRECT_URI تنظیم نشده است",
        },
        { status: 500 },
      );
    }

    // Reconnecting an existing account requires authenticated ownership.
    // The target account is signed into OAuth state for callback verification.
    const reconnectAccountId = request.nextUrl.searchParams.get("reconnect")?.trim();
    if (reconnectAccountId) {
      const existing = await prisma.instagramAccount.findFirst({
        where: { id: reconnectAccountId, userId: session.user.id },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "پیج انتخاب‌شده برای اتصال مجدد پیدا نشد." }, { status: 404 });
      }
    }

    const state = await createInstagramOAuthState(session.user.id, reconnectAccountId);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",

      scope:
        "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages,instagram_business_manage_insights,instagram_business_content_publish",

      state,
    });

    if (reconnectAccountId) {
      // A fresh Instagram login prevents stale native-app or Facebook-linked
      // sessions from silently reusing a different Instagram identity.
      params.set("force_reauth", "true");
      params.set("enable_fb_login", "false");
    }

    const instagramLoginUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

    console.info("[Instagram OAuth] Starting authorization", {
      reconnect: Boolean(reconnectAccountId),
      redirectHost: (() => { try { return new URL(redirectUri).hostname; } catch { return "invalid"; } })(),
      appIdLast4: clientId.slice(-4),
      forceReauth: Boolean(reconnectAccountId),
      requestedScopes: params.get("scope")?.split(","),
    });

    // The browser-launched reconnect flow avoids an HTTP 302 from the
    // user-facing link directly to instagram.com, which some mobile browsers
    // hand off to the native Instagram app before OAuth finishes.
    if (request.nextUrl.searchParams.get("format") === "json") {
      return NextResponse.json(
        { success: true, authorizationUrl: instagramLoginUrl },
        { headers: { "Cache-Control": "no-store, private" } },
      );
    }

    return NextResponse.redirect(instagramLoginUrl);
  } catch (error) {
    console.error("Instagram login error:", error);

    return NextResponse.json(
      {
        error: "خطا در شروع اتصال اینستاگرام",
      },
      { status: 500 },
    );
  }
}
