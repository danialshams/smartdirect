import { NextRequest, NextResponse } from "next/server";

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

    const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error(
        "INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured",
      );

      return new NextResponse("Webhook verify token is not configured", {
        status: 500,
      });
    }

    // Meta expects:
    // hub.mode === "subscribe"
    // verify token matches our token

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Instagram webhook verification successful");

      return new NextResponse(challenge || "", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    console.error("Instagram webhook verification failed");

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
    const body = await request.text();

    console.log("========================================");
    console.log("INSTAGRAM WEBHOOK EVENT");
    console.log("========================================");

    console.log("Raw body:");
    console.log(body);

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      console.error(
        "Instagram webhook: invalid JSON",
      );

      return new NextResponse("Invalid JSON", {
        status: 400,
      });
    }

    console.log("Parsed webhook data:");
    console.dir(data, {
      depth: null,
    });

    console.log("========================================");

    // IMPORTANT:
    // We return 200 quickly.
    // Later we will process the event asynchronously
    // and send it to our automation engine.

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
      },
      {
        status: 500,
      },
    );
  }
}