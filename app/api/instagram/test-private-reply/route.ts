import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INSTAGRAM_API_VERSION = "v26.0";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        {
          success: false,
          error: "commentId is required",
          example:
            "/api/instagram/test-private-reply?commentId=YOUR_COMMENT_ID",
        },
        { status: 400 }
      );
    }

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
      `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/` +
      `${instagramAccount.igUserId}/messages`;

    const body = {
      recipient: {
        comment_id: commentId,
      },
      message: {
        text: "تست دایرکت SmartDirect",
      },
    };

    console.log("========================================");
    console.log("INSTAGRAM PRIVATE REPLY TEST");
    console.log("========================================");
    console.log("Instagram User ID:", instagramAccount.igUserId);
    console.log("Comment ID:", commentId);
    console.log("URL:", url);
    console.log("Body:", JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instagramAccount.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await response.json();

    console.log("HTTP Status:", response.status);
    console.log(
      "Instagram API response:",
      JSON.stringify(data, null, 2)
    );
    console.log("========================================");

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      commentId,
      data,
    });
  } catch (error) {
    console.error("Instagram private reply test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Private reply test failed",
      },
      { status: 500 }
    );
  }
}