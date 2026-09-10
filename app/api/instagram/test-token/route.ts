import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INSTAGRAM_API_VERSION = "v26.0";

export async function GET() {
  try {
    const instagramAccount = await prisma.instagramAccount.findUnique({
      where: {
        igUserId: "17841434583842416",
      },
    });

    if (!instagramAccount) {
      return NextResponse.json(
        {
          success: false,
          error: "Instagram account not found",
        },
        { status: 404 }
      );
    }

    const url =
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me` +
      `?fields=id,user_id,username`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${instagramAccount.accessToken}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    console.log("========================================");
    console.log("INSTAGRAM TOKEN TEST");
    console.log("HTTP Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));
    console.log("========================================");

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      data,
    });
  } catch (error) {
    console.error("Instagram token test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Token test failed",
      },
      { status: 500 }
    );
  }
}