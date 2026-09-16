import { AutomationMessageType } from "@/generated/prisma/client";
import { createPublicFormToken } from "@/lib/forms/public-form-token";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { prisma } from "@/lib/prisma";

const INSTAGRAM_API_VERSION = "v26.0";
const MAX_API_RETRIES = 2;
const MAX_QUICK_REPLIES = 13;
const MAX_QUICK_REPLY_TITLE_LENGTH = 20;
const MAX_SHOWCASE_ITEMS = 10;

type QuickReplyPayload = { id: string; title: string; payload: string };

export type AutomationMessagePayload = {
  instagramAccountId: string;
  recipientId: string;
  instagramUserId: string;
  message: {
    id: string;
    messageType: AutomationMessageType;
    text: string | null;
    mediaUrl: string | null;
    mediaId: string | null;
    showcaseId?: string | null;
    formId?: string | null;
    quickReplies?: QuickReplyPayload[];
  };
};

export type SendAutomationMessageResult = {
  success: boolean;
  igMessageId?: string;
  recipientId?: string;
  error?: string;
  response?: unknown;
  conversationText?: string | null;
  formUrl?: string;
};

type InstagramApiResponse = {
  recipient_id?: string;
  message_id?: string;
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

function sleep(ms: number) { return new Promise<void>((resolve) => setTimeout(resolve, ms)); }

function formatQuickReplies(quickReplies: QuickReplyPayload[]) {
  if (quickReplies.length > MAX_QUICK_REPLIES) throw new Error(`حداکثر ${MAX_QUICK_REPLIES} جواب مجاز است.`);
  return quickReplies.map((item) => {
    const title = item.title.trim().slice(0, MAX_QUICK_REPLY_TITLE_LENGTH);
    if (!title) throw new Error("عنوان جواب نمی‌تواند خالی باشد.");
    if (!item.payload) throw new Error("Payload جواب نمی‌تواند خالی باشد.");
    return { content_type: "text", title, payload: item.payload };
  });
}

function getPublicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "")}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  throw new Error("Public application URL is missing.");
}

async function callInstagramMessagesApi({ instagramUserId, accessToken, body }: { instagramUserId: string; accessToken: string; body: Record<string, unknown> }): Promise<SendAutomationMessageResult> {
  const url = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${instagramUserId}/messages`;
  for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const responseText = await response.text();
      let data: InstagramApiResponse | string;
      try { data = JSON.parse(responseText); } catch { data = responseText; }
      if (response.ok) {
        const result = data as InstagramApiResponse;
        return { success: true, igMessageId: result.message_id, recipientId: result.recipient_id, response: data };
      }
      const errorData = data as InstagramApiResponse;
      const error = errorData?.error?.message || `Instagram API returned HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500) return { success: false, error, response: data };
      if (attempt < MAX_API_RETRIES) { await sleep(attempt * 1000); continue; }
      return { success: false, error, response: data };
    } catch (error) {
      if (attempt < MAX_API_RETRIES) { await sleep(attempt * 1000); continue; }
      return { success: false, error: error instanceof Error ? error.message : "Instagram API request failed" };
    }
  }
  return { success: false, error: "Instagram API request failed" };
}

async function sendTextLike({ instagramUserId, recipientId, accessToken, text, quickReplies }: { instagramUserId: string; recipientId: string; accessToken: string; text: string; quickReplies?: QuickReplyPayload[] }) {
  if (!text.trim()) throw new Error("متن پیام نمی‌تواند خالی باشد.");
  const message: Record<string, unknown> = { text: text.trim() };
  if (quickReplies?.length) message.quick_replies = formatQuickReplies(quickReplies);
  return callInstagramMessagesApi({ instagramUserId, accessToken, body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message } });
}

