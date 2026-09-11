import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizePersianDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeKeyword(value: string) {
  return normalizePersianDigits(value).trim().toLowerCase();
}

const validTriggerTypes = [
  "COMMENT_KEYWORD",
  "DM",
  "STORY_REPLY_KEYWORD",
] as const;

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
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const automation = await prisma.automation.findFirst({
      where: {
        id,
        instagramAccount: {
          userId: session.user.id,
        },
      },
      include: {
        instagramAccount: true,
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
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(automation);
  } catch (error) {
    console.error("GET /api/automations/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت Automation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automations/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existingAutomation = await prisma.automation.findFirst({
      where: {
        id,
        instagramAccount: {
          userId: session.user.id,
        },
      },
    });

    if (!existingAutomation) {
      return NextResponse.json(
        { error: "Automation پیدا نشد" },
        { status: 404 }
      );
    }

    const body = await request.json();

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
     * اگر TriggerType ارسال شده باشد، بررسی می‌کنیم.
     */
    const nextTriggerType =
      triggerType !== undefined
        ? triggerType
        : existingAutomation.triggerType;

    if (!validTriggerTypes.includes(nextTriggerType)) {
      return NextResponse.json(
        { error: "نوع Trigger نامعتبر است" },
        { status: 400 }
      );
    }

    /**
     * Keyword
     */
    const requiresKeyword =
      nextTriggerType === "COMMENT_KEYWORD" ||
      nextTriggerType === "STORY_REPLY_KEYWORD";

    let nextKeyword: string | null = existingAutomation.keyword;

    if (requiresKeyword) {
      if (keyword !== undefined) {
        if (typeof keyword !== "string" || !keyword.trim()) {
          return NextResponse.json(
            { error: "برای این Trigger وارد کردن Keyword الزامی است" },
            { status: 400 }
          );
        }

        nextKeyword = normalizeKeyword(keyword);
      } else if (!existingAutomation.keyword) {
        return NextResponse.json(
          { error: "برای این Trigger وارد کردن Keyword الزامی است" },
          { status: 400 }
        );
      }
    } else {
      nextKeyword = null;
    }

    /**
     * Media
     */
    const nextMediaId =
      mediaId !== undefined ? mediaId || null : existingAutomation.mediaId;

    /**
     * بررسی Duplicate
     *
     * خود Automation فعلی را از بررسی خارج می‌کنیم.
     */
    const duplicate = await prisma.automation.findFirst({
      where: {
        id: {
          not: id,
        },
        instagramAccountId: existingAutomation.instagramAccountId,
        triggerType: nextTriggerType,
        keyword: nextKeyword,
        mediaId: nextMediaId,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Automation مشابه قبلاً وجود دارد" },
        { status: 409 }
      );
    }

    /**
     * ساخت Data برای Update
     */
    const updateData: {
      triggerType?: typeof nextTriggerType;
      keyword?: string | null;
      mediaId?: string | null;
      likeComment?: boolean;
      commentReplyText?: string | null;
      sendDm?: boolean;
      likeIncomingDm?: boolean;
      replyText?: string | null;
      isActive?: boolean;
    } = {};

    if (triggerType !== undefined) {
      updateData.triggerType = nextTriggerType;
    }

    if (
      keyword !== undefined ||
      triggerType !== undefined
    ) {
      updateData.keyword = nextKeyword;
    }

    if (mediaId !== undefined) {
      updateData.mediaId = nextMediaId;
    }

    if (likeComment !== undefined) {
      updateData.likeComment = Boolean(likeComment);
    }

    if (commentReplyText !== undefined) {
      updateData.commentReplyText =
        typeof commentReplyText === "string" &&
        commentReplyText.trim()
          ? commentReplyText.trim()
          : null;
    }

    if (sendDm !== undefined) {
      updateData.sendDm = Boolean(sendDm);
    }

    if (likeIncomingDm !== undefined) {
      updateData.likeIncomingDm = Boolean(likeIncomingDm);
    }

    if (replyText !== undefined) {
      updateData.replyText =
        typeof replyText === "string" && replyText.trim()
          ? replyText.trim()
          : null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const automation = await prisma.automation.update({
      where: {
        id,
      },
      data: updateData,
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
    });

    return NextResponse.json(automation);
  } catch (error) {
    console.error("PATCH /api/automations/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در ویرایش Automation" },
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
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const automation = await prisma.automation.findFirst({
      where: {
        id,
        instagramAccount: {
          userId: session.user.id,
        },
      },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation پیدا نشد" },
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
      message: "Automation با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("DELETE /api/automations/[id] error:", error);

    return NextResponse.json(
      { error: "خطا در حذف Automation" },
      { status: 500 }
    );
  }
}