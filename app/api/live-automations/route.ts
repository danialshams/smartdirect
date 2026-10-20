import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { instagramApiRequest } from "@/lib/instagram/client";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { defaultLiveMessage, LIVE_AUTOMATION_TYPE, LiveRuleValidationError, parseLiveRule, type LiveReplyOption, type LiveRule } from "@/lib/live-replies/config";

export const dynamic = "force-dynamic";

const s = (value: unknown) => typeof value === "string" ? value.trim() : "";
async function getOwnedAccount(id: string, userId: string) {
  return prisma.instagramAccount.findFirst({
    where: { id, userId, isConnected: true },
    select: { id: true, igUserId: true, userId: true },
  });
}
function findReferences(rule: LiveRule) {
  const showcases = new Set<string>();
  const forms = new Set<string>();
  const media = new Set<string>();
  const walk = (items: LiveReplyOption[]) => {
    for (const o of items) {
      if (o.destinationType === "SHOWCASE") showcases.add(o.destinationShowcaseId);
      if (o.destinationType === "FORM" && o.destinationFormId) forms.add(o.destinationFormId);
      if (o.destinationMediaUrl) media.add(o.destinationMediaUrl);
      walk(o.destinationQuickReplies);
    }
  };
  if (rule.mode === "FOLLOW_UP") {
    const r = rule.response;
    if (r.messageType === "SHOWCASE") showcases.add(r.showcaseId);
    if (r.messageType === "FORM" && r.formId) forms.add(r.formId);
    if (r.mediaUrl) media.add(r.mediaUrl);
    walk(r.quickReplies);
  }
  return { showcases, forms, media };
}
async function validateLiveRuleReferences(rule: LiveRule, accountId: string, userId: string) {
  const { showcases, forms, media } = findReferences(rule);
  if (showcases.size) {
    const count = await prisma.showcase.count({
      where: { id: { in: [...showcases] }, instagramAccountId: accountId, userId, isActive: true },
    });
    if (count !== showcases.size) throw new LiveRuleValidationError("یکی از ویترین‌ها متعلق به این پیج نیست.");
  }
  if (forms.size) {
    const count = await prisma.form.count({
      where: { id: { in: [...forms] }, instagramAccountId: accountId, userId, isActive: true },
    });
    if (count !== forms.size) throw new LiveRuleValidationError("یکی از فرم‌ها متعلق به این پیج نیست.");
  }
  if (media.size) {
    const urls = [...media];
    const [storage, usedMedia, showcaseItems] = await Promise.all([
      prisma.instagramStorageObject.findMany({
        where: { userId, publicUrl: { in: urls }, deletedAt: null }, select: { publicUrl: true },
      }),
      prisma.automationMessage.findMany({
        where: { mediaUrl: { in: urls }, automation: { instagramAccountId: accountId, instagramAccount: { userId } } },
        select: { mediaUrl: true },
      }),
      prisma.showcaseItem.findMany({
        where: { imageUrl: { in: urls }, showcase: { userId, instagramAccountId: accountId } },
        select: { imageUrl: true },
      }),
    ]);
    const owned = new Set([...storage.map((x) => x.publicUrl), ...usedMedia.map((x) => x.mediaUrl), ...showcaseItems.map((x) => x.imageUrl)]);
    if (urls.some((url) => !owned.has(url))) throw new LiveRuleValidationError("یکی از فایل‌های پاسخ متعلق به این پیج نیست.");
  }
}
async function ensureLiveSubscription(account: { id: string; igUserId: string }) {
  const token = await getValidInstagramAccessToken(account.id);
  // Keep already subscribed fields intact. Other comment, DM and seen
  // automations depend on these subscriptions too.
  const data = await instagramApiRequest<{
    data?: Array<{ subscribed_fields?: string[] }>;
  }>("/" + account.igUserId + "/subscribed_apps", {
    accessToken: token, method: "GET",
  });
  const fields = new Set(
    (data.data || []).flatMap((item) => Array.isArray(item.subscribed_fields) ? item.subscribed_fields : []),
  );
  if (fields.has("live_comments")) return;
  if (!fields.size) {
    ["comments", "messages", "messaging_postbacks", "messaging_seen"].forEach((field) => fields.add(field));
  }
  fields.add("live_comments");
  await instagramApiRequest("/" + account.igUserId + "/subscribed_apps", {
    accessToken: token, method: "POST", maxRetries: 0,
    body: new URLSearchParams({ subscribed_fields: [...fields].join(",") }),
  });
}
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
  const accountId = s(request.nextUrl.searchParams.get("instagramAccountId"));
  if (!accountId || !await getOwnedAccount(accountId, session.user.id))
    return NextResponse.json({ success: false, error: "پیج اینستاگرام پیدا نشد." }, { status: 404 });
  const items = await prisma.savedAutomationResponse.findMany({
    where: { instagramAccountId: accountId, userId: session.user.id, messageType: LIVE_AUTOMATION_TYPE },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: items.map((item) => ({
    id: item.id, updatedAt: item.updatedAt.toISOString(),
    config: item.quickReplies || { ...defaultLiveMessage() },
  })) });
}
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const body = await request.json();
    const account = await getOwnedAccount(s(body?.instagramAccountId), session.user.id);
    if (!account) return NextResponse.json({ success: false, error: "پیج اینستاگرام متصل نیست." }, { status: 404 });
    const rule = parseLiveRule(body?.config);
    await validateLiveRuleReferences(rule, account.id, session.user.id);
    const existing = await prisma.savedAutomationResponse.findMany({
      where: { userId: session.user.id, instagramAccountId: account.id, messageType: LIVE_AUTOMATION_TYPE },
      select: { quickReplies: true },
    });
    if (existing.some((item) => {
      try {
        const previous = parseLiveRule(item.quickReplies);
        return previous.matchMode === rule.matchMode && previous.keywords.join(",") === rule.keywords.join(",");
      } catch { return false; }
    })) throw new LiveRuleValidationError("این کلمات کلیدی قبلاً برای لایو ثبت شده‌اند.");
    try { await ensureLiveSubscription(account); }
    catch (error) {
      console.error("LIVE_WEBHOOK_SUBSCRIPTION_FAILED", error);
      return NextResponse.json({ success: false, error: "فعال‌سازی وبهوک live_comments در Meta ناموفق بود. دسترسی Manage Comments و اشتراک live_comments را در Meta App بررسی کنید." }, { status: 502 });
    }
    const created = await prisma.savedAutomationResponse.create({
      data: { instagramAccountId: account.id, userId: session.user.id,
        messageType: LIVE_AUTOMATION_TYPE, title: rule.keywords.join("، ").slice(0, 80),
        text: rule.initialText, quickReplies: { ...rule } },
    });
    return NextResponse.json({ success: true, data: { id: created.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof LiveRuleValidationError)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error("POST /api/live-automations:", error);
    return NextResponse.json({ success: false, error: "ساخت پاسخ خودکار لایو ناموفق بود." }, { status: 500 });
  }
}
