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
 * GET /api/forms/[id]/fields/[fieldId]
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      fieldId: string;
    }>;
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

    const { id, fieldId } = await params;

    const field = await prisma.formField.findFirst({
      where: {
        id: fieldId,
        formId: id,
        form: {
          userId: session.user.id,
        },
      },
    });

    if (!field) {
      return NextResponse.json(
        { error: "فیلد پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error(
      "GET /api/forms/[id]/fields/[fieldId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در دریافت فیلد" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/forms/[id]/fields/[fieldId]
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      fieldId: string;
    }>;
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

    const { id, fieldId } = await params;

    const existingField =
      await prisma.formField.findFirst({
        where: {
          id: fieldId,
          formId: id,
          form: {
            userId: session.user.id,
          },
        },
      });

    if (!existingField) {
      return NextResponse.json(
        { error: "فیلد پیدا نشد" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      label,
      name,
      type,
      required,
      placeholder,
      options,
      order,
    } = body;

    if (
      label !== undefined &&
      (typeof label !== "string" || !label.trim())
    ) {
      return NextResponse.json(
        { error: "label معتبر نیست" },
        { status: 400 }
      );
    }

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return NextResponse.json(
        { error: "name معتبر نیست" },
        { status: 400 }
      );
    }

    const nextType =
      type !== undefined ? type : existingField.type;

    if (!isValidFieldType(nextType)) {
      return NextResponse.json(
        { error: "نوع فیلد نامعتبر است" },
        { status: 400 }
      );
    }

    const nextName =
      name !== undefined
        ? name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
        : existingField.name;

    /**
     * بررسی Name تکراری
     */
    if (nextName !== existingField.name) {
      const duplicate =
        await prisma.formField.findFirst({
          where: {
            formId: id,
            name: nextName,
            id: {
              not: fieldId,
            },
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
    }

    const needsOptions =
      nextType === "SELECT" ||
      nextType === "RADIO" ||
      nextType === "CHECKBOX";

    const nextOptions =
      options !== undefined
        ? options
        : existingField.options;

    if (
      needsOptions &&
      (!Array.isArray(nextOptions) ||
        nextOptions.length === 0)
    ) {
      return NextResponse.json(
        {
          error:
            "برای SELECT، RADIO و CHECKBOX حداقل یک گزینه لازم است",
        },
        { status: 400 }
      );
    }

    const field = await prisma.formField.update({
      where: {
        id: fieldId,
      },
      data: {
        ...(label !== undefined
          ? {
              label: label.trim(),
            }
          : {}),

        ...(name !== undefined
          ? {
              name: nextName,
            }
          : {}),

        ...(type !== undefined
          ? {
              type: nextType,
            }
          : {}),

        ...(required !== undefined
          ? {
              required: Boolean(required),
            }
          : {}),

        ...(placeholder !== undefined
          ? {
              placeholder:
                typeof placeholder === "string" &&
                placeholder.trim()
                  ? placeholder.trim()
                  : null,
            }
          : {}),

        ...(options !== undefined
          ? {
              options: needsOptions ? nextOptions : null,
            }
          : type !== undefined && !needsOptions
            ? {
                options: null,
              }
            : {}),

        ...(order !== undefined &&
        typeof order === "number" &&
        Number.isInteger(order)
          ? {
              order,
            }
          : {}),
      },
    });

    return NextResponse.json(field);
  } catch (error) {
    console.error(
      "PATCH /api/forms/[id]/fields/[fieldId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در ویرایش فیلد" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/[id]/fields/[fieldId]
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      fieldId: string;
    }>;
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

    const { id, fieldId } = await params;

    const field =
      await prisma.formField.findFirst({
        where: {
          id: fieldId,
          formId: id,
          form: {
            userId: session.user.id,
          },
        },
      });

    if (!field) {
      return NextResponse.json(
        { error: "فیلد پیدا نشد" },
        { status: 404 }
      );
    }

    await prisma.formField.delete({
      where: {
        id: fieldId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "فیلد با موفقیت حذف شد",
    });
  } catch (error) {
    console.error(
      "DELETE /api/forms/[id]/fields/[fieldId] error:",
      error
    );

    return NextResponse.json(
      { error: "خطا در حذف فیلد" },
      { status: 500 }
    );
  }
}