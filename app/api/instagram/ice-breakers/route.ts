import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function generatePayload() {
  return `icebreaker_${crypto.randomUUID()}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        { error: "instagramAccountId is required" },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Instagram account not found" },
        { status: 404 },
      );
    }

    const iceBreakers = await prisma.iceBreaker.findMany({
      where: {
        instagramAccountId,
      },
      include: {
        automation: {
          select: {
            id: true,
            triggerType: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      iceBreakers,
    });
  } catch (error) {
    console.error("[Ice Breakers GET]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load ice breakers",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      instagramAccountId,
      question,
      automationId,
      order = 0,
      isActive = true,
    } = body;

    if (!instagramAccountId || !question || !automationId) {
      return NextResponse.json(
        {
          error: "instagramAccountId, question and automationId are required",
        },
        { status: 400 },
      );
    }

    if (question.trim().length > 80) {
      return NextResponse.json(
        {
          error: "Ice Breaker question must be 80 characters or less",
        },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Instagram account not found" },
        { status: 404 },
      );
    }

    const automation = await prisma.automation.findFirst({
      where: {
        id: automationId,
        instagramAccountId,
        isActive: true,
      },
    });

    if (!automation) {
      return NextResponse.json(
        {
          error:
            "Automation not found or does not belong to this Instagram account",
        },
        { status: 404 },
      );
    }

    const count = await prisma.iceBreaker.count({
      where: {
        instagramAccountId,
      },
    });

    if (count >= 4) {
      return NextResponse.json(
        {
          error: "Instagram allows a maximum of 4 Ice Breakers",
        },
        { status: 400 },
      );
    }

    const iceBreaker = await prisma.iceBreaker.create({
      data: {
        instagramAccountId,
        automationId,
        question: question.trim(),
        payload: generatePayload(),
        order,
        isActive,
      },
      include: {
        automation: {
          select: {
            id: true,
            triggerType: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        iceBreaker,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Ice Breakers POST]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create ice breaker",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");
    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!id || !instagramAccountId) {
      return NextResponse.json(
        {
          error: "id and instagramAccountId are required",
        },
        { status: 400 },
      );
    }

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Instagram account not found" },
        { status: 404 },
      );
    }

    await prisma.iceBreaker.deleteMany({
      where: {
        id,
        instagramAccountId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Ice Breakers DELETE]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete ice breaker",
      },
      { status: 500 },
    );
  }
}
