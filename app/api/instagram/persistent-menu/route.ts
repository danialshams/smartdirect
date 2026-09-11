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
        {
          error: "instagramAccountId is required",
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
        {
          error: "Instagram account not found",
        },
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
      data: menu,
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      instagramAccountId?: string;
      enabled?: boolean;
      items?: MenuItemInput[];
    };

    const { instagramAccountId, enabled = true, items = [] } = body;

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

    if (items.length > 3) {
      return NextResponse.json(
        {
          error: "Persistent Menu supports up to 3 top-level items",
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
        {
          error: "Instagram account not found",
        },
        { status: 404 },
      );
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

      if (!item.automationId) {
        return NextResponse.json(
          {
            error: "Every menu item must have an automation",
          },
          { status: 400 },
        );
      }
    }

    const automationIds = [
      ...new Set(
        items
          .map((item) => item.automationId)
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
      ),
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

    const menu = await prisma.persistentMenu.upsert({
      where: {
        instagramAccountId,
      },
      create: {
        instagramAccountId,
        enabled: enabled && items.length > 0,
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
        enabled: enabled && items.length > 0,
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
      data: menu,
    });
  } catch (error) {
    console.error("[Persistent Menu POST]", error);

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

    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "Instagram account not found",
        },
        { status: 404 },
      );
    }

    await prisma.persistentMenuItem.deleteMany({
      where: {
        persistentMenu: {
          instagramAccountId,
        },
      },
    });

    await prisma.persistentMenu.updateMany({
      where: {
        instagramAccountId,
      },
      data: {
        enabled: false,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Persistent Menu DELETE]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to disable persistent menu",
      },
      { status: 500 },
    );
  }
}
