import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LiveRuleValidationError, parseLiveRule } from "@/lib/automation/live-rule";
import { replaceLiveReplyMessage } from "@/lib/automation/live-rule-store";
import { checkLiveRuleConflict, checkLiveRuleReferences, liveRuleInclude } from "../route";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

async function getOwnedRule(id: string, userId: string) {
  return prisma.automation.findFirst({
    where: { id, triggerType: "LIVE_COMMENT_KEYWORD", instagramAccount: { userId } },
    include: liveRuleInclude,
  });
}
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  const row = await getOwnedRule((await params).id, session.user.id);
  if (!row) return NextResponse.json({ error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
  return NextResponse.json({ success: true, data: row });
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
    const id = (await params).id;
    const existing = await getOwnedRule(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
    const body = await request.json();
    const rule = parseLiveRule(body);
    const expected = typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : new Date(NaN);
    if (!Number.isFinite(expected.getTime()) || existing.updatedAt.getTime() !== expected.getTime())
      return NextResponse.json({ error: "اطلاعات صفحه تغییر کرده است؛ دوباره وارد ویرایش شوید." }, { status: 409 });
    await checkLiveRuleReferences(rule, existing.instagramAccountId, session.user.id);
    await checkLiveRuleConflict(rule, existing.instagramAccountId, id);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.automation.updateMany({
        where: { id, updatedAt: expected },
        data: {
          keyword: rule.keyword, keywordMatchMode: rule.keywordMatchMode, replyText: rule.firstText,
          liveReplyMode: rule.mode, liveReplyKeyword: rule.replyKeyword || null,
          requireFollow: rule.requireFollow, followGateText: rule.requireFollow ? rule.followGateText : null,
        },
      });
      if (!updated.count) throw new LiveRuleValidationError("اطلاعات تغییر کرده است. دوباره وارد ویرایش شوید.");
      await replaceLiveReplyMessage(tx, id, rule);
    });
    await invalidateAutomationCache(existing.instagramAccountId).catch(() => undefined);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[Live automation update]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "ویرایش پاسخ لایو ناموفق بود." },
      { status: error instanceof LiveRuleValidationError ? 400 : 500 });
  }
}
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  const id = (await params).id;
  const found = await getOwnedRule(id, session.user.id);
  if (!found) return NextResponse.json({ error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
  await prisma.automation.delete({ where: { id } });
  await invalidateAutomationCache(found.instagramAccountId).catch(() => undefined);
  return NextResponse.json({ success: true });
}
