import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const MESSAGE_TYPES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"] as const;
type MessageType = (typeof MESSAGE_TYPES)[number];
const DESTINATION_TYPES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"] as const;
type DestinationType = (typeof DESTINATION_TYPES)[number];
const cleaned = (value: unknown) => typeof value === "string" ? value.trim() : "";

function normalizeDestinationTree(nodes: unknown[], path: string, seen: Set<string>): unknown[] {
  if (nodes.length > 13) throw Error(path + " حداکثر ۱۳ گزینه می‌تواند داشته باشد.");
  return nodes.map((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) throw Error(path + " نامعتبر است.");
    const item = node as Record<string, unknown>;
    const title = cleaned(item.title);
    const payload = cleaned(item.payload);
    const type = cleaned(item.destinationType ?? item.type) as DestinationType;
    if (!title || title.length > 20 || !payload || payload.length > 1000)
      throw Error(path + ": عنوان یا شناسه گزینه " + (index + 1) + " نامعتبر است.");
    if (seen.has(payload)) throw Error("شناسهٔ گزینهٔ تکراری در پاسخ وجود دارد.");
    seen.add(payload);
    if (!DESTINATION_TYPES.includes(type)) throw Error("نوع مقصد گزینه نامعتبر است.");
    if (item.isExit === true && type !== "TEXT") throw Error("خروج از فرم فقط می‌تواند مقصد متنی داشته باشد.");
    const text = cleaned(item.destinationText ?? item.text);
    const question = cleaned(item.destinationQuestion ?? item.question);
    const children = Array.isArray(item.destinationQuickReplies)
      ? item.destinationQuickReplies : Array.isArray(item.quickReplies) ? item.quickReplies : [];
    if (type === "TEXT" && !text) throw Error("متن مقصد گزینه الزامی است.");
    if (type === "FORM" && (!question || !children.length)) throw Error("فرم مقصد باید سؤال و گزینه داشته باشد.");
    if (type === "SHOWCASE" && !cleaned(item.destinationShowcaseId)) throw Error("ویترین مقصد الزامی است.");
    if (["IMAGE", "AUDIO", "VIDEO"].includes(type) &&
      !cleaned(item.destinationMediaUrl) && !cleaned(item.destinationMediaId)) throw Error("فایل مقصد الزامی است.");
    return {
      title, payload, destinationType: type, isExit: item.isExit === true,
      destinationText: text || null,
      destinationFormId: cleaned(item.destinationFormId) || null,
      destinationShowcaseId: cleaned(item.destinationShowcaseId) || null,
      destinationMediaUrl: cleaned(item.destinationMediaUrl) || null,
      destinationMediaId: cleaned(item.destinationMediaId) || null,
      destinationQuestion: question || null, question: question || null,
      destinationQuickReplies: type === "FORM" ? normalizeDestinationTree(children, path + " - " + title, seen) : [],
    };
  });
}

