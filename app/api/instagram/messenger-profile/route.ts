import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { syncIceBreakers } from "@/lib/instagram/configure-ice-breakers";
import { syncPersistentMenu } from "@/lib/instagram/configure-persistent-menu";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const instagramAccountId = body.instagramAccountId;

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
        isConnected: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "Connected Instagram account not found",
        },
        { status: 404 },
      );
    }

    const [iceBreakers, persistentMenu] = await Promise.all([
      syncIceBreakers(instagramAccountId),
      syncPersistentMenu(instagramAccountId),
    ]);

    return NextResponse.json({
      success: true,
      iceBreakers,
      persistentMenu,
    });
  } catch (error) {
    console.error("[Messenger Profile Sync]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Messenger profile sync failed",
      },
      { status: 500 },
    );
  }
}
