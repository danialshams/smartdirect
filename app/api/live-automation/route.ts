import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIVE_MEDIA_ID } from "@/lib/automation/live-replies";
import { validateLiveReplyInput, LiveReplyValidationError } from "@/lib/automation/live-reply-validation";
import {
  liveReplyInclude, createLiveReplyRule, displayLiveReply,
  assertNonOverlappingLiveKeywords, verifyLiveResponseOwnership,
} from "@/lib/automation/live-reply-storage";
import { invalidateAutomationCache } from "@/lib/cache/instagram";
import { subscribeLiveComments } from "@/lib/instagram/live-webhook-subscription";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const instagramAccountId = new URL(request.url).searchParams.get("instagramAccountId")?.trim();
    if (!instagramAccountId) return NextResponse.json({ success: false, error: "شناسه پیج الزامی است." }, { status: 400 });
    const account = await prisma.instagramAccount.findFirst({
      where: { id: instagramAccountId, userId: session.user.id }, select: { id: true },
    });
    if (!account) return NextResponse.json({ success: false, error: "پیج پیدا نشد." }, { status: 404 });
    const rules = await prisma.automation.findMany({
      where: { instagramAccountId, mediaId: LIVE_MEDIA_ID, triggerType: "COMMENT_KEYWORD" },
      orderBy: { createdAt: "desc" }, include: liveReplyInclude,
    });
    return NextResponse.json({ success: true, data: rules.map(displayLiveReply) });
  } catch (error) {
    console.error("GET /api/live-automation error:", error);
    return NextResponse.json({ success: false, error: "دریافت پاسخ‌های لایو ناموفق بود." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LiveReplyValidationError("درخواست نامعتبر است.");
    const accountId = (raw as Record<string, unknown>).instagramAccountId;
    if (typeof accountId !== "string" || !accountId.trim()) throw new LiveReplyValidationError("یک پیج انتخاب کن.");
    const account = await prisma.instagramAccount.findFirst({
      where: { id: accountId, userId: session.user.id, isConnected: true }, select: { id: true },
    });
    if (!account) return NextResponse.json({ success: false, error: "پیج متصل پیدا نشد." }, { status: 404 });
    const input = validateLiveReplyInput(raw);
    await assertNonOverlappingLiveKeywords(account.id, input.keyword);
    await verifyLiveResponseOwnership(input, account.id, session.user.id);
    const rule = await createLiveReplyRule(input, account.id);
    try { await invalidateAutomationCache(account.id); }
    catch (e) { console.warn("Live automation cache invalidate failed:", e); }
    const subscription = await subscribeLiveComments(account.id);
    return NextResponse.json({ success: true, data: displayLiveReply(rule), subscription }, { status: 201 });
  } catch (error) {
    if (error instanceof LiveReplyValidationError)
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("POST /api/live-automation error:", error);
    return NextResponse.json({ success: false, error: "ساخت پاسخ خودکار لایو ناموفق بود." }, { status: 500 });
  }
}
