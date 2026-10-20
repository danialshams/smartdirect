// Pure text helpers: shared by server and client editors without bundling Prisma.
export function normalizeLiveText(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .trim().toLowerCase();
}
export const LIVE_AUTOMATION_TYPE = "LIVE_COMMENT_RULE";
export const LIVE_REPLY_SESSION_PREFIX = "smartdirect:live-session:v1:";
export const LIVE_COMMENT_DELIVERY_PREFIX = "smartdirect:live-comment:v1:";
export const LIVE_REPLY_SESSION_MS = 24 * 60 * 60 * 1000;

export type LiveReplyType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SHOWCASE" | "FORM";
export type LiveReplyOption = {
  id: string;
  title: string;
  payload: string;
  destinationType: LiveReplyType | null;
  destinationText: string;
  destinationFormId: string;
  destinationShowcaseId: string;
  destinationMediaUrl: string;
  destinationMediaId: string;
  destinationQuestion: string;
  destinationQuickReplies: LiveReplyOption[];
  isExit?: boolean;
};
export type LiveMessage = {
  messageType: LiveReplyType;
  text: string;
  mediaUrl: string;
  mediaId: string;
  showcaseId: string;
  formId: string;
  quickReplies: LiveReplyOption[];
};
export type LiveRule = {
  keywords: string[];
  matchMode: "EXACT" | "CONTAINS_ANY";
  initialText: string;
  mode: "DIRECT" | "FOLLOW_UP";
  nextKeyword: string;
  requireFollow: boolean;
  followText: string;
  response: LiveMessage;
};
export const defaultLiveMessage = (): LiveMessage => ({
  messageType: "TEXT", text: "", mediaUrl: "", mediaId: "",
  showcaseId: "", formId: "", quickReplies: [],
});
export const defaultLiveRule = (): LiveRule => ({
  keywords: [], matchMode: "EXACT", initialText: "",
  mode: "DIRECT", nextKeyword: "ارسال کن", requireFollow: false,
  followText: "برای دریافت پاسخ ابتدا این پیج را فالو کن.",
  response: defaultLiveMessage(),
});
type Dictionary = Record<string, unknown>;
const dictionary = (value: unknown): Dictionary => value && typeof value === "object" && !Array.isArray(value) ? value as Dictionary : {};
const string = (v: unknown) => typeof v === "string" ? v.trim() : "";
const supportedTypes: LiveReplyType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];
const keywordParts = (value: unknown) => Array.isArray(value)
  ? value.filter((x): x is string => typeof x === "string")
  : typeof value === "string" ? value.split(/[\n,،;؛]+/) : [];

export class LiveRuleValidationError extends Error {}

function requireRule(condition: boolean, message: string): asserts condition {
  if (!condition) throw new LiveRuleValidationError(message);
}

