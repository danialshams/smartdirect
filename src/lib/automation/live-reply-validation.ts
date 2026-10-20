import type { MessageDraft, QuickReplyDraft } from "@/components/dashboard/automation-form-utils";
import { normalizeAutomationText, splitAutomationKeywords } from "./trigger";

type MessageType = MessageDraft["messageType"];
const types: MessageType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];
const asString = (input: unknown) => typeof input === "string" ? input.trim() : "";

export class LiveReplyValidationError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type ValidatedLiveRule = {
  keyword: string; matchMode: "EXACT" | "CONTAINS_ANY"; initialText: string;
  followupKeyword: string; message: MessageDraft | null;
  requireFollow: boolean; followGateText: string; followGateButtonText: string;
};

function parseOption(raw: unknown, level: number, seen: Set<string>): QuickReplyDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LiveReplyValidationError("گزینه فرم نامعتبر است.");
  const data = raw as Record<string, unknown>;
  const title = asString(data.title);
  const payload = asString(data.payload);
  const type = asString(data.destinationType);
  if (!title || title.length > 20 || !payload || payload.length > 1000 || seen.has(payload) || !types.includes(type as MessageType))
    throw new LiveReplyValidationError("عنوان، مقصد یا شناسه گزینه فرم نامعتبر است.");
  seen.add(payload);
  const destinationType = type as QuickReplyDraft["destinationType"];
  const destinationText = asString(data.destinationText);
  const destinationShowcaseId = asString(data.destinationShowcaseId);
  const destinationMediaUrl = asString(data.destinationMediaUrl);
  const destinationMediaId = asString(data.destinationMediaId);
  const destinationQuestion = asString(data.destinationQuestion);
  if (destinationType === "TEXT" && (!destinationText || destinationText.length > 2000))
    throw new LiveReplyValidationError("متن مقصد گزینه فرم ناقص است.");
  if (destinationType === "SHOWCASE" && !destinationShowcaseId)
    throw new LiveReplyValidationError("ویترین مقصد گزینه فرم مشخص نیست.");
  if (["IMAGE", "VIDEO", "AUDIO"].includes(type) && !destinationMediaUrl && !destinationMediaId)
    throw new LiveReplyValidationError("فایل مقصد گزینه فرم مشخص نیست.");
  if (destinationType === "FORM" && (!destinationQuestion || level >= 3))
    throw new LiveReplyValidationError("سؤال بعدی را وارد کنید (حداکثر چهار سطح).");
  const children = destinationType === "FORM" ? parseOptions(data.destinationQuickReplies, level + 1, seen) : [];
  return {
    id: asString(data.id), isExit: data.isExit === true, title, payload, destinationType,
    nextMessageId: null, destinationText, destinationFormId: asString(data.destinationFormId),
    destinationShowcaseId, destinationMediaUrl, destinationMediaId, destinationQuestion,
    destinationQuickReplies: children,
  };
}

function parseOptions(value: unknown, level: number, seen: Set<string>): QuickReplyDraft[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 13)
    throw new LiveReplyValidationError("هر سؤال فرم باید بین ۲ تا ۱۳ گزینه داشته باشد.");
  return value.map(item => parseOption(item, level, seen));
}