export async function prepareAutomationMessages(
  submitted: unknown,
  instagramAccountId: string,
  userId: string,
): Promise<Prisma.AutomationMessageCreateWithoutAutomationInput[]> {
  if (!Array.isArray(submitted) || submitted.length > 20) throw Error("تعداد پیام‌های پاسخ معتبر نیست.");
  const forms = new Set<string>();
  const showcases = new Set<string>();
  const allPayloads = new Set<string>();
  const results: Prisma.AutomationMessageCreateWithoutAutomationInput[] = [];

  for (const [index, input] of submitted.entries()) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("پیام نامعتبر است.");
    const entry = input as Record<string, unknown>;
    const messageType = cleaned(entry.messageType || "TEXT") as MessageType;
    if (!MESSAGE_TYPES.includes(messageType)) throw Error("نوع پیام نامعتبر است.");
    if (messageType === "VIDEO") throw Error("ساخت پاسخ ویدیویی فعلاً غیرفعال است.");
    const text = cleaned(entry.text);
    const mediaUrl = cleaned(entry.mediaUrl);
    const mediaId = cleaned(entry.mediaId);
    const formId = cleaned(entry.formId);
    const showcaseId = cleaned(entry.showcaseId);
    if (["TEXT", "FORM"].includes(messageType) && !text)
      throw Error("متن پیام یا سؤال فرم الزامی است.");
    if (["IMAGE", "AUDIO"].includes(messageType) && !mediaUrl && !mediaId)
      throw Error("فایل پیام الزامی است.");
    if (messageType === "SHOWCASE" && !showcaseId) throw Error("ویترین الزامی است.");
    if (messageType === "SHOWCASE") showcases.add(showcaseId);
    if (messageType === "FORM" && formId) forms.add(formId);
    const linkButtons: Array<{url:string;title:string}> = [];
    const rawLinks = Array.isArray(entry.linkButtons) ? entry.linkButtons : [];
    if (rawLinks.length > 3 || (messageType !== "TEXT" && rawLinks.length))
      throw Error("دکمه لینک فقط برای پیام متنی و حداکثر ۳ عدد مجاز است.");
    for (const raw of rawLinks) {
      if (!raw || typeof raw !== "object") throw Error("دکمه لینک نامعتبر است.");
      const link = raw as Record<string, unknown>;
      const url = cleaned(link.url), title = cleaned(link.title);
      let valid = false;
      try { valid = ["http:", "https:"].includes(new URL(url).protocol); } catch { /* bad URL */ }
      if (!valid || url.length > 2048 || !title || title.length > 20) throw Error("عنوان یا آدرس دکمه لینک نامعتبر است.");
      linkButtons.push({url,title});
    }
    if (messageType === "TEXT" && text.length > (linkButtons.length ? 640 : 2000))
      throw Error("متن پاسخ از حداکثر طول مجاز بیشتر است.");

    const rawReplies = Array.isArray(entry.quickReplies) ? entry.quickReplies : [];
    const replies = normalizeDestinationTree(rawReplies, "گزینه پاسخ", allPayloads) as Array<Record<string, unknown>>;
    for (const node of replies) {
      // Nested destinations are serialized into replyText for backwards compatibility.
      const destination = { ...node };
      delete destination.title;
      delete destination.payload;
      if (node.destinationType === "FORM" && node.destinationFormId) forms.add(String(node.destinationFormId));
      if (node.destinationType === "SHOWCASE" && node.destinationShowcaseId) showcases.add(String(node.destinationShowcaseId));
    }
    results.push({
      messageType, order: index,
      text: text || null,
      mediaUrl: ["IMAGE", "AUDIO"].includes(messageType) ? (mediaUrl || null) : null,
      mediaId: ["IMAGE", "AUDIO"].includes(messageType) ? (mediaId || null) : null,
      linkButtonUrl: messageType === "TEXT" ? (linkButtons[0]?.url ?? null) : null,
      linkButtonTitle: messageType === "TEXT" ? (linkButtons[0]?.title ?? null) : null,
      linkButtons: messageType === "TEXT" && linkButtons.length ? linkButtons : Prisma.JsonNull,
      showcase: messageType === "SHOWCASE" ? {connect:{id:showcaseId}} : undefined,
      form: messageType === "FORM" && formId ? {connect:{id:formId}} : undefined,
      quickReplies: replies.length ? {create:replies.map(node => ({
        title: String(node.title), payload: String(node.payload),
        replyText: JSON.stringify({
          savedResponseId: null,
          type: node.destinationType, isExit: node.isExit === true,
          text: node.destinationText, formId: node.destinationFormId,
          showcaseId: node.destinationShowcaseId,
          mediaUrl: node.destinationMediaUrl, mediaId: node.destinationMediaId,
          question: node.destinationQuestion, destinationQuestion: node.destinationQuestion,
          quickReplies: node.destinationQuickReplies,
        }),
      }))} : undefined,
    });
  }

  // Validate all external resource references in two bounded DB requests.
  const [ownedForms, ownedShowcases] = await Promise.all([
    forms.size ? prisma.form.findMany({where:{id:{in:[...forms]},userId,instagramAccountId},select:{id:true}}) : [],
    showcases.size ? prisma.showcase.findMany({where:{id:{in:[...showcases]},userId,instagramAccountId},select:{id:true}}) : [],
  ]);
  if (ownedForms.length !== forms.size || ownedShowcases.length !== showcases.size)
    throw Error("فرم یا ویترین متعلق به پیج انتخاب‌شده نیست.");
  return results;
}
