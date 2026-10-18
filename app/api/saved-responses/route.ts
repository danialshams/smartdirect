import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const messageTypes = new Set(["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"]);

function optionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

async function ownedAccount(instagramAccountId: string, userId: string) {
  return prisma.instagramAccount.findFirst({
    where: { id: instagramAccountId, userId },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const instagramAccountId = request.nextUrl.searchParams.get("instagramAccountId")?.trim();
    if (!instagramAccountId) {
      return NextResponse.json({ success: false, error: "اکانت اینستاگرام الزامی است." }, { status: 400 });
    }
    if (!await ownedAccount(instagramAccountId, session.user.id)) {
      return NextResponse.json({ success: false, error: "اکانت اینستاگرام پیدا نشد." }, { status: 404 });
    }

    const data = await prisma.savedAutomationResponse.findMany({
      where: { userId: session.user.id, instagramAccountId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/saved-responses error:", error);
    return NextResponse.json({ success: false, error: "دریافت پاسخ‌های ذخیره‌شده ناموفق بود." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const body = await request.json();
    const instagramAccountId = optionalString(body?.instagramAccountId);
    const title = optionalString(body?.title);
    const messageType = optionalString(body?.messageType);
    const text = optionalString(body?.text);
    const mediaUrl = optionalString(body?.mediaUrl);
    const mediaId = optionalString(body?.mediaId);
    const showcaseId = optionalString(body?.showcaseId);
    const formId = optionalString(body?.formId);

    if (!instagramAccountId || !await ownedAccount(instagramAccountId, session.user.id)) {
      return NextResponse.json({ success: false, error: "اکانت اینستاگرام پیدا نشد." }, { status: 404 });
    }
    if (!title || title.length > 80) {
      return NextResponse.json({ success: false, error: "عنوان باید بین ۱ تا ۸۰ نویسه باشد." }, { status: 400 });
    }
    if (!messageType || !messageTypes.has(messageType)) {
      return NextResponse.json({ success: false, error: "نوع پاسخ معتبر نیست." }, { status: 400 });
    }
    if ((messageType === "TEXT" || messageType === "FORM") && !text) {
      return NextResponse.json({ success: false, error: "متن پاسخ الزامی است." }, { status: 400 });
    }
    if (["IMAGE", "VIDEO", "AUDIO"].includes(messageType) && !mediaUrl && !mediaId) {
      return NextResponse.json({ success: false, error: "فایل رسانه‌ای پاسخ مشخص نشده است." }, { status: 400 });
    }

    if (mediaUrl) {
      const [storageObject, existingMessage, showcaseItem] = await Promise.all([
        prisma.instagramStorageObject.findFirst({
          where: { userId: session.user.id, publicUrl: mediaUrl, deletedAt: null },
          select: { id: true },
        }),
        prisma.automationMessage.findFirst({
          where: {
            mediaUrl,
            automation: { instagramAccountId, instagramAccount: { userId: session.user.id } },
          },
          select: { id: true },
        }),
        prisma.showcaseItem.findFirst({
          where: { imageUrl: mediaUrl, showcase: { userId: session.user.id, instagramAccountId } },
          select: { id: true },
        }),
      ]);
      if (!storageObject && !existingMessage && !showcaseItem) {
        return NextResponse.json({ success: false, error: "فایل پیدا نشد یا متعلق به این اکانت نیست. فایل را دوباره آپلود کنید." }, { status: 400 });
      }
    }

    if (messageType === "SHOWCASE") {
      const showcase = showcaseId
        ? await prisma.showcase.findFirst({ where: { id: showcaseId, userId: session.user.id, instagramAccountId }, select: { id: true } })
        : null;
      if (!showcase) return NextResponse.json({ success: false, error: "ویترین انتخاب‌شده پیدا نشد." }, { status: 400 });
    }

    if (messageType === "FORM" && formId) {
      const form = await prisma.form.findFirst({
        where: { id: formId, userId: session.user.id, instagramAccountId },
        select: { id: true },
      });
      if (!form) return NextResponse.json({ success: false, error: "فرم انتخاب‌شده پیدا نشد." }, { status: 400 });
    }

    const quickReplies = Array.isArray(body?.quickReplies) ? body.quickReplies : [];
    const saved = await prisma.savedAutomationResponse.create({
      data: {
        userId: session.user.id,
        instagramAccountId,
        title,
        messageType,
        text,
        mediaUrl,
        mediaId,
        showcaseId: messageType === "SHOWCASE" ? showcaseId : null,
        formId: messageType === "FORM" ? formId : null,
        quickReplies,
      },
    });

    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error("POST /api/saved-responses error:", error);
    return NextResponse.json({ success: false, error: "ذخیره پاسخ ناموفق بود." }, { status: 500 });
  }
}