export function validateLiveReplyInput(input: unknown): ValidatedLiveRule {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LiveReplyValidationError("درخواست نامعتبر است.");
  const data = input as Record<string, unknown>;
  const keyword = [...new Set(splitAutomationKeywords(asString(data.keyword)))].join(",");
  if (!keyword || keyword.split(",").length > 10) throw new LiveReplyValidationError("بین ۱ تا ۱۰ کلمه کلیدی وارد کن.");
  const matchMode = data.matchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT";
  const initialText = asString(data.initialText);
  if (!initialText || initialText.length > 1000)
    throw new LiveReplyValidationError("متن اولین دایرکت باید بین ۱ تا ۱۰۰۰ کاراکتر باشد.");
  const followupKeyword = normalizeAutomationText(asString(data.followupKeyword));
  if (followupKeyword.length > 60 || (data.followupEnabled === true && !followupKeyword))
    throw new LiveReplyValidationError("برای پاسخ چندمرحله‌ای، کلمه ادامه حداکثر ۶۰ کاراکتری وارد کن.");
  const requireFollow = data.requireFollow === true;
  const followGateText = asString(data.followGateText);
  if (requireFollow && (!followGateText || followGateText.length > 640))
    throw new LiveReplyValidationError("متن درخواست فالو باید بین ۱ تا ۶۴۰ کاراکتر باشد.");
  const buttonRaw = data.followGateButtonText;
  const followGateButtonText = buttonRaw === undefined || buttonRaw === null ? "بررسی فالو" : asString(buttonRaw);
  if (requireFollow && (!followGateButtonText || followGateButtonText.length > 20))
    throw new LiveReplyValidationError("عنوان بررسی فالو باید بین ۱ تا ۲۰ کاراکتر باشد.");
  const hasFollowup = data.followupEnabled === true;
  let message: MessageDraft | null = null;
  if (hasFollowup) {
    const m = data.message;
    if (!m || typeof m !== "object" || Array.isArray(m)) throw new LiveReplyValidationError("پاسخ مرحله دوم نامعتبر است.");
    const raw = m as Record<string, unknown>;
    const type = asString(raw.messageType) as MessageType;
    if (!types.includes(type)) throw new LiveReplyValidationError("نوع پاسخ مرحله دوم نامعتبر است.");
    const text = asString(raw.text);
    const mediaUrl = asString(raw.mediaUrl);
    const mediaId = asString(raw.mediaId);
    const showcaseId = asString(raw.showcaseId);
    const formId = asString(raw.formId);
    if (["TEXT", "FORM"].includes(type) && (!text || text.length > 2000))
      throw new LiveReplyValidationError("متن پاسخ مرحله دوم یا سؤال فرم ناقص است.");
    if (["IMAGE", "VIDEO", "AUDIO"].includes(type) && !mediaUrl && !mediaId)
      throw new LiveReplyValidationError("فایل پاسخ مرحله دوم انتخاب نشده است.");
    if (type === "SHOWCASE" && !showcaseId)
      throw new LiveReplyValidationError("ویترین پاسخ مرحله دوم را انتخاب کن.");
    message = {
      id: asString(raw.id), messageType: type, text, mediaUrl, mediaId,
      showcaseId, formId, quickReplies: type === "FORM" ? parseOptions(raw.quickReplies, 0, new Set()) : [],
    };
  }
  return { keyword, matchMode, initialText, followupKeyword: hasFollowup ? followupKeyword : "",
    message, requireFollow, followGateText: requireFollow ? followGateText : "",
    followGateButtonText: requireFollow ? followGateButtonText : "" };
}

export function serializeLiveQuickReply(item: QuickReplyDraft) {
  return {
    title: item.title,
    payload: item.payload,
    replyText: JSON.stringify({
      type: item.destinationType, isExit: item.isExit === true, text: item.destinationText,
      formId: item.destinationFormId, showcaseId: item.destinationShowcaseId,
      mediaUrl: item.destinationMediaUrl, mediaId: item.destinationMediaId,
      question: item.destinationQuestion, destinationQuestion: item.destinationQuestion,
      quickReplies: item.destinationQuickReplies,
    }),
  };
}

export function liveReplyOptionsOverlap(
  a: string, b: string,
  aMode: "EXACT" | "CONTAINS_ANY" = "EXACT",
  bMode: "EXACT" | "CONTAINS_ANY" = "EXACT",
) {
  const existing = splitAutomationKeywords(a);
  const incoming = splitAutomationKeywords(b);
  return existing.some(left => incoming.some(right => {
    if (left === right) return true;
    // EXACT + EXACT can coexist. When either rule matches substrings, a
    // phrase containing the other rule's keyword could match both rules.
    if (aMode === "CONTAINS_ANY" && right.includes(left)) return true;
    if (bMode === "CONTAINS_ANY" && left.includes(right)) return true;
    // Two substring triggers with a shared overlap are also ambiguous when
    // one configured keyword is contained in the other.
    return false;
  }));
}
