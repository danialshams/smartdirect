import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizePersianDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );
}

function normalizeKeyword(value: string) {
  return normalizePersianDigits(value).trim().toLowerCase();
}

const validTriggerTypes = [
  "COMMENT_KEYWORD",
  "DM",
  "STORY_REPLY_KEYWORD",
] as const;

type TriggerType = (typeof validTriggerTypes)[number];

function isValidTriggerType(
  value: unknown
): value is TriggerType {
  return (
    typeof value === "string" &&
    validTriggerTypes.includes(value as TriggerType)
  );
}

/**
 * GET /api/automations
 *
 * دریافت Automation های یک Instagram Account
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "احراز هویت انجام نشده است",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const instagramAccountId =
      searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: "instagramAccountId الزامی است",
        },
        { status: 400 }
      );
    }

    const instagramAccount =
      await prisma.instagramAccount.findFirst({
        where: {
          id: instagramAccountId,
          userId: session.user.id,
        },
      });

    if (!instagramAccount) {
      return NextResponse.json(
        {
          success: false,
          error: "اکانت اینستاگرام پیدا نشد",
        },
        { status: 404 }
      );
    }

    const automations =
      await prisma.automation.findMany({
        where: {
          instagramAccountId,
        },
        include: {
          messages: {
            orderBy: {
              order: "asc",
            },
            include: {
              quickReplies: {
                orderBy: {
                  createdAt: "asc",
                },
                include: {
                  nextMessage: true,
                },
              },
              showcase: {
                include: {
                  items: {
                    where: {
                      isActive: true,
                    },
                    orderBy: {
                      order: "asc",
                    },
                  },
                },
              },
              form: {
                include: {
                  fields: {
                    orderBy: {
                      order: "asc",
                    },
                  },
                },
              },
            },
          },
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
    console.error("GET /api/automations error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در دریافت Automation ها",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations
 *
 * ساخت Automation جدید
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "احراز هویت انجام نشده است",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      instagramAccountId,
      triggerType = "COMMENT_KEYWORD",
      keyword,
      mediaId,
      likeComment = false,
      commentReplyText,
      sendDm = false,
      likeIncomingDm = false,
      replyText,
      isActive = true,
    } = body;

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: "instagramAccountId الزامی است",
        },
        { status: 400 }
      );
    }

    if (!isValidTriggerType(triggerType)) {
      return NextResponse.json(
        {
          success: false,
          error: "نوع Trigger نامعتبر است",
        },
        { status: 400 }
      );
    }

    const instagramAccount =
      await prisma.instagramAccount.findFirst({
        where: {
          id: instagramAccountId,
          userId: session.user.id,
        },
      });

    if (!instagramAccount) {
      return NextResponse.json(
        {
          success: false,
          error: "اکانت اینستاگرام متعلق به این کاربر نیست",
        },
        { status: 403 }
      );
    }

    const requiresKeyword =
      triggerType === "COMMENT_KEYWORD" ||
      triggerType === "STORY_REPLY_KEYWORD";

    let normalizedKeyword: string | null = null;

    if (requiresKeyword) {
      if (
        typeof keyword !== "string" ||
        !keyword.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "برای این نوع Trigger وارد کردن Keyword الزامی است",
          },
          { status: 400 }
        );
      }

      normalizedKeyword = normalizeKeyword(keyword);

      if (!normalizedKeyword) {
        return NextResponse.json(
          {
            success: false,
            error: "Keyword معتبر نیست",
          },
          { status: 400 }
        );
      }
    }

    const normalizedMediaId =
      typeof mediaId === "string" && mediaId.trim()
        ? mediaId.trim()
        : null;

    const duplicate =
      await prisma.automation.findFirst({
        where: {
          instagramAccountId,
          triggerType,
          keyword: normalizedKeyword,
          mediaId: normalizedMediaId,
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation مشابه قبلاً وجود دارد",
          data: duplicate,
        },
        { status: 409 }
      );
    }

    const automation =
      await prisma.automation.create({
        data: {
          instagramAccountId,

          triggerType,

          keyword: normalizedKeyword,

          mediaId: normalizedMediaId,

          likeComment:
            triggerType === "COMMENT_KEYWORD"
              ? Boolean(likeComment)
              : false,

          commentReplyText:
            triggerType === "COMMENT_KEYWORD" &&
            typeof commentReplyText === "string" &&
            commentReplyText.trim()
              ? commentReplyText.trim()
              : null,

          sendDm: Boolean(sendDm),

          likeIncomingDm:
            triggerType === "DM"
              ? Boolean(likeIncomingDm)
              : false,

          replyText:
            typeof replyText === "string" &&
            replyText.trim()
              ? replyText.trim()
              : null,

          isActive: Boolean(isActive),
        },

        include: {
          messages: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,
        data: automation,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/automations error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "خطا در ساخت Automation",
      },
      { status: 500 }
    );
  }
}