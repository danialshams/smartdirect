import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/forms?instagramAccountId=...
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
    const instagramAccountId =
      searchParams.get("instagramAccountId");

    const where: {
      userId: string;
      instagramAccountId?: string;
    } = {
      userId: session.user.id,
    };

    if (instagramAccountId) {
      where.instagramAccountId = instagramAccountId;
    }

    const forms = await prisma.form.findMany({
      where,
      include: {
        fields: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            fields: true,
            submissions: true,
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(forms);
  } catch (error) {
    console.error("GET /api/forms error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت فرم‌ها" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms
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
      title,
      description,
      isActive = true,
      fields,
    } = body;

    if (!instagramAccountId) {
      return NextResponse.json(
        { error: "instagramAccountId الزامی است" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "عنوان فرم الزامی است" },
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
        { error: "اکانت اینستاگرام پیدا نشد" },
        { status: 404 }
      );
    }

    const validFieldTypes = [
      "TEXT",
      "TEXTAREA",
      "PHONE",
      "EMAIL",
      "NUMBER",
      "SELECT",
      "RADIO",
      "CHECKBOX",
    ] as const;

    if (fields !== undefined && !Array.isArray(fields)) {
      return NextResponse.json(
        { error: "fields باید آرایه باشد" },
        { status: 400 }
      );
    }

    const normalizedFields = Array.isArray(fields)
      ? fields.map((field: unknown, index: number) => {
          if (!field || typeof field !== "object") {
            throw new Error(`فیلد ${index + 1} نامعتبر است`);
          }

          const item = field as Record<string, unknown>;
          const label = typeof item.label === "string" ? item.label.trim() : "";
          const name = typeof item.name === "string" ? item.name.trim() : "";
          const type = item.type;
          const required = Boolean(item.required);
          const placeholder =
            typeof item.placeholder === "string" && item.placeholder.trim()
              ? item.placeholder.trim()
              : null;

          if (!label) throw new Error(`متن فیلد ${index + 1} الزامی است`);
          if (!name) throw new Error(`name فیلد ${index + 1} الزامی است`);
          if (!validFieldTypes.includes(type as (typeof validFieldTypes)[number])) {
            throw new Error(`نوع فیلد ${index + 1} نامعتبر است`);
          }

          const needsOptions =
            type === "SELECT" || type === "RADIO" || type === "CHECKBOX";
          const options = needsOptions
            ? Array.isArray(item.options)
              ? item.options
                  .filter((option): option is string => typeof option === "string")
                  .map((option) => option.trim())
                  .filter(Boolean)
              : []
            : null;

          if (needsOptions && (!options || options.length === 0)) {
            throw new Error(`برای فیلد ${index + 1} حداقل یک گزینه لازم است`);
          }

          return {
            label,
            name,
            type: type as (typeof validFieldTypes)[number],
            required,
            placeholder,
            options,
            order: Number.isInteger(item.order) ? Number(item.order) : index,
          };
        })
      : [];

    const duplicateNames = new Set<string>();
    for (const field of normalizedFields) {
      if (duplicateNames.has(field.name)) {
        return NextResponse.json(
          { error: "نام فیلدها باید یکتا باشد" },
          { status: 400 }
        );
      }
      duplicateNames.add(field.name);
    }

    const form = await prisma.$transaction(async (tx) => {
      const createdForm = await tx.form.create({
        data: {
          userId: session.user.id,
          instagramAccountId,
          title: title.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          isActive: Boolean(isActive),
        },
      });

      if (normalizedFields.length > 0) {
        await tx.formField.createMany({
          data: normalizedFields.map((field) => ({
            ...field,
            formId: createdForm.id,
          })),
        });
      }

      return tx.form.findUnique({
        where: { id: createdForm.id },
        include: {
          fields: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    console.error("POST /api/forms error:", error);

    return NextResponse.json(
      { error: "خطا در ساخت فرم" },
      { status: 500 }
    );
  }
}