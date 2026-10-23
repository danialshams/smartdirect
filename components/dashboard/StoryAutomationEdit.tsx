"use client";

import { useEffect, useState } from "react";
import AutomationCreationFlow, { type EditableCommentAutomation } from "./AutomationCreationFlow";
import AutomationCreationSkeleton from "./AutomationCreationSkeleton";

export default function StoryAutomationEdit({ id }: { id: string }) {
  const [automation, setAutomation] = useState<EditableCommentAutomation | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setAutomation(null);
    setError("");
    void (async () => {
      try {
        const response = await fetch("/api/automations/" + encodeURIComponent(id), {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result?.success || !result?.data)
          throw new Error(result?.error || "دریافت تنظیمات پاسخ خودکار استوری ناموفق بود.");
        const item = result.data as EditableCommentAutomation;
        if (item.triggerType !== "STORY_REPLY_KEYWORD" || !item.instagramAccountId)
          throw new Error("پاسخ انتخاب‌شده از نوع پاسخ خودکار استوری نیست.");
        if (!controller.signal.aborted) setAutomation(item);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "دریافت پاسخ خودکار استوری ناموفق بود.");
      }
    })();
    return () => controller.abort();
  }, [id, retry]);

  if (!automation && !error) return <AutomationCreationSkeleton triggerType="STORY_REPLY_KEYWORD" />;
  if (!automation) return (
    <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div role="alert" className="w-full rounded-xl border border-[var(--daira-error-border,var(--daira-error-border))] bg-[var(--daira-error-background,var(--daira-error-background))] px-4 py-4 text-sm text-[var(--daira-error-text,var(--daira-error-text))]">{error}</div>
      <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 rounded-xl bg-[var(--daira-primary,var(--daira-primary))] px-5 text-sm font-bold text-white">تلاش دوباره</button>
    </div>
  );

  return <AutomationCreationFlow
    key={automation.id}
    account={{
      id: automation.instagramAccountId,
      igUsername: automation.instagramAccount?.igUsername || "",
      igUserId: automation.instagramAccount?.igUserId || "",
      isConnected: automation.instagramAccount?.isConnected !== false,
    }}
    triggerType="STORY_REPLY_KEYWORD"
    title="ویرایش پاسخ خودکار استوری"
    description="تنظیمات ذخیره‌شده پاسخ خودکار استوری را ویرایش کنید."
    editAutomation={automation}
  />;
}