async function sendShowcase({ instagramAccountId, instagramUserId, recipientId, accessToken, showcaseId }: { instagramAccountId: string; instagramUserId: string; recipientId: string; accessToken: string; showcaseId: string }) {
  const showcase = await prisma.showcase.findFirst({ where: { id: showcaseId, instagramAccountId, isActive: true }, include: { items: { where: { isActive: true }, orderBy: { order: "asc" }, take: MAX_SHOWCASE_ITEMS } } });
  if (!showcase) throw new Error("Showcase not found or inactive");
  if (!showcase.items.length) throw new Error("Showcase has no active items");
  const elements = showcase.items.map((item) => ({
    title: item.title.trim(),
    ...(item.description?.trim() ? { subtitle: item.description.trim() } : {}),
    ...(item.imageUrl?.trim() ? { image_url: item.imageUrl.trim() } : {}),
  }));
  const result = await callInstagramMessagesApi({
    instagramUserId,
    accessToken,
    body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { attachment: { type: "template", payload: { template_type: "generic", elements } } } },
  });
  if (result.success) result.conversationText = showcase.title.trim();
  return result;
}

async function sendLegacyForm({ instagramAccountId, instagramUserId, recipientId, accessToken, formId }: { instagramAccountId: string; instagramUserId: string; recipientId: string; accessToken: string; formId: string }) {
  const form = await prisma.form.findFirst({ where: { id: formId, instagramAccountId, isActive: true }, include: { fields: { orderBy: { order: "asc" } } } });
  if (!form || !form.fields.length) throw new Error("Form not found or has no fields");
  const token = await createPublicFormToken({ formId: form.id, instagramAccountId, instagramUserId, recipientId });
  const formUrl = `${getPublicAppUrl()}/form/${encodeURIComponent(token)}`;
  const result = await callInstagramMessagesApi({
    instagramUserId,
    accessToken,
    body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { attachment: { type: "template", payload: { template_type: "generic", elements: [{ title: form.title.trim(), subtitle: (form.description?.trim() || "برای تکمیل فرم روی دکمه زیر بزنید.").slice(0, 640), buttons: [{ type: "web_url", url: formUrl, title: "تکمیل فرم" }] }] } } } },
  });
  if (result.success) { result.formUrl = formUrl; result.conversationText = form.title.trim(); }
  return result;
}

export async function sendAutomationMessage(payload: AutomationMessagePayload): Promise<SendAutomationMessageResult> {
  const { instagramAccountId, recipientId, instagramUserId, message } = payload;
  if (!instagramAccountId || !recipientId || !instagramUserId) throw new Error("Instagram message identifiers are missing");
  const accessToken = await getValidInstagramAccessToken(instagramAccountId);

  if (message.messageType === "TEXT") {
    const result = await sendTextLike({ instagramUserId, recipientId, accessToken, text: message.text || "", quickReplies: message.quickReplies });
    if (result.success) result.conversationText = message.text?.trim() || null;
    return result;
  }

  if (message.messageType === "FORM") {
    if (message.formId) return sendLegacyForm({ instagramAccountId, instagramUserId, recipientId, accessToken, formId: message.formId });
    const result = await sendTextLike({ instagramUserId, recipientId, accessToken, text: message.text || "", quickReplies: message.quickReplies });
    if (result.success) result.conversationText = message.text?.trim() || null;
    return result;
  }

  if (message.messageType === "SHOWCASE") {
    if (!message.showcaseId) throw new Error("Showcase ID is missing");
    return sendShowcase({ instagramAccountId, instagramUserId, recipientId, accessToken, showcaseId: message.showcaseId });
  }

  if (message.messageType === "IMAGE" || message.messageType === "VIDEO" || message.messageType === "AUDIO") {
    if (!message.mediaUrl && !message.mediaId) throw new Error(`${message.messageType} requires mediaUrl or mediaId`);
    const type = message.messageType.toLowerCase();
    const attachmentPayload = message.mediaId ? { attachment_id: message.mediaId } : { url: message.mediaUrl };
    const result = await callInstagramMessagesApi({ instagramUserId, accessToken, body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { attachment: { type, payload: attachmentPayload } } } });
    if (result.success) result.conversationText = message.messageType;
    return result;
  }

  throw new Error(`Unsupported automation message type: ${message.messageType}`);
}
