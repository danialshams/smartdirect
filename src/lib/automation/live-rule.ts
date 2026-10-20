import type { AutomationMessageType } from "@/generated/prisma/client";
import { normalizeAutomationText, splitAutomationKeywords } from "./trigger";

export type LiveReplyMode = "DIRECT" | "FOLLOWUP";
export type LiveAnswerType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SHOWCASE" | "FORM";
export type LiveOption = {
  id: string; title: string; payload: string;
  destinationType: LiveAnswerType | null; destinationText: string;
  destinationShowcaseId: string; destinationMediaUrl: string; destinationMediaId: string;
  destinationQuestion: string; destinationQuickReplies: LiveOption[];
};
export type LiveAnswer = {
  id?: string; messageType: LiveAnswerType; text: string;
  mediaUrl: string; mediaId: string; showcaseId: string; formId: string;
  quickReplies: LiveOption[];
};
export type LiveRuleInput = {
  keyword: string; keywordMatchMode: "EXACT" | "CONTAINS_ANY";
  mode: LiveReplyMode; firstText: string; replyKeyword: string;
  requireFollow: boolean; followGateText: string; answer: LiveAnswer | null;
};
export class LiveRuleValidationError extends Error {}
const types: LiveAnswerType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
function parseOptions(raw: unknown, level: number, seen: Set<string>): LiveOption[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 13 || level > 3)
    throw new LiveRuleValidationError("هر سؤال باید ۲ تا ۱۳ گزینه داشته باشد (حداکثر ۴ سطح).");
  return raw.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new LiveRuleValidationError("گزینه فرم نامعتبر است.");
    const option = value as Record<string, unknown>;
    const title = str(option.title);
    const payload = str(option.payload);
    const destinationType = str(option.destinationType) as LiveAnswerType;
    const destinationText = str(option.destinationText);
    const destinationShowcaseId = str(option.destinationShowcaseId);
    const destinationMediaUrl = str(option.destinationMediaUrl);
    const destinationMediaId = str(option.destinationMediaId);
    const destinationQuestion = str(option.destinationQuestion);
    if (!title || title.length > 20 || !payload || payload.length > 200 || seen.has(payload) || !types.includes(destinationType))
      throw new LiveRuleValidationError("عنوان یا شناسه یکی از گزینه‌های فرم نامعتبر یا تکراری است.");
    seen.add(payload);
    if (destinationType === "TEXT" && !destinationText) throw new LiveRuleValidationError("متن پاسخ گزینه را وارد کنید.");
    if (destinationType === "SHOWCASE" && !destinationShowcaseId) throw new LiveRuleValidationError("ویترین گزینه را انتخاب کنید.");
    if (["IMAGE","VIDEO","AUDIO"].includes(destinationType) && !destinationMediaUrl && !destinationMediaId)
      throw new LiveRuleValidationError("رسانه گزینه را انتخاب کنید.");
    if (destinationType === "FORM" && !destinationQuestion) throw new LiveRuleValidationError("سؤال بعدی را وارد کنید.");
    return {
      id: str(option.id), title, payload, destinationType,
      destinationText, destinationShowcaseId, destinationMediaUrl, destinationMediaId,
      destinationQuestion,
      destinationQuickReplies: destinationType === "FORM" ? parseOptions(option.destinationQuickReplies, level + 1, seen) : [],
    };
  });
}
export function parseLiveRule(body: unknown): LiveRuleInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new LiveRuleValidationError("اطلاعات پاسخ لایو نامعتبر است.");
  const item = body as Record<string, unknown>;
  const keys = [...new Set(splitAutomationKeywords(str(item.keyword)))];
  if (keys.length < 1 || keys.length > 10 || keys.some((key) => key.length > 100))
    throw new LiveRuleValidationError("بین ۱ تا ۱۰ کلمه کلیدی کوتاه وارد کنید.");
  const keywordMatchMode = item.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT";
  const mode: LiveReplyMode = item.mode === "FOLLOWUP" ? "FOLLOWUP" : "DIRECT";
  const firstText = str(item.firstText);
  const replyKeyword = normalizeAutomationText(str(item.replyKeyword));
  const requireFollow = item.requireFollow === true;
  const followGateText = str(item.followGateText);
  if (!firstText || firstText.length > 1000) throw new LiveRuleValidationError("متن اولین دایرکت باید بین ۱ تا ۱۰۰۰ کاراکتر باشد.");
  if (requireFollow && mode !== "FOLLOWUP")
    throw new LiveRuleValidationError("برای اجبار به فالو باید پاسخ دومرحله‌ای را انتخاب کنید.");
  if (requireFollow && (!followGateText || followGateText.length > 640))
    throw new LiveRuleValidationError("متن درخواست فالو را وارد کنید (حداکثر ۶۴۰ کاراکتر).");
  if (requireFollow && firstText.length + followGateText.length + 2 > 1000)
    throw new LiveRuleValidationError("مجموع متن اولین دایرکت و درخواست فالو نباید بیشتر از ۱۰۰۰ کاراکتر باشد.");
  if (mode === "DIRECT") return { keyword: keys.join(","), keywordMatchMode, mode, firstText, replyKeyword: "", requireFollow: false, followGateText: "", answer: null };
  if (!replyKeyword || replyKeyword.length > 100 || replyKeyword.includes(","))
    throw new LiveRuleValidationError("کلمه ادامهٔ گفتگو را وارد کنید؛ مانند «ارسال کن».");
  const raw = item.answer;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new LiveRuleValidationError("نوع پاسخ بعد از دایرکت را انتخاب کنید.");
  const value = raw as Record<string, unknown>;
  const messageType = str(value.messageType) as LiveAnswerType;
  if (!types.includes(messageType)) throw new LiveRuleValidationError("نوع پاسخ انتخابی معتبر نیست.");
  const text = str(value.text);
  const mediaUrl = str(value.mediaUrl);
  const mediaId = str(value.mediaId);
  const showcaseId = str(value.showcaseId);
  const formId = str(value.formId);
  if ((messageType === "TEXT" || messageType === "FORM") && (!text || text.length > 2000))
    throw new LiveRuleValidationError("متن پاسخ یا سؤال فرم الزامی است (حداکثر ۲۰۰۰ کاراکتر).");
  if (["IMAGE","VIDEO","AUDIO"].includes(messageType) && !mediaUrl && !mediaId)
    throw new LiveRuleValidationError("فایل پاسخ را بارگذاری کنید.");
  if (messageType === "SHOWCASE" && !showcaseId) throw new LiveRuleValidationError("ویترین پاسخ را انتخاب کنید.");
  const quickReplies = messageType === "FORM" ? parseOptions(value.quickReplies,0,new Set()) : [];
  return {
    keyword: keys.join(","), keywordMatchMode, mode, firstText, replyKeyword,
    requireFollow, followGateText,
    answer: { id: str(value.id), messageType, text, mediaUrl, mediaId, showcaseId, formId, quickReplies },
  };
}
export function toStoredLiveOption(option: LiveOption) {
  return {
    title: option.title,
    payload: option.payload,
    replyText: JSON.stringify({
      type: option.destinationType, text: option.destinationText, showcaseId: option.destinationShowcaseId,
      mediaUrl: option.destinationMediaUrl, mediaId: option.destinationMediaId,
      question: option.destinationQuestion, destinationQuestion: option.destinationQuestion,
      quickReplies: option.destinationQuickReplies,
    }),
  };
}
export function liveAnswerType(value: LiveAnswerType): AutomationMessageType {
  return value as AutomationMessageType;
}
