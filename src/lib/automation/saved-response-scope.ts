/** Decide which Instagram media stay unchanged when a shared response is edited.
 * Full response updates happen in place; partial ones require a separate automation.
 */
export type ResponseUsageSelection = {
  messageId: string;
  mediaIds: string[];
  expectedMessageUpdatedAt: string;
  expectedAutomationUpdatedAt: string;
};

export function checkedUsageMedia(
  previous: readonly string[],
  selected: readonly string[],
): { selected: string[]; remaining: string[]; split: boolean } {
  const original = Array.from(new Set(previous.filter(Boolean)));
  const checked = Array.from(new Set(selected.filter(Boolean)));
  if (checked.some((id) => !original.includes(id)))
    throw new Error("یکی از محتواهای انتخاب‌شده دیگر به پاسخ متصل نیست.");
  if (!checked.length && original.length)
    throw new Error("حداقل یک محتوا را انتخاب کن.");
  return {
    selected: checked,
    remaining: original.filter((id) => !checked.includes(id)),
    split: checked.length > 0 && checked.length < original.length,
  };
}

export function checkedUsagePlan(
  current: Array<{ messageId: string; mediaIds: string[] }>,
  input: ResponseUsageSelection[],
): Array<{ messageId: string; selected: string[]; remaining: string[]; split: boolean }> {
  if (!input.length) throw new Error("حداقل یک محل استفاده را انتخاب کن.");
  if (new Set(input.map((item) => item.messageId)).size !== input.length)
    throw new Error("یک محل استفاده بیش از یک بار انتخاب شده است.");
  return input.map((entry) => {
    const currentUsage = current.find((item) => item.messageId === entry.messageId);
    if (!currentUsage) throw new Error("یکی از محل‌های استفاده نامعتبر یا قدیمی است.");
    const plan = checkedUsageMedia(currentUsage.mediaIds, entry.mediaIds);
    if (!currentUsage.mediaIds.length && entry.mediaIds.length)
      throw new Error("انتخاب محتوا برای این پاسخ مجاز نیست.");
    return { messageId: entry.messageId, ...plan };
  });
}
