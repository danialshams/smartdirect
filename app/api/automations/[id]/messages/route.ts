import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const validMessageTypes = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"] as const;
type MessageType = (typeof validMessageTypes)[number];
function isValidMessageType(value: unknown): value is MessageType { return typeof value === "string" && validMessageTypes.includes(value as MessageType); }
function normalizeOptionalString(value: unknown): string | null { if (typeof value !== "string") return null; const trimmed = value.trim(); return trimmed || null; }
async function getOwnedAutomation(automationId: string, userId: string) { return prisma.automation.findFirst({ where: { id: automationId, instagramAccount: { userId } } }); }
async function getMessageInclude() { return { quickReplies: { orderBy: { createdAt: "asc" as const }, include: { nextMessage: { select: { id: true, messageType: true, text: true, mediaUrl: true, mediaId: true, showcaseId: true, formId: true, order: true } } } }, showcase: { include: { items: { where: { isActive: true }, orderBy: { order: "asc" as const } } } }, form: { include: { fields: { orderBy: { order: "asc" as const } } } } }; }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });
    const { id } = await params;
    if (!await getOwnedAutomation(id, session.user.id)) return NextResponse.json({ success: false, error: "Automation پیدا نشد" }, { status: 404 });
    const messages = await prisma.automationMessage.findMany({ where: { automationId: id }, orderBy: { order: "asc" }, include: await getMessageInclude() });
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error("GET /api/automations/[id]/messages error:", error);
    return NextResponse.json({ success: false, error: "خطا در دریافت پیام‌ها" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "احراز هویت انجام نشده است" }, { status: 401 });
    const { id } = await params;
    const automation = await getOwnedAutomation(id, session.user.id);
    if (!automation) return NextResponse.json({ success: false, error: "Automation پیدا نشد" }, { status: 404 });
    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "اطلاعات پیام نامعتبر است" }, { status: 400 });
    const { messageType = "TEXT", text, mediaUrl, mediaId, showcaseId, formId, order } = body;
    if (!isValidMessageType(messageType)) return NextResponse.json({ success: false, error: "نوع پیام نامعتبر است" }, { status: 400 });
    const normalizedText = normalizeOptionalString(text);
    const normalizedMediaUrl = normalizeOptionalString(mediaUrl);
    const normalizedMediaId = normalizeOptionalString(mediaId);
    if ((messageType === "TEXT" || messageType === "FORM") && !normalizedText) return NextResponse.json({ success: false, error: messageType === "FORM" ? "برای فرم، متن سوال الزامی است" : "برای پیام متنی، text الزامی است" }, { status: 400 });
    if (["IMAGE", "VIDEO", "AUDIO"].includes(messageType) && !normalizedMediaUrl && !normalizedMediaId) return NextResponse.json({ success: false, error: "برای پیام رسانه‌ای باید mediaUrl یا mediaId ارسال شود" }, { status: 400 });

    let normalizedShowcaseId: string | null = null;
    if (messageType === "SHOWCASE") {
      normalizedShowcaseId = normalizeOptionalString(showcaseId);
      if (!normalizedShowcaseId) return NextResponse.json({ success: false, error: "برای پیام SHOWCASE، showcaseId الزامی است" }, { status: 400 });
      const showcase = await prisma.showcase.findFirst({ where: { id: normalizedShowcaseId, userId: session.user.id, instagramAccountId: automation.instagramAccountId } });
      if (!showcase) return NextResponse.json({ success: false, error: "ویترین پیدا نشد یا متعلق به این اکانت نیست" }, { status: 404 });
    }

    let normalizedFormId: string | null = null;
    if (messageType === "FORM") {
      normalizedFormId = normalizeOptionalString(formId);
      if (normalizedFormId) {
        const form = await prisma.form.findFirst({ where: { id: normalizedFormId, userId: session.user.id, instagramAccountId: automation.instagramAccountId } });
        if (!form) return NextResponse.json({ success: false, error: "فرم پیدا نشد یا متعلق به این اکانت نیست" }, { status: 404 });
      }
    }

    let messageOrder: number;
    if (typeof order === "number" && Number.isInteger(order) && order >= 0) messageOrder = order;
    else {
      const lastMessage = await prisma.automationMessage.findFirst({ where: { automationId: id }, orderBy: { order: "desc" } });
      messageOrder = lastMessage ? lastMessage.order + 1 : 0;
    }

    const message = await prisma.automationMessage.create({
      data: {
        automationId: id,
        messageType,
        text: normalizedText,
        mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(messageType) ? normalizedMediaUrl : null,
        mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(messageType) ? normalizedMediaId : null,
        showcaseId: messageType === "SHOWCASE" ? normalizedShowcaseId : null,
        formId: messageType === "FORM" ? normalizedFormId : null,
        order: messageOrder,
      },
      include: await getMessageInclude(),
    });
    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/automations/[id]/messages error:", error);
    return NextResponse.json({ success: false, error: "خطا در ساخت پیام" }, { status: 500 });
  }
}
