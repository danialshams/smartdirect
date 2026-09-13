import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
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

    const state = Buffer.from(
      JSON.stringify({
        userId: session.user.id,
        timestamp: Date.now(),
      }),
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",

      scope:
        "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages,instagram_business_manage_insights",

      state,
    });

    const instagramLoginUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

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
