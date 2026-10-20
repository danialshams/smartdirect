import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIVE_AUTOMATION_TYPE, LiveRuleValidationError, parseLiveRule } from "@/lib/live-replies/config";
import { validateLiveRuleReferences } from "@/lib/live-replies/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function ownedRule(id: string, userId: string) {
  return prisma.savedAutomationResponse.findFirst({
    where: { id, userId, messageType: LIVE_AUTOMATION_TYPE,
      instagramAccount: { userId, isConnected: true } },
  });
}
export async function GET(_request: NextRequest, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
  const { id } = await params;
  const item = await ownedRule(id, session.user.id);
  if (!item) return NextResponse.json({ success: false, error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
  return NextResponse.json({ success: true, data: {
    id: item.id, instagramAccountId: item.instagramAccountId,
    updatedAt: item.updatedAt.toISOString(), config: item.quickReplies,
  } });
}
export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const existing = await ownedRule(id, session.user.id);
    if (!existing) return NextResponse.json({ success: false, error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
    const body = await request.json();
    const version = typeof body?.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : null;
    if (!version || !Number.isFinite(version.getTime()) || version.getTime() !== existing.updatedAt.getTime())
      return NextResponse.json({ success: false, error: "اطلاعات پاسخ تغییر کرده است. صفحه را مجدداً باز کنید." }, { status: 409 });
    const rule = parseLiveRule(body?.config);
    await validateLiveRuleReferences(rule, existing.instagramAccountId, session.user.id);
    const updated = await prisma.savedAutomationResponse.updateMany({
      where: { id, instagramAccountId: existing.instagramAccountId, userId: session.user.id,
        messageType: LIVE_AUTOMATION_TYPE, updatedAt: version },
      data: { title: rule.keywords.join("، ").slice(0, 80),
        text: rule.initialText, quickReplies: { ...rule } },
    });
    if (!updated.count) return NextResponse.json({ success: false, error: "ویرایش هم‌زمان شناسایی شد. دوباره صفحه را باز کنید." }, { status: 409 });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof LiveRuleValidationError)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error("PUT /api/live-automations/[id]:", error);
    return NextResponse.json({ success: false, error: "ذخیره تغییرات لایو ناموفق بود." }, { status: 500 });
  }
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
  const { id } = await params;
  const result = await prisma.savedAutomationResponse.deleteMany({
    where: { id, userId: session.user.id, messageType: LIVE_AUTOMATION_TYPE,
      instagramAccount: { userId: session.user.id } },
  });
  if (!result.count) return NextResponse.json({ success: false, error: "پاسخ خودکار لایو پیدا نشد." }, { status: 404 });
  return NextResponse.json({ success: true });
}
