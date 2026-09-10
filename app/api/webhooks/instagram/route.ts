import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/۰/g, "0")
    .replace(/۱/g, "1")
    .replace(/۲/g, "2")
    .replace(/۳/g, "3")
    .replace(/۴/g, "4")
    .replace(/۵/g, "5")
    .replace(/۶/g, "6")
    .replace(/۷/g, "7")
    .replace(/۸/g, "8")
    .replace(/۹/g, "9")
    .toLowerCase();
}

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

    // =======================================================
    // 1. Validate webhook structure
    // =======================================================

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

    // =======================================================
    // 2. Process every entry
    // =======================================================

    for (const entry of body.entry) {
      const igUserId = entry.id;

      if (!igUserId) {
        console.error(
          "Webhook entry does not contain Instagram user ID",
        );

        continue;
      }

      console.log(
        "Webhook Instagram User ID:",
        igUserId,
      );

      // =====================================================
      // 3. Find connected Instagram account
      // =====================================================

      const instagramAccount =
        await prisma.instagramAccount.findUnique({
          where: {
            igUserId: igUserId,
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

      console.log(
        "Database Instagram Account ID:",
        instagramAccount.id,
      );

      // =====================================================
      // 4. Validate changes
      // =====================================================

      if (!Array.isArray(entry.changes)) {
        console.log(
          "Webhook entry has no changes array",
        );

        continue;
      }

      // =====================================================
      // 5. Process every change
      // =====================================================

      for (const change of entry.changes) {
        if (change.field !== "comments") {
          console.log(
            "Ignoring webhook field:",
            change.field,
          );

          continue;
        }

        const value = change.value;

        if (!value) {
          console.warn(
            "Instagram comment webhook value is empty",
          );

          continue;
        }

        // ===================================================
        // 6. Extract comment data
        // ===================================================

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

        console.log("========================================");
        console.log("INSTAGRAM COMMENT");
        console.log("commentId:", igCommentId);
        console.log("mediaId:", igMediaId);
        console.log("username:", username);
        console.log("text:", text);
        console.log("========================================");

        // ===================================================
        // 7. Prevent duplicate comments
        // ===================================================

        const existingComment =
          await prisma.comment.findUnique({
            where: {
              igCommentId: igCommentId,
            },
          });

        if (existingComment) {
          console.log(
            "Comment already exists:",
            igCommentId,
          );

          continue;
        }

        // ===================================================
        // 8. Save comment
        // ===================================================

        const comment =
          await prisma.comment.create({
            data: {
              userId: instagramAccount.userId,
              igMediaId: igMediaId,
              igCommentId: igCommentId,
              text: text,
              username: username,
              replied: false,
            },
          });

        console.log(
          "Instagram comment saved:",
          comment.id,
        );

        // ===================================================
        // 9. Normalize comment text
        // ===================================================

        const normalizedCommentText =
          normalizeText(text);

        console.log(
          "Normalized comment text:",
          normalizedCommentText,
        );

        // ===================================================
        // 10. Find active automations
        // ===================================================

        console.log(
          "Looking for matching automation...",
        );

        const automations =
          await prisma.automation.findMany({
            where: {
              instagramAccountId:
                instagramAccount.id,
              isActive: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          });

        console.log(
          "Active automations found:",
          automations.length,
        );

        // ===================================================
        // 11. Find matching automation
        // ===================================================

        const matchedAutomation =
          automations.find((automation) => {
            const normalizedKeyword =
              normalizeText(automation.keyword);

            return (
              normalizedCommentText ===
              normalizedKeyword
            );
          });

        // ===================================================
        // 12. No automation matched
        // ===================================================

        if (!matchedAutomation) {
          console.log(
            "No matching automation found for comment:",
            normalizedCommentText,
          );

          console.log("========================================");

          continue;
        }

        // ===================================================
        // 13. Automation matched
        // ===================================================

        console.log("========================================");
        console.log("AUTOMATION MATCHED");
        console.log(
          "Automation ID:",
          matchedAutomation.id,
        );
        console.log(
          "Keyword:",
          matchedAutomation.keyword,
        );
        console.log(
          "Reply text:",
          matchedAutomation.replyText,
        );
        console.log(
          "Comment ID:",
          comment.id,
        );
        console.log(
          "Instagram Comment ID:",
          igCommentId,
        );
        console.log(
          "Username:",
          username,
        );
        console.log("========================================");

        // ===================================================
        // 14. Check if comment was already replied
        // ===================================================

        if (comment.replied) {
          console.log(
            "Comment already marked as replied. Skipping.",
          );

          continue;
        }

        // ===================================================
        // 15. Check access token
        // ===================================================

        if (!instagramAccount.accessToken) {
          console.error(
            "Instagram access token is missing.",
          );

          continue;
        }

        // ===================================================
        // 16. Build Instagram Messages API URL
        // ===================================================

        const instagramMessagesUrl =
          `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${instagramAccount.igUserId}/messages`;

        console.log(
          "Sending Instagram private reply...",
        );

        console.log(
          "Instagram API URL:",
          instagramMessagesUrl,
        );

        // ===================================================
        // 17. Send private reply
        // ===================================================

        try {
          const instagramResponse =
            await fetch(instagramMessagesUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization:
                  `Bearer ${instagramAccount.accessToken}`,
              },
              body: JSON.stringify({
                recipient: {
                  comment_id: igCommentId,
                },
                message: {
                  text: matchedAutomation.replyText,
                },
              }),
            });

          const responseText =
            await instagramResponse.text();

          let responseData: unknown;

          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = responseText;
          }

          // =================================================
          // 18. Handle Instagram API error
          // =================================================

          if (!instagramResponse.ok) {
            console.error(
              "========================================",
            );

            console.error(
              "INSTAGRAM PRIVATE REPLY FAILED",
            );

            console.error(
              "HTTP Status:",
              instagramResponse.status,
            );

            console.error(
              "Instagram API response:",
              responseData,
            );

            console.error(
              "========================================",
            );

            continue;
          }

          // =================================================
          // 19. Private reply sent successfully
          // =================================================

          console.log("========================================");
          console.log(
            "INSTAGRAM PRIVATE REPLY SENT SUCCESSFULLY",
          );

          console.log(
            "Instagram API response:",
            responseData,
          );

          console.log("========================================");

          // =================================================
          // 20. Update comment
          // =================================================

          await prisma.comment.update({
            where: {
              id: comment.id,
            },
            data: {
              replied: true,
              replyText:
                matchedAutomation.replyText,
            },
          });

          console.log(
            "Comment marked as replied.",
          );

          console.log("========================================");
          console.log(
            "INSTAGRAM AUTOMATION COMPLETED",
          );
          console.log("========================================");
        } catch (sendError) {
          console.error(
            "========================================",
          );

          console.error(
            "INSTAGRAM PRIVATE REPLY REQUEST ERROR",
          );

          console.error(
            sendError,
          );

          console.error(
            "========================================",
          );
        }
      }
    }

    // =======================================================
    // 21. Processing complete
    // =======================================================

    console.log("========================================");
    console.log(
      "INSTAGRAM WEBHOOK PROCESSING COMPLETE",
    );
    console.log("========================================");

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