import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error: "mediaId is required",
          example:
            "/api/instagram/test?mediaId=YOUR_INSTAGRAM_MEDIA_ID",
        },
        { status: 400 }
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        isConnected: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "No connected Instagram account found",
        },
        { status: 404 }
      );
    }

    const url = new URL(
      `https://graph.instagram.com/v26.0/${mediaId}/comments`
    );

    url.searchParams.set("fields", "id,text,username,timestamp");
    url.searchParams.set("access_token", account.accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        instagramAccount: {
          id: account.igUserId,
          username: account.igUsername,
        },
        data,
      },
      { status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    console.error("Instagram test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}