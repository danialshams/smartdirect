import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeAutomation } from "@/lib/automation/execute-automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-off, token-gated recovery of two COMMENT private replies lost when
// the page's trial expired. Public comment replies must never be re-sent.
const ACCOUNT_ID = "cmtvdi3sl000004l2syhcur8q";
const AUTOMATION_ID = "cmwjs2of3000608jtze9q1u2x";
const OPERATION = "ONE_TIME_COMMENT_RECOVERY_20261124";
const TARGETS = [
  { commentId: "18115562162177343", senderId: "1675911057246536" },
  { commentId: "18100172117539857", senderId: "1611287987285879" },
] as const;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("recovery_token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = createHash("sha256").update(token).digest("hex");
  const granted = await prisma.idempotencyRecord.updateMany({
    where: {
      key,
      operation: OPERATION,
      resourceId: ACCOUNT_ID,
      status: "IN_PROGRESS",
      expiresAt: { gt: new Date() },
    },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (granted.count !== 1) {
    return NextResponse.json({ error: "Recovery token invalid or already used" }, { status: 403 });
  }

  const [account, automation] = await Promise.all([
    prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { id: true, userId: true, igUserId: true, isConnected: true },
    }),
    prisma.automation.findFirst({
      where: { id: AUTOMATION_ID, instagramAccountId: ACCOUNT_ID, isActive: true, requireFollow: false },
      select: {
        id: true,
        messages: { orderBy: { order: "asc" }, take: 1, select: { text: true, messageType: true } },
      },
    }),
  ]);

  if (!account?.isConnected || !automation || automation.messages[0]?.messageType !== "TEXT") {
    return NextResponse.json({ error: "Recovery configuration invalid" }, { status: 409 });
  }

  const results: Array<{ commentId: string; status: string; reason?: string }> = [];

  for (const target of TARGETS) {
    const [webhook, comment] = await Promise.all([
      prisma.webhookInboxEvent.findFirst({
        where: { instagramAccountId: ACCOUNT_ID, eventType: "COMMENT", eventId: target.commentId, status: "DONE" },
        select: { payload: true, createdAt: true },
      }),
      prisma.comment.findUnique({ where: { igCommentId: target.commentId } }),
    ]);
    const event = webhook?.payload as {
      id?: string;
      from?: { id?: string; username?: string };
      media?: { id?: string };
      text?: string;
    } | undefined;

    if (!webhook || !comment || comment.userId !== account.userId ||
        comment.replied || event?.id !== target.commentId ||
        String(event.from?.id || "") !== target.senderId ||
        event.from?.id === account.igUserId || event.text?.trim() !== "سایت" ||
        event.media?.id !== comment.igMediaId ||
        Date.now() - webhook.createdAt.getTime() > 7 * 24 * 60 * 60_000) {
      results.push({ commentId: target.commentId, status: "skipped", reason: "Eligibility or duplicate guard" });
      continue;
    }

    // Do not resend when another private message was already recorded since
    // this comment, even if an old comment's replied flag is stale.
    const newerOutgoing = await prisma.conversationMessage.count({
      where: {
        conversation: { instagramAccountId: ACCOUNT_ID, participantId: target.senderId },
        direction: "OUTBOUND",
        createdAt: { gt: webhook.createdAt },
      },
    });
    if (newerOutgoing) {
      results.push({ commentId: target.commentId, status: "skipped", reason: "Recipient already messaged" });
      continue;
    }

    try {
      const outcome = await executeAutomation({
        automationId: AUTOMATION_ID,
        instagramAccountId: account.id,
        participantId: target.senderId,
        igUserId: target.senderId,
        commentId: target.commentId,
        selectedQuickReplyId: null,
        executionId: "subscription-recovery-20261124:" + target.commentId,
      });
      if (outcome.success && outcome.executed) {
        await prisma.comment.update({
          where: { igCommentId: target.commentId },
          data: { replied: true, replyText: automation.messages[0]?.text || null },
        });
        results.push({ commentId: target.commentId, status: "sent" });
      } else {
        results.push({
          commentId: target.commentId,
          status: "not_sent",
          reason: "reason" in outcome ? String(outcome.reason) : "Automation declined",
        });
      }
    } catch (error) {
      results.push({
        commentId: target.commentId,
        status: "failed",
        reason: error instanceof Error ? error.message.slice(0, 180) : "Unknown error",
      });
    }
  }

  return NextResponse.json({ recovery: OPERATION, results }, {
    headers: { "Cache-Control": "no-store" },
  });
}
