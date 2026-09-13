import { NextRequest, NextResponse } from "next/server";
import { reactToInstagramMessage } from "@/lib/instagram/react-to-message";


export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const instagramAccountId =
      typeof body?.instagramAccountId === "string"
        ? body.instagramAccountId.trim()
        : "";

    const recipientId =
      typeof body?.recipientId === "string"
        ? body.recipientId.trim()
        : "";

    const messageId =
      typeof body?.messageId === "string"
        ? body.messageId.trim()
        : "";

    const reaction =
      typeof body?.reaction === "string" && body.reaction.trim()
        ? body.reaction.trim()
        : "love";

    if (!instagramAccountId || !recipientId || !messageId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "instagramAccountId، recipientId و messageId الزامی هستند.",
        },
        { status: 400 },
      );
    }

    const result = await reactToInstagramMessage({
      instagramAccountId,
      recipientId,
      messageId,
      reaction,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[Test Message Reaction] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در تست واکنش به پیام.",
      },
      { status: 500 },
    );
  }
}