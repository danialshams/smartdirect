import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// =========================================================
// GET
// Meta uses this endpoint to verify the webhook.
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK VERIFICATION");
    console.log("mode:", mode);
    console.log("token received:", Boolean(token));
    console.log("challenge received:", Boolean(challenge));
    console.log("========================================");

    const verifyToken =
      process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error(
        "INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured",
      );

      return new NextResponse(
        "Webhook verify token is not configured",
        {
          status: 500,
        },
      );
    }

    if (mode === "subscribe" && token === verifyToken) {
      console.log(
        "Instagram webhook verification successful",
      );

      return new NextResponse(challenge || "", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    console.error(
      "Instagram webhook verification failed",
    );

    return new NextResponse("Forbidden", {
      status: 403,
    });
  } catch (error) {
    console.error(
      "Instagram webhook GET error:",
      error,
    );

    return new NextResponse("Internal Server Error", {
      status: 500,
    });
  }
}

// =========================================================
// POST
// Instagram / Meta sends webhook events here.
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK EVENT");
    console.log("========================================");

    console.log(
      "Webhook body:",
      JSON.stringify(body, null, 2),
    );

    // -------------------------------------------------------
    // Validate basic webhook structure
    // -------------------------------------------------------

    if (
      !body ||
      body.object !== "instagram" ||
      !Array.isArray(body.entry)
    ) {
      console.error(
        "Invalid Instagram webhook payload",
      );

      return NextResponse.json(
        {
          success: false,
          message: "Invalid webhook payload",
        },
        {
          status: 400,
        },
      );
    }

    // -------------------------------------------------------
    // Process every entry
    // -------------------------------------------------------

    for (const entry of body.entry) {
      const igUserId = entry.id;

      if (!igUserId) {
        console.error(
          "Webhook entry does not contain Instagram user ID",
        );

        continue;
      }

      // -----------------------------------------------------
      // Find connected Instagram account
      // -----------------------------------------------------

      const instagramAccount =
        await prisma.instagramAccount.findUnique({
          where: {
            igUserId,
          },
        });

      if (!instagramAccount) {
        console.warn(
          "Instagram account not found:",
          igUserId,
        );

        continue;
      }

      console.log(
        "Instagram account found:",
        instagramAccount.igUsername,
      );

      // -----------------------------------------------------
      // Process changes
      // -----------------------------------------------------

      if (!Array.isArray(entry.changes)) {
        continue;
      }

      for (const change of entry.changes) {
        if (change.field !== "comments") {
          continue;
        }

        const value = change.value;

        if (!value) {
          continue;
        }

        const igCommentId = value.id;
        const igMediaId = value.media?.id;
        const text = value.text;
        const username = value.from?.username;

        if (
          !igCommentId ||
          !igMediaId ||
          !text ||
          !username
        ) {
          console.warn(
            "Incomplete Instagram comment payload:",
            value,
          );

          continue;
        }

        // ---------------------------------------------------
        // Prevent duplicate comments
        // ---------------------------------------------------

        const existingComment =
          await prisma.comment.findUnique({
            where: {
              igCommentId,
            },
          });

        if (existingComment) {
          console.log(
            "Comment already exists:",
            igCommentId,
          );

          continue;
        }

        // ---------------------------------------------------
        // Save comment
        // ---------------------------------------------------

        const comment =
          await prisma.comment.create({
            data: {
              userId: instagramAccount.userId,
              igMediaId,
              igCommentId,
              text,
              username,
              replied: false,
            },
          });

        console.log(
          "Instagram comment saved:",
          comment.id,
        );

        console.log({
          username,
          text,
          igMediaId,
          igCommentId,
        });
      }
    }

    console.log("========================================");

    // -------------------------------------------------------
    // IMPORTANT:
    // Return 200 quickly to Meta.
    // -------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Instagram webhook POST error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}