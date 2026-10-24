// Stored in Automation.commentReplyText to avoid a breaking database migration.
// The legacy plain text format remains supported for existing automations.
const PREFIX = "__DAIRA_PUBLIC_COMMENT_VARIANTS_V1__:";
export const MIN_PUBLIC_COMMENT_REPLIES = 3;
export const MAX_PUBLIC_COMMENT_REPLIES = 5;
export const MAX_PUBLIC_COMMENT_REPLY_LENGTH = 2000;

export function readPublicCommentReplies(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  if (!value.startsWith(PREFIX)) return [value.trim()];
  try {
    const parsed: unknown = JSON.parse(value.slice(PREFIX.length));
    if (!Array.isArray(parsed) || parsed.length < MIN_PUBLIC_COMMENT_REPLIES || parsed.length > MAX_PUBLIC_COMMENT_REPLIES
      || !parsed.every((item) => typeof item === "string" && item.trim() && item.trim().length <= MAX_PUBLIC_COMMENT_REPLY_LENGTH)) return [];
    return parsed.map((item: string) => item.trim());
  } catch { return []; }
}

// Compare what readers perceive, without changing the actual text sent to Instagram.
export function publicCommentReplyKey(value: string): string {
  return value.normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/[\u200d\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

export function validatePublicCommentReplies(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < MIN_PUBLIC_COMMENT_REPLIES || value.length > MAX_PUBLIC_COMMENT_REPLIES) {
    throw new Error("برای پاسخ زیر کامنت، حداقل ۳ و حداکثر ۵ پاسخ متفاوت وارد کنید.");
  }
  const texts = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (texts.some((text) => !text || text.length > MAX_PUBLIC_COMMENT_REPLY_LENGTH)) {
    throw new Error("همه پاسخ‌های زیر کامنت باید تکمیل شوند و هرکدام حداکثر ۲۰۰۰ کاراکتر باشند.");
  }
  if (new Set(texts.map(publicCommentReplyKey)).size !== texts.length) {
    throw new Error("متن پاسخ‌های زیر کامنت باید متفاوت باشد.");
  }
  return texts;
}

export function storePublicCommentReplies(value: unknown): string {
  return PREFIX + JSON.stringify(validatePublicCommentReplies(value));
}

export function pickPublicCommentReply(value: string | null | undefined): string | null {
  const variants = readPublicCommentReplies(value);
  return variants.length ? variants[Math.floor(Math.random() * variants.length)] : null;
}