function readOptions(value: unknown, depth: number, payloads: Set<string>): LiveReplyOption[] {
  requireRule(depth <= 3, "حداکثر چهار سطح فرم قابل استفاده است.");
  requireRule(Array.isArray(value) && value.length >= 2 && value.length <= 13, "هر سؤال فرم باید بین ۲ تا ۱۳ گزینه داشته باشد.");
  return value.map((item: unknown, index: number) => {
    const node = dictionary(item);
    const title = string(node.title);
    const payload = string(node.payload) || ("live_option_" + depth + "_" + index);
    const destinationType = string(node.destinationType) as LiveReplyType;
    requireRule(title.length > 0 && title.length <= 20, "عنوان هر گزینه باید بین ۱ تا ۲۰ نویسه باشد.");
    requireRule(!payloads.has(payload), "شناسه گزینه‌های فرم تکراری است.");
    requireRule(supportedTypes.includes(destinationType), "نوع پاسخ یکی از گزینه‌های فرم نامعتبر است.");
    payloads.add(payload);
    const destinationText = string(node.destinationText);
    const destinationShowcaseId = string(node.destinationShowcaseId);
    const destinationMediaUrl = string(node.destinationMediaUrl);
    const destinationMediaId = string(node.destinationMediaId);
    const destinationQuestion = string(node.destinationQuestion);
    requireRule(destinationType !== "TEXT" || Boolean(destinationText), "متن پاسخ گزینه فرم را وارد کنید.");
    requireRule(destinationType !== "SHOWCASE" || Boolean(destinationShowcaseId), "ویترین گزینه فرم مشخص نیست.");
    requireRule(!["IMAGE", "VIDEO", "AUDIO"].includes(destinationType) || Boolean(destinationMediaUrl || destinationMediaId), "فایل گزینه فرم مشخص نیست.");
    requireRule(destinationType !== "FORM" || Boolean(destinationQuestion), "متن سؤال بعدی را وارد کنید.");
    return {
      id: string(node.id) || payload, title, payload, destinationType,
      destinationText, destinationFormId: string(node.destinationFormId),
      destinationShowcaseId, destinationMediaUrl, destinationMediaId, destinationQuestion,
      destinationQuickReplies: destinationType === "FORM"
        ? readOptions(node.destinationQuickReplies, depth + 1, payloads) : [],
      isExit: node.isExit === true,
    };
  });
}
export function parseLiveRule(raw: unknown): LiveRule {
  const o = dictionary(raw);
  const keywords = Array.from(new Set(keywordParts(o.keywords).map(normalizeLiveText).filter(Boolean)));
  requireRule(keywords.length >= 1 && keywords.length <= 10 && keywords.every((k) => k.length <= 100), "بین ۱ تا ۱۰ کلمه کلیدی با طول حداکثر ۱۰۰ نویسه وارد کنید.");
  const initialText = string(o.initialText);
  requireRule(initialText.length >= 1 && initialText.length <= 1000, "متن پیام اولیه را وارد کنید (حداکثر ۱۰۰۰ نویسه).");
  const matchMode = o.matchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT";
  const mode = o.mode === "FOLLOW_UP" ? "FOLLOW_UP" : "DIRECT";
  const requireFollow = o.requireFollow === true;
  const nextKeyword = normalizeLiveText(string(o.nextKeyword) || (mode === "FOLLOW_UP" ? "ارسال کن" : "بررسی فالو"));
  requireRule(nextKeyword.length > 0 && nextKeyword.length <= 100, "عبارت ادامهٔ گفتگو باید بین ۱ تا ۱۰۰ نویسه باشد.");
  const followText = string(o.followText) || defaultLiveRule().followText;
  requireRule(followText.length <= 640, "متن درخواست فالو باید حداکثر ۶۴۰ نویسه باشد.");
  const responseRaw = dictionary(o.response);
  const responseType = mode === "FOLLOW_UP" ? string(responseRaw.messageType) as LiveReplyType : "TEXT";
  requireRule(supportedTypes.includes(responseType), "نوع پاسخ ادامهٔ گفتگو معتبر نیست.");
  const response: LiveMessage = {
    messageType: responseType,
    text: string(responseRaw.text),
    mediaUrl: string(responseRaw.mediaUrl),
    mediaId: string(responseRaw.mediaId),
    showcaseId: string(responseRaw.showcaseId),
    formId: string(responseRaw.formId),
    quickReplies: responseType === "FORM" ? readOptions(responseRaw.quickReplies, 0, new Set<string>()) : [],
  };
  if (mode === "FOLLOW_UP") {
    requireRule(!["TEXT", "FORM"].includes(responseType) || Boolean(response.text), "متن پاسخ یا سؤال فرم را وارد کنید.");
    requireRule(!["IMAGE", "VIDEO", "AUDIO"].includes(responseType) || Boolean(response.mediaUrl || response.mediaId), "فایل رسانه‌ای پاسخ را انتخاب کنید.");
    requireRule(responseType !== "SHOWCASE" || Boolean(response.showcaseId), "ویترین پاسخ را انتخاب کنید.");
  }
  return { keywords, matchMode, initialText, mode, nextKeyword, requireFollow, followText, response };
}
export function matchLiveRule(rule: LiveRule, text: string) {
  const normalized = normalizeLiveText(text);
  return rule.matchMode === "EXACT"
    ? rule.keywords.includes(normalized)
    : rule.keywords.some((keyword) => normalized.includes(keyword));
}
export function liveOpeningMessage(rule: LiveRule) {
  if (!rule.requireFollow) return rule.initialText;
  const instruction = "پس از فالو، در دایرکت عبارت «" + rule.nextKeyword + "» را بنویس.";
  return rule.followText + "\n" + instruction;
}
