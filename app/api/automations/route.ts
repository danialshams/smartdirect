import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// =========================================================
// GET
// Get automations for an Instagram account
// =========================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const instagramAccountId =
      searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "instagramAccountId is required",
        },
        {
          status: 400,
        },
      );
    }

    const automations = await prisma.automation.findMany({
      where: {
        instagramAccountId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: automations,
    });
  } catch (error) {
    console.error(
      "GET /api/automations error:",
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

// =========================================================
// POST
// Create a new automation
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      instagramAccountId,
      keyword,
      commentReplyText,
      replyText,
    } = body;

    // -------------------------------------------------------
    // Validate required fields
    // -------------------------------------------------------

    if (
      !instagramAccountId ||
      !keyword ||
      !commentReplyText ||
      !replyText
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "instagramAccountId, keyword, commentReplyText and replyText are required",
        },
        {
          status: 400,
        },
      );
    }

    // -------------------------------------------------------
    // Find Instagram account
    // -------------------------------------------------------

    const instagramAccount =
      await prisma.instagramAccount.findUnique({
        where: {
          id: instagramAccountId,
        },
      });

    if (!instagramAccount) {
      return NextResponse.json(
        {
          success: false,
          message: "Instagram account not found",
        },
        {
          status: 404,
        },
      );
    }

    // -------------------------------------------------------
    // Create automation
    // -------------------------------------------------------

    const automation =
      await prisma.automation.create({
        data: {
          instagramAccountId,
          keyword: keyword.trim(),
          commentReplyText: commentReplyText.trim(),
          replyText: replyText.trim(),
          isActive: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        data: automation,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "POST /api/automations error:",
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