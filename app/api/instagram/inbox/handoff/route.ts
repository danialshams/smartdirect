import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

type HandoffRow = {
  conversationId: string;
  active: boolean;
  assignedToUserId: string | null;
  handedOffAt: Date;
  handedBackAt: Date | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return jsonError("برای مدیریت گفتگو باید وارد حساب شوید.", 401);

    const body = (await request.json().catch(() => ({}))) as {
      accountId?: unknown;
      conversationId?: unknown;
      action?: unknown;
    };

    const accountId = typeof body.accountId === "string" ? body.accountId : "";
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";
    const action = body.action === "resume" ? "resume" : body.action === "transfer" ? "transfer" : "";

    if (!accountId || !conversationId || !action)
      return jsonError("accountId، conversationId و action الزامی هستند.");

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
        instagramAccountId: accountId,
      },
      select: { id: true },
    });

    if (!conversation) return jsonError("گفتگو پیدا نشد.", 404);

    if (action === "transfer") {
      await prisma.$executeRaw`
        INSERT INTO "ConversationHandoff" ("conversationId", "userId", "active", "assignedToUserId", "handedOffAt", "handedBackAt")
        VALUES (${conversation.id}, ${session.user.id}, true, ${session.user.id}, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT ("conversationId") DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "active" = true,
          "assignedToUserId" = EXCLUDED."assignedToUserId",
          "handedOffAt" = CURRENT_TIMESTAMP,
          "handedBackAt" = NULL
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ConversationHandoff" ("conversationId", "userId", "active", "assignedToUserId", "handedOffAt", "handedBackAt")
        VALUES (${conversation.id}, ${session.user.id}, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("conversationId") DO UPDATE SET
          "active" = false,
          "assignedToUserId" = NULL,
          "handedBackAt" = CURRENT_TIMESTAMP
      `;
    }

    const rows = await prisma.$queryRaw<HandoffRow[]>`
      SELECT "conversationId", "active", "assignedToUserId", "handedOffAt", "handedBackAt"
      FROM "ConversationHandoff"
      WHERE "conversationId" = ${conversation.id}
      LIMIT 1
    `;

    const handoff = rows[0] ?? null;

    return NextResponse.json({
      success: true,
      humanMode: handoff?.active ?? false,
      handoff,
    });
  } catch (error) {
    console.error("Instagram handoff error:", error);
    return jsonError(error instanceof Error ? error.message : "خطا در تغییر وضعیت گفتگو", 500);
  }
}
