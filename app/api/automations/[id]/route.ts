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

function normalizeOptionalString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
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
 * Include مشترک برای Automation
 */
const automationInclude = {
  messages: {
    orderBy: {
      order: "asc" as const,
    },
    include: {
      quickReplies: {
        orderBy: {
          createdAt: "asc" as const,
        },
        include: {
          nextMessage: true,
        },
      },
      showcase: {
        include: {
          items: {
            orderBy: {
              order: "asc" as const,
            },
          },
        },
      },
      form: {
        include: {
          fields: {
            orderBy: {
              order: "asc" as const,
            },
          },
        },
      },
    },
  },
};

/**
 * GET /api/automations/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "شناسه Automation الزامی است",
        },
        { status: 400 }
      );
    }

    const automation =
      await prisma.automation.findFirst({
        where: {
          id,
          instagramAccount: {
            userId: session.user.id,
          },
        },
        include: {
          instagramAccount: true,
          ...automationInclude,
        },
      });

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation پیدا نشد",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: automation,
    });
  } catch (error) {
    console.error(
      "GET /api/automations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "خطا در دریافت Automation",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automations/[id]
 *
 * ویرایش Automation موجود
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "شناسه Automation الزامی است",
        },
        { status: 400 }
      );
    }

    /**
     * پیدا کردن Automation و اطمینان از مالکیت آن
     */
    const existingAutomation =
      await prisma.automation.findFirst({
        where: {
          id,
          instagramAccount: {
            userId: session.user.id,
          },
        },
      });

    if (!existingAutomation) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation پیدا نشد",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "اطلاعات ارسالی نامعتبر است",
        },
        { status: 400 }
      );
    }

    const {
      triggerType,
      keyword,
      mediaId,
      likeComment,
      commentReplyText,
      sendDm,
      likeIncomingDm,
      replyText,
      isActive,
    } = body;

    /**
     * Trigger Type
     */
    const nextTriggerType: TriggerType =
      triggerType !== undefined
        ? triggerType
        : existingAutomation.triggerType;

    if (!isValidTriggerType(nextTriggerType)) {
      return NextResponse.json(
        {
          success: false,
          error: "نوع Trigger نامعتبر است",
        },
        { status: 400 }
      );
    }

    /**
     * Keyword
     *
     * فقط Comment و Story نیاز به Keyword دارند.
     */
    const requiresKeyword =
      nextTriggerType === "COMMENT_KEYWORD" ||
      nextTriggerType === "STORY_REPLY_KEYWORD";

    let nextKeyword: string | null = null;

    if (requiresKeyword) {
      if (keyword !== undefined) {
        if (
          typeof keyword !== "string" ||
          !keyword.trim()
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "برای این Trigger وارد کردن Keyword الزامی است",
            },
            { status: 400 }
          );
        }

        nextKeyword = normalizeKeyword(keyword);

        if (!nextKeyword) {
          return NextResponse.json(
            {
              success: false,
              error: "Keyword معتبر نیست",
            },
            { status: 400 }
          );
        }
      } else {
        nextKeyword = existingAutomation.keyword;

        if (!nextKeyword) {
          return NextResponse.json(
            {
              success: false,
              error:
                "برای این Trigger وارد کردن Keyword الزامی است",
            },
            { status: 400 }
          );
        }

        nextKeyword = normalizeKeyword(nextKeyword);
      }
    }

    /**
     * Media ID
     */
    let nextMediaId: string | null = null;

    if (mediaId !== undefined) {
      nextMediaId =
        typeof mediaId === "string" &&
        mediaId.trim()
          ? mediaId.trim()
          : null;
    } else {
      nextMediaId =
        existingAutomation.mediaId;
    }

    /**
     * بررسی Duplicate
     *
     * خود Automation فعلی را نادیده می‌گیریم.
     */
    const duplicate =
      await prisma.automation.findFirst({
        where: {
          id: {
            not: id,
          },
          instagramAccountId:
            existingAutomation.instagramAccountId,
          triggerType: nextTriggerType,
          keyword: nextKeyword,
          mediaId: nextMediaId,
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Automation مشابه قبلاً وجود دارد",
          data: duplicate,
        },
        { status: 409 }
      );
    }

    /**
     * Data برای Update
     */
    const updateData: {
      triggerType?: TriggerType;
      keyword?: string | null;
      mediaId?: string | null;
      likeComment?: boolean;
      commentReplyText?: string | null;
      sendDm?: boolean;
      likeIncomingDm?: boolean;
      replyText?: string | null;
      isActive?: boolean;
    } = {};

    /**
     * Trigger
     */
    if (triggerType !== undefined) {
      updateData.triggerType =
        nextTriggerType;
    }

    /**
     * Keyword
     *
     * اگر Trigger تغییر کرده یا Keyword ارسال شده،
     * مقدار را ذخیره می‌کنیم.
     */
    if (
      triggerType !== undefined ||
      keyword !== undefined
    ) {
      updateData.keyword = nextKeyword;
    }

    /**
     * Media
     */
    if (mediaId !== undefined) {
      updateData.mediaId = nextMediaId;
    }

    /**
     * Comment Like
     */
    if (likeComment !== undefined) {
      updateData.likeComment =
        Boolean(likeComment);
    }

    /**
     * Comment Public Reply
     */
    if (commentReplyText !== undefined) {
      updateData.commentReplyText =
        normalizeOptionalString(
          commentReplyText
        );
    }

    /**
     * Send DM
     */
    if (sendDm !== undefined) {
      updateData.sendDm = Boolean(sendDm);
    }

    /**
     * Incoming DM Like
     */
    if (likeIncomingDm !== undefined) {
      updateData.likeIncomingDm =
        Boolean(likeIncomingDm);
    }

    /**
     * Legacy direct reply text
     */
    if (replyText !== undefined) {
      updateData.replyText =
        normalizeOptionalString(replyText);
    }

    /**
     * Active
     */
    if (isActive !== undefined) {
      updateData.isActive =
        Boolean(isActive);
    }

    /**
     * Update
     */
    const automation =
      await prisma.automation.update({
        where: {
          id,
        },
        data: updateData,
        include: automationInclude,
      });

    return NextResponse.json({
      success: true,
      data: automation,
    });
  } catch (error) {
    console.error(
      "PATCH /api/automations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "خطا در ویرایش Automation",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automations/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "شناسه Automation الزامی است",
        },
        { status: 400 }
      );
    }

    const automation =
      await prisma.automation.findFirst({
        where: {
          id,
          instagramAccount: {
            userId: session.user.id,
          },
        },
      });

    if (!automation) {
      return NextResponse.json(
        {
          success: false,
          error: "Automation پیدا نشد",
        },
        { status: 404 }
      );
    }

    await prisma.automation.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Automation با موفقیت حذف شد",
    });
  } catch (error) {
    console.error(
      "DELETE /api/automations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "خطا در حذف Automation",
      },
      { status: 500 }
    );
  }
}