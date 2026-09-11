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

/**
 * GET /api/automations
 *
 * دریافت Automation های اکانت اینستاگرام کاربر
 *
 * Query:
 * ?instagramAccountId=...
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        { error: "instagramAccountId الزامی است" },
        { status: 400 }
      );
    }

    const instagramAccount = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
    });

    if (!instagramAccount) {
      return NextResponse.json(
        { error: "اکانت اینستاگرام پیدا نشد" },
        { status: 404 }
      );
    }

    const automations = await prisma.automation.findMany({
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
            showcase: true,
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

    return NextResponse.json(automations);
  } catch (error) {
    console.error("GET /api/automations error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت Automation ها" },
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
        { error: "احراز هویت انجام نشده است" },
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
        { error: "instagramAccountId الزامی است" },
        { status: 400 }
      );
    }

    const validTriggerTypes = [
      "COMMENT_KEYWORD",
      "DM",
      "STORY_REPLY_KEYWORD",
    ];

    if (!validTriggerTypes.includes(triggerType)) {
      return NextResponse.json(
        { error: "نوع Trigger نامعتبر است" },
        { status: 400 }
      );
    }

    /**
     * بررسی مالکیت اکانت اینستاگرام
     */
    const instagramAccount = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
    });

    if (!instagramAccount) {
      return NextResponse.json(
        { error: "اکانت اینستاگرام متعلق به این کاربر نیست" },
        { status: 403 }
      );
    }

    /**
     * Trigger های Keyword باید Keyword داشته باشند.
     *
     * DM نیازی به Keyword ندارد.
     */
    const requiresKeyword =
      triggerType === "COMMENT_KEYWORD" ||
      triggerType === "STORY_REPLY_KEYWORD";

    let normalizedKeyword: string | null = null;

    if (requiresKeyword) {
      if (typeof keyword !== "string" || !keyword.trim()) {
        return NextResponse.json(
          { error: "برای این نوع Trigger وارد کردن Keyword الزامی است" },
          { status: 400 }
        );
      }

      normalizedKeyword = normalizeKeyword(keyword);

      if (!normalizedKeyword) {
        return NextResponse.json(
          { error: "Keyword معتبر نیست" },
          { status: 400 }
        );
      }
    }

    /**
     * DM می‌تواند بدون mediaId روی تمام Conversation ها اجرا شود.
     *
     * Comment و Story Reply هم می‌توانند:
     * - روی Media خاص باشند
     * - یا روی همه Media ها باشند
     */
    if (
      triggerType === "DM" &&
      typeof keyword === "string" &&
      keyword.trim()
    ) {
      normalizedKeyword = null;
    }

    /**
     * جلوگیری از Automation کاملاً مشابه
     *
     * چون در Schema جدید Unique مرکب نداریم،
     * از findFirst استفاده می‌کنیم.
     */
    const duplicate = await prisma.automation.findFirst({
      where: {
        instagramAccountId,
        triggerType,
        keyword: normalizedKeyword,
        mediaId: mediaId || null,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error: "Automation مشابه قبلاً وجود دارد",
          automation: duplicate,
        },
        { status: 409 }
      );
    }

    /**
     * ساخت Automation
     */
    const automation = await prisma.automation.create({
      data: {
        instagramAccountId,
        triggerType,
        keyword: normalizedKeyword,
        mediaId: mediaId || null,

        likeComment: Boolean(likeComment),
        commentReplyText:
          typeof commentReplyText === "string" && commentReplyText.trim()
            ? commentReplyText.trim()
            : null,

        sendDm: Boolean(sendDm),

        likeIncomingDm: Boolean(likeIncomingDm),

        replyText:
          typeof replyText === "string" && replyText.trim()
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

    return NextResponse.json(automation, { status: 201 });
  } catch (error) {
    console.error("POST /api/automations error:", error);

    return NextResponse.json(
      { error: "خطا در ساخت Automation" },
      { status: 500 }
    );
  }
}