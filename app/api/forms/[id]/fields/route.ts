import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

type FieldType = (typeof validFieldTypes)[number];

function isValidFieldType(
  value: unknown
): value is FieldType {
  return (
    typeof value === "string" &&
    validFieldTypes.includes(value as FieldType)
  );
}

/**
 * GET /api/forms/[id]/fields
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
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

    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: "فرم پیدا نشد" },
        { status: 404 }
      );
    }

    const fields = await prisma.formField.findMany({
      where: {
        formId: id,
      },
      orderBy: {
        order: "asc",
      },
    });

    return NextResponse.json(fields);
  } catch (error) {
    console.error(
      "GET /api/forms/[id]/fields error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در دریافت فیلدهای فرم" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/[id]/fields
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
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

    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: "فرم پیدا نشد" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      label,
      name,
      type,
      required = false,
      placeholder,
      options,
      order,
    } = body;

    if (typeof label !== "string" || !label.trim()) {
      return NextResponse.json(
        { error: "label الزامی است" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name الزامی است" },
        { status: 400 }
      );
    }

    if (!isValidFieldType(type)) {
      return NextResponse.json(
        { error: "نوع فیلد نامعتبر است" },
        { status: 400 }
      );
    }

    /**
     * برای فیلدهایی که گزینه دارند،
     * options باید وجود داشته باشد.
     */
    const needsOptions =
      type === "SELECT" ||
      type === "RADIO" ||
      type === "CHECKBOX";

    if (
      needsOptions &&
      (!Array.isArray(options) || options.length === 0)
    ) {
      return NextResponse.json(
        {
          error:
            "برای SELECT، RADIO و CHECKBOX حداقل یک گزینه لازم است",
        },
        { status: 400 }
      );
    }

    /**
     * name را ساده و قابل استفاده می‌کنیم.
     */
    const normalizedName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    /**
     * جلوگیری از Name تکراری در یک Form
     */
    const duplicate = await prisma.formField.findFirst({
      where: {
        formId: id,
        name: normalizedName,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "فیلدی با این name قبلاً در این فرم وجود دارد",
        },
        { status: 409 }
      );
    }

    /**
     * Order
     */
    let fieldOrder: number;

    if (
      typeof order === "number" &&
      Number.isInteger(order)
    ) {
      fieldOrder = order;
    } else {
      const lastField =
        await prisma.formField.findFirst({
          where: {
            formId: id,
          },
          orderBy: {
            order: "desc",
          },
        });

      fieldOrder = lastField
        ? lastField.order + 1
        : 0;
    }

    const field = await prisma.formField.create({
      data: {
        formId: id,
        label: label.trim(),
        name: normalizedName,
        type,
        required: Boolean(required),

        placeholder:
          typeof placeholder === "string" &&
          placeholder.trim()
            ? placeholder.trim()
            : null,

        options: needsOptions ? options : null,

        order: fieldOrder,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/forms/[id]/fields error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در ساخت فیلد فرم" },
      { status: 500 }
    );
  }
}