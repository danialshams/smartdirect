/** Shared labels and eligibility rules for Smart Reminder response choices. */
export type ReminderCandidate = {
  triggerType: string;
  keyword: string | null;
  keywordMatchMode: string;
  mediaId: string | null;
};

const LIVE_MEDIA_ID = "__smartdirect_live_comments_v1__";

export function selectableForReminder(automation: ReminderCandidate): boolean {
  if (automation.triggerType === "DM" || automation.triggerType === "STORY_REPLY_KEYWORD") {
    // Internal icebreaker / menu DM automations have no trigger keyword.
    return Boolean(automation.keyword?.trim());
  }
  if (automation.triggerType === "COMMENT_KEYWORD") {
    // Instagram Live is a separate one-time comment reply flow.
    return automation.mediaId !== LIVE_MEDIA_ID &&
      (Boolean(automation.keyword?.trim()) || automation.keywordMatchMode === "CONTAINS_ANY");
  }
  return false;
}

export function smartReminderOptionName(automation: {
  triggerType: string;
  keyword: string | null;
  keywordMatchMode?: string | null;
}): string {
  const type = automation.triggerType === "STORY_REPLY_KEYWORD" ? "استوری"
    : automation.triggerType === "COMMENT_KEYWORD" ? "کامنت" : "دایرکت";
  const keywords = (automation.keyword ?? "")
    .split(/[,،;؛\r\n]+/)
    .map(word => word.trim())
    .filter(Boolean)
    .join("، ");
  const fallback = automation.triggerType === "COMMENT_KEYWORD" &&
    automation.keywordMatchMode === "CONTAINS_ANY" ? "هر کامنتی" : "بدون کلمه کلیدی";
  return `پاسخ خودکار ${type} — ${keywords || fallback}`;
}
