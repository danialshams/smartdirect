import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLiveRule, LiveRuleValidationError, type LiveOption, type LiveRuleInput } from "@/lib/automation/live-rule";
import { replaceLiveReplyMessage } from "@/lib/automation/live-rule-store";
import { ensureLiveCommentSubscription } from "@/lib/instagram/live-comment-subscription";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";

export const liveRuleInclude = {
  messages: {
    orderBy: { order: "asc" as const },
    include: { quickReplies: { orderBy: { createdAt: "asc" as const } } },
  },
};

function collectNestedShowcases(items: LiveOption[], found: Set<string>) {
  for (const item of items) {
    if (item.destinationType === "SHOWCASE") found.add(item.destinationShowcaseId);
    collectNestedShowcases(item.destinationQuickReplies, found);
  }
}
export async function checkLiveRuleReferences(rule: LiveRuleInput, accountId: string, userId: string) {
  if (!rule.answer) return;
  const ids = new Set<string>();
  if (rule.answer.messageType === "SHOWCASE") ids.add(rule.answer.showcaseId);
  collectNestedShowcases(rule.answer.quickReplies, ids);
  if (ids.size) {
    const owned = await prisma.showcase.count({ where: { id: { in: [...ids] }, instagramAccountId: accountId, userId } });
    if (owned !== ids.size) throw new LiveRuleValidationError("یکی از ویترین‌ها متعلق به این پیج نیست.");
  }
  if (rule.answer.formId) {
    const found = await prisma.form.count({ where: { id: rule.answer.formId, instagramAccountId: accountId, userId } });
    if (!found) throw new LiveRuleValidationError("فرم انتخاب‌شده متعلق به این پیج نیست.");
  }
}
export async function checkLiveRuleConflict(rule: LiveRuleInput, accountId: string, exceptId?: string) {
  const others = await prisma.automation.findMany({
    where: { instagramAccountId: accountId, triggerType: "LIVE_COMMENT_KEYWORD", ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, keyword: true, keywordMatchMode: true },
  });
  const keys = new Set(rule.keyword.split(","));
  for (const existing of others) {
    const currentKeys = (existing.keyword || "").split(",").filter(Boolean);
    if (rule.keywordMatchMode === "CONTAINS_ANY" || existing.keywordMatchMode === "CONTAINS_ANY") {
      if (currentKeys.some((key) => [...keys].some((next) => key.includes(next) || next.includes(key))))
        throw new LiveRuleValidationError("این کلمه قبلاً در پاسخ خودکار لایو دیگری ثبت شده است.");
    } else if (currentKeys.some((key) => keys.has(key)))
      throw new LiveRuleValidationError("این کلمه قبلاً در پاسخ خودکار لایو دیگری ثبت شده است.");
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  const instagramAccountId = new URL(request.url).searchParams.get("instagramAccountId") || "";
  const account = await prisma.instagramAccount.findFirst({ where: { id: instagramAccountId, userId: session.user.id }, select: { id: true } });
  if (!account) return NextResponse.json({ error: "پیج انتخابی پیدا نشد." }, { status: 404 });
  const rows = await prisma.automation.findMany({
    where: { instagramAccountId, triggerType: "LIVE_COMMENT_KEYWORD" },
    include: liveRuleInclude,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
    const body = await request.json();
    const rule = parseLiveRule(body);
    const accountId = typeof body.instagramAccountId === "string" ? body.instagramAccountId : "";
    const account = await prisma.instagramAccount.findFirst({
      where: { id: accountId, userId: session.user.id, isConnected: true },
      select: { id: true },
    });
    if (!account) return NextResponse.json({ error: "پیج اینستاگرام متصل نیست." }, { status: 403 });
    await checkLiveRuleReferences(rule, accountId, session.user.id);
    await checkLiveRuleConflict(rule, accountId);
    // A subscription failure is visible to the user: don't silently create an inert automation.
    await ensureLiveCommentSubscription(accountId);
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.automation.create({
        data: {
          instagramAccountId: accountId, triggerType: "LIVE_COMMENT_KEYWORD",
          keyword: rule.keyword, keywordMatchMode: rule.keywordMatchMode, mediaId: null, mediaIds: null,
          replyText: rule.firstText, liveReplyMode: rule.mode, liveReplyKeyword: rule.replyKeyword || null,
          requireFollow: rule.requireFollow, followGateText: rule.requireFollow ? rule.followGateText : null,
          isActive: true, sendDm: true,
        },
      });
      await replaceLiveReplyMessage(tx, row.id, rule);
      return row;
    });
    await invalidateAutomationCache(accountId).catch(() => undefined);
    return NextResponse.json({ success: true, data: { id: created.id } }, { status: 201 });
  } catch (error) {
    console.error("[Live automation create]", error);
    return NextResponse.json({ error: error instanceof LiveRuleValidationError ? error.message : error instanceof Error ? error.message : "ساخت پاسخ لایو ناموفق بود." },
      { status: error instanceof LiveRuleValidationError ? 400 : 502 });
  }
}
