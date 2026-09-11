import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteInstagramIceBreakers,
  setInstagramIceBreakers,
} from "@/lib/instagram/messenger-profile";

export const dynamic = "force-dynamic";

type IceBreakerItemInput = {
  question: string;
  automationId: string;
};

function generatePayload() {
  return `icebreaker_${crypto.randomUUID()}`;
}

async function getAccountForUser(instagramAccountId: string, userId: string) {
  return prisma.instagramAccount.findFirst({
    where: {
      id: instagramAccountId,
      userId,
    },
  });
}

async function getIceBreakers(instagramAccountId: string) {
  return prisma.iceBreaker.findMany({
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
        {
          error: "instagramAccountId is required",
        },
        { status: 400 },
      );
    }

    const account = await getAccountForUser(
      instagramAccountId,
      session.user.id,
    );

    if (!account) {
      return NextResponse.json(
        {
          error: "Instagram account not found",
        },
        { status: 404 },
      );
    }

    const iceBreakers = await getIceBreakers(instagramAccountId);

    return NextResponse.json({
      success: true,
      data: iceBreakers,
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

    const body = (await request.json()) as {
      instagramAccountId?: string;
      enabled?: boolean;
      items?: IceBreakerItemInput[];
    };

    const { instagramAccountId, items = [] } = body;

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          error: "instagramAccountId is required",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        {
          error: "items must be an array",
        },
        { status: 400 },
      );
    }

    if (items.length > 4) {
      return NextResponse.json(
        {
          error: "Instagram allows a maximum of 4 Ice Breakers",
        },
        { status: 400 },
      );
    }

    const account = await getAccountForUser(
      instagramAccountId,
      session.user.id,
    );

    if (!account) {
      return NextResponse.json(
        {
          error: "Instagram account not found",
        },
        { status: 404 },
      );
    }

    /*
     * Validate all Ice Breakers.
     */
    for (const item of items) {
      if (!item.question?.trim()) {
        return NextResponse.json(
          {
            error: "Ice Breaker question cannot be empty",
          },
          { status: 400 },
        );
      }

      if (item.question.trim().length > 80) {
        return NextResponse.json(
          {
            error: "Ice Breaker question must be 80 characters or less",
          },
          { status: 400 },
        );
      }

      if (!item.automationId) {
        return NextResponse.json(
          {
            error: "Every Ice Breaker must have an automation",
          },
          { status: 400 },
        );
      }
    }

    /*
     * Validate all selected automations.
     */
    const automationIds = [
      ...new Set(items.map((item) => item.automationId).filter(Boolean)),
    ];

    if (automationIds.length > 0) {
      const automations = await prisma.automation.findMany({
        where: {
          id: {
            in: automationIds,
          },
          instagramAccountId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      const validAutomationIds = new Set(
        automations.map((automation) => automation.id),
      );

      for (const automationId of automationIds) {
        if (!validAutomationIds.has(automationId)) {
          return NextResponse.json(
            {
              error: "One or more selected automations are invalid or inactive",
            },
            { status: 400 },
          );
        }
      }
    }

    /*
     * Generate payloads BEFORE syncing with Meta.
     *
     * The same payloads will be:
     *
     * 1. Saved in Prisma
     * 2. Sent to Instagram
     *
     * This is important because the webhook
     * later uses this payload to find the
     * correct Automation.
     */
    const preparedItems = items.map((item, index) => ({
      question: item.question.trim(),
      automationId: item.automationId,
      payload: generatePayload(),
      order: index,
    }));

    /*
     * First update Instagram itself.
     *
     * If Meta rejects the configuration,
     * we don't change the database.
     */
    if (preparedItems.length > 0) {
      await setInstagramIceBreakers({
        instagramAccountId,
        instagramUserId: account.igUserId,
        iceBreakers: preparedItems.map((item) => ({
          question: item.question,
          payload: item.payload,
        })),
      });
    } else {
      await deleteInstagramIceBreakers({
        instagramAccountId,
        instagramUserId: account.igUserId,
      });
    }

    /*
     * Meta accepted the configuration.
     * Now synchronize Prisma.
     */
    await prisma.$transaction(async (tx) => {
      await tx.iceBreaker.deleteMany({
        where: {
          instagramAccountId,
        },
      });

      if (preparedItems.length > 0) {
        await tx.iceBreaker.createMany({
          data: preparedItems.map((item) => ({
            instagramAccountId,
            automationId: item.automationId,
            question: item.question,
            payload: item.payload,
            order: item.order,
            isActive: true,
          })),
        });
      }
    });

    const iceBreakers = await getIceBreakers(instagramAccountId);

    return NextResponse.json({
      success: true,
      data: iceBreakers,
    });
  } catch (error) {
    console.error("[Ice Breakers POST]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save ice breakers",
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

    const instagramAccountId = searchParams.get("instagramAccountId");

    if (!instagramAccountId) {
      return NextResponse.json(
        {
          error: "instagramAccountId is required",
        },
        { status: 400 },
      );
    }

    const account = await getAccountForUser(
      instagramAccountId,
      session.user.id,
    );

    if (!account) {
      return NextResponse.json(
        {
          error: "Instagram account not found",
        },
        { status: 404 },
      );
    }

    /*
     * Remove Ice Breakers from Instagram first.
     */
    await deleteInstagramIceBreakers({
      instagramAccountId,
      instagramUserId: account.igUserId,
    });

    /*
     * Then remove them from Prisma.
     */
    await prisma.iceBreaker.deleteMany({
      where: {
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
            : "Failed to delete ice breakers",
      },
      { status: 500 },
    );
  }
}
