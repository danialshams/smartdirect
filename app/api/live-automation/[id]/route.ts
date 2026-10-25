import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIVE_MEDIA_ID } from "@/lib/automation/live-replies";
import { validateLiveReplyInput, LiveReplyValidationError } from "@/lib/automation/live-reply-validation";
import {
  liveReplyInclude, updateLiveReplyRule, displayLiveReply,
  assertNonOverlappingLiveKeywords, verifyLiveResponseOwnership,
} from "@/lib/automation/live-reply-storage";
import { invalidateAutomationCache } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function ownedRule(id: string, userId: string) {
  return prisma.automation.findFirst({
    where: {
      id, triggerType: "COMMENT_KEYWORD", mediaId: LIVE_MEDIA_ID,
      instagramAccount: { userId },
    },
    include: liveReplyInclude,
  });
}

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const rule = await ownedRule(id, session.user.id);
    if (!rule) return NextResponse.json({ success: false, error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
    return NextResponse.json({ success: true, data: displayLiveReply(rule) });
  } catch (error) {
    console.error("GET /api/live-automation/[id] error:", error);
    return NextResponse.json({ success: false, error: "دریافت پاسخ لایو ناموفق بود." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const existing = await ownedRule(id, session.user.id);
    if (!existing) return NextResponse.json({ success: false, error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LiveReplyValidationError("درخواست نامعتبر است.");
    const expected = (raw as Record<string, unknown>).expectedUpdatedAt;
    if (typeof expected !== "string" || !Number.isFinite(Date.parse(expected)))
      throw new LiveReplyValidationError("ویرایش قدیمی است. صفحه را دوباره باز کن.", 409);
    const rule = validateLiveReplyInput(raw);
    await assertNonOverlappingLiveKeywords(existing.instagramAccountId, rule.keyword, rule.matchMode, id);
    await verifyLiveResponseOwnership(rule, existing.instagramAccountId, session.user.id);
    const updated = await updateLiveReplyRule(rule, id, new Date(expected));
    try { await invalidateAutomationCache(existing.instagramAccountId); }
    catch (e) { console.warn("Live automation cache invalidate failed:", e); }
    return NextResponse.json({ success: true, data: displayLiveReply(updated) });
  } catch (error) {
    if (error instanceof LiveReplyValidationError)
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("PUT /api/live-automation/[id] error:", error);
    return NextResponse.json({ success: false, error: "ویرایش پاسخ لایو ناموفق بود." }, { status: 500 });
  }
}

export async function PATCH(request:NextRequest,{params}:Context){
  try{
    const session=await getServerSession(authOptions);
    if(!session?.user?.id)return NextResponse.json({success:false,error:"احراز هویت لازم است."},{status:401});
    const {id}=await params;
    const rule=await ownedRule(id,session.user.id);
    if(!rule)return NextResponse.json({success:false,error:"پاسخ لایو پیدا نشد."},{status:404});
    const body:unknown=await request.json();
    if(!body||typeof body!=="object"||Array.isArray(body)||typeof (body as {isActive?:unknown}).isActive!=="boolean")
      return NextResponse.json({success:false,error:"وضعیت نامعتبر است."},{status:400});
    const isActive=(body as {isActive:boolean}).isActive;
    const updated=await prisma.automation.update({where:{id:rule.id},data:{isActive,...(isActive?{mediaIds:null}:{})},include:liveReplyInclude});
    await invalidateAutomationCache(rule.instagramAccountId);
    return NextResponse.json({success:true,data:displayLiveReply(updated)});
  }catch(error){
    console.error("Live rule toggle failed",error);
    return NextResponse.json({success:false,error:"تغییر وضعیت لایو ناموفق بود."},{status:500});
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const existing = await ownedRule(id, session.user.id);
    if (!existing) return NextResponse.json({ success: false, error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
    await prisma.automation.delete({ where: { id: existing.id } });
    try { await invalidateAutomationCache(existing.instagramAccountId); }
    catch (e) { console.warn("Live automation cache invalidate failed:", e); }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/live-automation/[id] error:", error);
    return NextResponse.json({ success: false, error: "حذف پاسخ لایو ناموفق بود." }, { status: 500 });
  }
}
