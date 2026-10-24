import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nestedReplyUses } from "@/lib/automation/nested-response-usage";
import { getStorageProviderForObject } from "@/lib/storage/provider";
import { collectSavedResponseMedia } from "@/lib/automation/saved-response-media";

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
    // Embed owned asset previews without changing the reusable template record.
    const showcaseIds = data.map((item) => item.showcaseId).filter((id): id is string => Boolean(id));
    const formIds = data.map((item) => item.formId).filter((id): id is string => Boolean(id));
    const [showcases, forms] = await Promise.all([
      showcaseIds.length ? prisma.showcase.findMany({
        where: { id: { in: showcaseIds }, userId: session.user.id, instagramAccountId },
        include: { items: { where: { isActive: true }, orderBy: { order: "asc" } } },
      }) : Promise.resolve([]),
      formIds.length ? prisma.form.findMany({
        where: { id: { in: formIds }, userId: session.user.id, instagramAccountId },
        include: { fields: { orderBy: { order: "asc" } } },
      }) : Promise.resolve([]),
    ]);
    // Only explicit provenance counts as reuse; equal-looking text is not a link.
    const sourceIds = data.map((item) => item.id);
    const appliedMessages = sourceIds.length ? await prisma.automationMessage.findMany({
      where: { savedResponseId: { in: sourceIds }, automation: { instagramAccountId } },
      select: {
        id: true, savedResponseId: true, updatedAt: true,
        automation: { select: {
          id: true, title: true, triggerType: true, mediaId: true, mediaIds: true, updatedAt: true,
          persistentMenuItems: { select: { id: true, title: true } },
          iceBreakers: { select: { id: true, question: true } },
        } },
      },
    }) : [];
    const usageMap = new Map<string, Array<{
      messageId: string; automationId: string; automationTitle: string | null;
      messageUpdatedAt: string; automationUpdatedAt: string;
      quickReplyId?: string; nodePath?: Array<string | number>; branchTitle?: string;
      triggerType: string; mediaIds: string[]; menuTitles: string[]; icebreakerQuestions: string[];
    }>>();
    for (const linked of appliedMessages) {
      if (!linked.savedResponseId) continue;
      const a = linked.automation;
      const mediaIds = Array.from(new Set([
        ...(a.mediaId ? [a.mediaId] : []),
        ...(a.mediaIds || "").split(",").map((id) => id.trim()).filter(Boolean),
      ]));
      const previous = usageMap.get(linked.savedResponseId) || [];
      previous.push({
        messageId: linked.id, automationId: a.id, automationTitle: a.title,
        messageUpdatedAt: linked.updatedAt.toISOString(), automationUpdatedAt: a.updatedAt.toISOString(),
        triggerType: a.triggerType, mediaIds,
        menuTitles: a.persistentMenuItems.map((item) => item.title),
        icebreakerQuestions: a.iceBreakers.map((item) => item.question),
      });
      usageMap.set(linked.savedResponseId, previous);
    }
    // Find explicit links in legacy QuickReply JSON (including deeper branches).
    // Malformed historical JSON is skipped, never guessed from matching text.
    if (sourceIds.length) {
      const roots = await prisma.quickReply.findMany({
        where: {
          replyText: { contains: "savedResponseId" },
          automationMessage: { automation: { instagramAccountId } },
        },
        select: {
          id: true, title: true, replyText: true, updatedAt: true,
          automationMessage: { select: {
            automation: { select: {
              id: true, title: true, triggerType: true, mediaId: true, mediaIds: true, updatedAt: true,
              persistentMenuItems: { select: { title: true } },
              iceBreakers: { select: { question: true } },
            } },
          } },
        },
      });
      const known = new Set(sourceIds);
      for (const root of roots) {
        const a = root.automationMessage.automation;
        const mediaIds = Array.from(new Set([
          ...(a.mediaId ? [a.mediaId] : []),
          ...(a.mediaIds || "").split(",").map((id) => id.trim()).filter(Boolean),
        ]));
        for (const use of nestedReplyUses(root.replyText)) {
          if (!known.has(use.savedResponseId)) continue;
          const previous = usageMap.get(use.savedResponseId) || [];
          previous.push({
            messageId: "qr:" + root.id + ":" + (use.path.length ? use.path.join(".") : "root"),
            quickReplyId: root.id, nodePath: use.path, branchTitle: use.label,
            automationId: a.id, automationTitle: a.title,
            messageUpdatedAt: root.updatedAt.toISOString(),
            automationUpdatedAt: a.updatedAt.toISOString(),
            triggerType: a.triggerType, mediaIds,
            menuTitles: a.persistentMenuItems.map((entry) => entry.title),
            icebreakerQuestions: a.iceBreakers.map((entry) => entry.question),
          });
          usageMap.set(use.savedResponseId, previous);
        }
      }
    }
    const showcaseMap = new Map(showcases.map((item) => [item.id, item]));
    const formMap = new Map(forms.map((item) => [item.id, item]));
    return NextResponse.json({ success: true, data: data.map((item) => ({
      ...item,
      usages: usageMap.get(item.id) || [],
      showcase: item.showcaseId ? showcaseMap.get(item.showcaseId) || null : null,
      form: item.formId ? formMap.get(item.formId) || null : null,
    })) });
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
    // Every saved image/audio/video (including nested form replies) needs a
    // retrievable original. Meta attachment IDs are not permanent backups.
    const quickReplies = Array.isArray(body?.quickReplies) ? body.quickReplies : [];
    let mediaReferences: ReturnType<typeof collectSavedResponseMedia>;
    try {
      mediaReferences = collectSavedResponseMedia({ messageType, mediaUrl, quickReplies });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "ساختار پاسخ معتبر نیست." }, { status: 400 });
    }
    if (mediaReferences.missingOriginal) {
      return NextResponse.json({
        success: false,
        error: "برای ذخیره دائمی عکس یا وویس، فایل اصلی را آپلود کنید؛ شناسه متا به‌تنهایی کافی نیست.",
      }, { status: 400 });
    }
    for (const publicUrl of mediaReferences.urls) {
      const original = await prisma.instagramStorageObject.findFirst({
        where: { userId: session.user.id, publicUrl, deletedAt: null },
        select: { storageKey: true, publicUrl: true },
      });
      if (!original) {
        return NextResponse.json({
          success: false,
          error: "نسخه اصلی یکی از فایل‌های پاسخ در فضای ذخیره‌سازی شما پیدا نشد. فایل را دوباره آپلود کنید.",
        }, { status: 400 });
      }
      // An expired Meta media URL or a stale database record is not an original.
      const provider = getStorageProviderForObject(original.storageKey, original.publicUrl);
      if (!await provider.exists(original.storageKey)) {
        return NextResponse.json({
          success: false,
          error: "فایل اصلی دیگر در فضای ذخیره‌سازی موجود نیست. لطفاً آن را دوباره آپلود کنید.",
        }, { status: 400 });
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
