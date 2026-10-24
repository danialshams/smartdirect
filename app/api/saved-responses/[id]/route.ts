import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectSavedResponseMedia } from "@/lib/automation/saved-response-media";
import { getStorageProviderForObject } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const { id } = await params;
    const saved = await prisma.savedAutomationResponse.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!saved) {
      return NextResponse.json({ success: false, error: "پاسخ ذخیره‌شده پیدا نشد." }, { status: 404 });
    }

    await prisma.savedAutomationResponse.delete({ where: { id: saved.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/saved-responses/[id] error:", error);
    return NextResponse.json({ success: false, error: "حذف پاسخ ذخیره‌شده ناموفق بود." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    const { id } = await params;
    const current = await prisma.savedAutomationResponse.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!current) return NextResponse.json({ success: false, error: "پاسخ ذخیره‌شده پیدا نشد." }, { status: 404 });
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "اطلاعات پاسخ معتبر نیست." }, { status: 400 });
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const type = typeof body.messageType === "string" ? body.messageType : "";
    const allowed = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];
    const clean = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
    const responseText = clean(body.text);
    const mediaUrl = clean(body.mediaUrl);
    const mediaId = clean(body.mediaId);
    const showcaseId = clean(body.showcaseId);
    const formId = clean(body.formId);
    const quickReplies = Array.isArray(body.quickReplies) ? body.quickReplies : [];
    const expected = typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : new Date(NaN);
    if (!Number.isFinite(expected.getTime()) || current.updatedAt.getTime() !== expected.getTime())
      return NextResponse.json({ success: false, error: "این پاسخ تغییر کرده است. فهرست پاسخ‌ها را تازه‌سازی کن." }, { status: 409 });
    if (!title || title.length > 80 || !allowed.includes(type))
      return NextResponse.json({ success: false, error: "نام یا نوع پاسخ معتبر نیست." }, { status: 400 });
    if ((type === "TEXT" || type === "FORM") && (!responseText || responseText.length > 2000))
      return NextResponse.json({ success: false, error: "متن پاسخ باید بین ۱ تا ۲۰۰۰ نویسه باشد." }, { status: 400 });
    if (type === "SHOWCASE") {
      const showcase = await prisma.showcase.findFirst({
        where: { id: showcaseId || "", userId: session.user.id, instagramAccountId: current.instagramAccountId }, select: { id: true },
      });
      if (!showcase) return NextResponse.json({ success: false, error: "ویترین در این پیج پیدا نشد." }, { status: 400 });
    }
    if (type === "FORM" && formId && !await prisma.form.findFirst({
      where: { id: formId, userId: session.user.id, instagramAccountId: current.instagramAccountId }, select: { id: true },
    })) return NextResponse.json({ success: false, error: "فرم در این پیج پیدا نشد." }, { status: 400 });

    const refs = collectSavedResponseMedia({ messageType: type, mediaUrl, quickReplies });
    if (refs.missingOriginal) return NextResponse.json({ success: false, error: "برای نگهداری پاسخ رسانه‌ای، فایل اصلی را آپلود کن." }, { status: 400 });
    for (const publicUrl of refs.urls) {
      const stored = await prisma.instagramStorageObject.findFirst({
        where: { userId: session.user.id, publicUrl, deletedAt: null },
        select: { storageKey: true, publicUrl: true },
      });
      if (!stored || !await getStorageProviderForObject(stored.storageKey, stored.publicUrl).exists(stored.storageKey))
        return NextResponse.json({ success: false, error: "فایل اصلی پاسخ در فضای ذخیره‌سازی موجود نیست." }, { status: 400 });
    }
    const result = await prisma.savedAutomationResponse.updateMany({
      where: { id: current.id, userId: session.user.id, updatedAt: expected },
      data: {
        title, messageType: type, text: responseText, mediaUrl, mediaId,
        showcaseId: type === "SHOWCASE" ? showcaseId : null,
        formId: type === "FORM" ? formId : null, quickReplies,
      },
    });
    if (result.count !== 1) return NextResponse.json({ success: false, error: "پاسخ هم‌زمان تغییر کرد؛ دوباره تلاش کن." }, { status: 409 });
    const updated = await prisma.savedAutomationResponse.findUnique({ where: { id: current.id } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/saved-responses/[id] error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "ویرایش پاسخ ناموفق بود." }, { status: 500 });
  }
}
