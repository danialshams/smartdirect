import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
      `https://graph.instagram.com/v26.0/${account.igUserId}/media`
    );

    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,permalink,timestamp"
    );

    url.searchParams.set("access_token", account.accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    console.log("========================================");
    console.log("INSTAGRAM MEDIA TEST");
    console.log("Account:", account.igUsername);
    console.log("Instagram ID:", account.igUserId);
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));
    console.log("========================================");

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        account: {
          username: account.igUsername,
          instagramUserId: account.igUserId,
        },
        data,
      },
      {
        status: response.ok ? 200 : response.status,
      }
    );
  } catch (error) {
    console.error("Instagram media test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}