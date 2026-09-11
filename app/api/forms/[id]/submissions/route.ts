import { InputJsonValue } from "./../../../../../src/generated/prisma/internal/prismaNamespace";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * GET /api/forms/[id]/submissions
 *
 * فقط صاحب فرم می‌تواند Submission ها را ببیند.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!form) {
      return NextResponse.json({ error: "فرم پیدا نشد" }, { status: 404 });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: {
        formId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("GET /api/forms/[id]/submissions error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت پاسخ‌های فرم" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/forms/[id]/submissions
 *
 * ثبت پاسخ فرم
 *
 * این endpoint بعداً توسط Flow Engine نیز استفاده می‌شود.
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await params;

    const form = await prisma.form.findUnique({
      where: {
        id,
      },
      include: {
        fields: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "فرم پیدا نشد" }, { status: 404 });
    }

    if (!form.isActive) {
      return NextResponse.json(
        { error: "این فرم غیرفعال است" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const { igUserId, username, answers } = body;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json(
        { error: "answers معتبر نیست" },
        { status: 400 },
      );
    }

    /**
     * بررسی فیلدهای Required
     */
    const missingFields: string[] = [];

    for (const field of form.fields) {
      if (!field.required) {
        continue;
      }

      const value = answers[field.name];

      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (isEmpty) {
        missingFields.push(field.name);
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "برخی فیلدهای الزامی تکمیل نشده‌اند",
          fields: missingFields,
        },
        { status: 400 },
      );
    }

    /**
     * فقط فیلدهای تعریف‌شده در Form را ذخیره می‌کنیم.
     *
     * این کار جلوی ورود داده‌های اضافی به answers را می‌گیرد.
     */
    const cleanAnswers: Record<string, unknown> = {};

    for (const field of form.fields) {
      if (Object.prototype.hasOwnProperty.call(answers, field.name)) {
        cleanAnswers[field.name] = answers[field.name];
      }
    }

    const submission = await prisma.formSubmission.create({
      data: {
        formId: id,

        igUserId:
          typeof igUserId === "string" && igUserId.trim()
            ? igUserId.trim()
            : null,

        username:
          typeof username === "string" && username.trim()
            ? username.trim()
            : null,

        answers: cleanAnswers as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("POST /api/forms/[id]/submissions error:", error);

    return NextResponse.json({ error: "خطا در ثبت پاسخ فرم" }, { status: 500 });
  }
}
