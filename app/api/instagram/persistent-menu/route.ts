import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MenuItemInput = {
  title: string;
  automationId?: string | null;
};

function generatePayload() {
  return `persistent_${crypto.randomUUID()}`;
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

    const menu = await prisma.persistentMenu.findUnique({
      where: {
        instagramAccountId,
      },
      include: {
        items: {
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
        },
      },
    });

    return NextResponse.json({
      success: true,
      menu,
    });
  } catch (error) {
    console.error("[Persistent Menu GET]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load persistent menu",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      instagramAccountId,
      enabled = true,
      items = [],
    } = body as {
      instagramAccountId?: string;
      enabled?: boolean;
      items?: MenuItemInput[];
    };

    if (!instagramAccountId) {
      return NextResponse.json(
        { error: "instagramAccountId is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items must be an array" },
        { status: 400 },
      );
    }

    if (items.length > 3) {
      return NextResponse.json(
        {
          error: "Instagram persistent menu supports up to 3 top-level items",
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

    const automationIds = items
      .map((item) => item.automationId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

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

      const validIds = new Set(automations.map((automation) => automation.id));

      for (const automationId of automationIds) {
        if (!validIds.has(automationId)) {
          return NextResponse.json(
            {
              error:
                "One or more automations do not belong to this Instagram account",
            },
            { status: 400 },
          );
        }
      }
    }

    for (const item of items) {
      if (!item.title?.trim()) {
        return NextResponse.json(
          {
            error: "Persistent menu item title cannot be empty",
          },
          { status: 400 },
        );
      }

      if (item.title.trim().length > 30) {
        return NextResponse.json(
          {
            error: "Persistent menu item title must be 30 characters or less",
          },
          { status: 400 },
        );
      }
    }

    const menu = await prisma.persistentMenu.upsert({
      where: {
        instagramAccountId,
      },
      create: {
        instagramAccountId,
        enabled,
        items: {
          create: items.map((item, index) => ({
            title: item.title.trim(),
            payload: generatePayload(),
            automationId: item.automationId || null,
            order: index,
          })),
        },
      },
      update: {
        enabled,
        items: {
          deleteMany: {},
          create: items.map((item, index) => ({
            title: item.title.trim(),
            payload: generatePayload(),
            automationId: item.automationId || null,
            order: index,
          })),
        },
      },
      include: {
        items: {
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
        },
      },
    });

    return NextResponse.json({
      success: true,
      menu,
    });
  } catch (error) {
    console.error("[Persistent Menu PUT]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save persistent menu",
      },
      { status: 500 },
    );
  }
}
