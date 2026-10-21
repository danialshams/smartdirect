import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { selectableForReminder } from "@/lib/automation/smart-reminder-options";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}
async function owner() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
function validRuleData(body: Record<string, unknown>) {
  const instagramAccountId = typeof body.instagramAccountId === "string" ? body.instagramAccountId.trim() : "";
  const automationId = typeof body.automationId === "string" ? body.automationId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const delayMinutes = Number(body.delayMinutes);
  if (!instagramAccountId || !automationId) throw new Error("پیج و پاسخ خودکار را انتخاب کن.");
  if (!Number.isInteger(delayMinutes) || delayMinutes < 5 || delayMinutes > 1380)
    throw new Error("زمان انتظار باید بین ۵ دقیقه تا ۲۳ ساعت باشد.");
  if (!text || text.length > 1000) throw new Error("متن یادآوری باید بین ۱ تا ۱۰۰۰ کاراکتر باشد.");
  return { instagramAccountId, automationId, text, delayMinutes };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await owner();
    if (!userId) return fail("احراز هویت انجام نشده است.", 401);
    const instagramAccountId = new URL(request.url).searchParams.get("instagramAccountId")?.trim();
    if (!instagramAccountId) return fail("شناسه پیج الزامی است.");
    const account = await prisma.instagramAccount.findFirst({
      where: { id: instagramAccountId, userId }, select: { id: true },
    });
    if (!account) return fail("پیج متعلق به حساب شما نیست.", 403);
    const [rules, candidates] = await Promise.all([
      prisma.smartReminderRule.findMany({
        where: { instagramAccountId, userId }, orderBy: { createdAt: "desc" },
        include: { automation: { select: { keyword: true, keywordMatchMode: true, triggerType: true, isActive: true } },
          _count: { select: { deliveries: { where: { status: "SENT" } } } } },
      }),
      prisma.automation.findMany({
        where: { instagramAccountId, isActive: true,
          triggerType: { in: ["DM", "STORY_REPLY_KEYWORD", "COMMENT_KEYWORD"] }, messages: { some: {} } },
        select: { id: true, triggerType: true, keyword: true, keywordMatchMode: true, mediaId: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const automations = candidates.filter(selectableForReminder);
    return NextResponse.json({ success: true, data: rules, automations });
  } catch (error) {
    console.error("GET /api/smart-reminders", error);
    return fail("دریافت یادآوری‌ها ناموفق بود.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await owner();
    if (!userId) return fail("احراز هویت انجام نشده است.", 401);
    const body = await request.json() as Record<string, unknown>;
    const input = validRuleData(body);
    const automation = await prisma.automation.findFirst({
      where: { id: input.automationId, instagramAccountId: input.instagramAccountId,
        instagramAccount: { userId, isConnected: true },
        triggerType: { in: ["DM", "STORY_REPLY_KEYWORD", "COMMENT_KEYWORD"] }, messages: { some: {} }, isActive: true },
      select: { id: true, triggerType: true, keyword: true, keywordMatchMode: true, mediaId: true },
    });
    if (!automation || !selectableForReminder(automation)) return fail("پاسخ خودکار انتخاب‌شده معتبر نیست یا متعلق به پیج شما نیست.", 403);
    const exists = await prisma.smartReminderRule.findUnique({ where: { automationId: input.automationId }, select: { id: true } });
    if (exists) return fail("برای این پاسخ خودکار قبلاً یادآوری ساخته شده است.", 409);
    const row = await prisma.smartReminderRule.create({ data: { ...input, userId, isActive: true } });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("زمان انتظار") || error.message.includes("متن یادآوری") || error.message.includes("انتخاب کن")))
      return fail(error.message);
    console.error("POST /api/smart-reminders", error);
    return fail("ساخت یادآوری ناموفق بود.", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await owner();
    if (!userId) return fail("احراز هویت انجام نشده است.", 401);
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const input = validRuleData(body);
    const current = await prisma.smartReminderRule.findFirst({
      where: { id, userId, instagramAccountId: input.instagramAccountId },
    });
    if (!current) return fail("یادآوری پیدا نشد.", 404);
    if (input.automationId !== current.automationId) {
      const replacement = await prisma.automation.findFirst({
        where: {
          id: input.automationId,
          instagramAccountId: current.instagramAccountId,
          instagramAccount: { userId, isConnected: true },
          isActive: true,
          triggerType: { in: ["DM", "STORY_REPLY_KEYWORD", "COMMENT_KEYWORD"] },
          messages: { some: {} },
        },
        select: { id: true, triggerType: true, keyword: true, keywordMatchMode: true, mediaId: true },
      });
      if (!replacement || !selectableForReminder(replacement)) return fail("پاسخ خودکار انتخاب‌شده معتبر نیست یا متعلق به پیج شما نیست.", 403);
      const occupied = await prisma.smartReminderRule.findUnique({
        where: { automationId: input.automationId }, select: { id: true },
      });
      if (occupied && occupied.id !== current.id) {
        return fail("برای این پاسخ خودکار قبلاً یادآوری ساخته شده است.", 409);
      }
    }
    const row = await prisma.$transaction(async tx => {
      // Once settings change, a previously scheduled copy must not send old text.
      await tx.smartReminderDelivery.updateMany({
        where: { ruleId: current.id, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      return tx.smartReminderRule.update({
        where: { id: current.id }, data: { automationId: input.automationId, text: input.text, delayMinutes: input.delayMinutes, isActive: true },
      });
    });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("زمان انتظار") || error.message.includes("متن یادآوری") || error.message.includes("انتخاب کن")))
      return fail(error.message);
    console.error("PUT /api/smart-reminders", error);
    return fail("ویرایش یادآوری ناموفق بود.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await owner();
    if (!userId) return fail("احراز هویت انجام نشده است.", 401);
    const body = await request.json() as { id?: string };
    const rule = await prisma.smartReminderRule.findFirst({
      where: { id: body?.id || "", userId }, select: { id: true },
    });
    if (!rule) return fail("یادآوری پیدا نشد.", 404);
    await prisma.smartReminderRule.delete({ where: { id: rule.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/smart-reminders", error);
    return fail("حذف یادآوری ناموفق بود.", 500);
  }
}
