"use client";

import { useEffect, useState } from "react";
import AutomationCreationFlow, { type EditableCommentAutomation } from "./AutomationCreationFlow";
import CommentAutomationEditSkeleton from "./CommentAutomationEditSkeleton";

export default function CommentAutomationEditor({ id, mediaId }: { id: string; mediaId?: string }) {
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
          throw new Error(result?.error || "دریافت تنظیمات پاسخ خودکار ناموفق بود.");
        const item = result.data as EditableCommentAutomation;
        if (item.triggerType !== "COMMENT_KEYWORD" || !item.instagramAccountId)
          throw new Error("پاسخ انتخاب‌شده از نوع پاسخ خودکار کامنت نیست.");
        const linkedMediaIds = new Set([
          ...(item.mediaId ? [item.mediaId] : []),
          ...(item.mediaIds || "").split(",").map((value) => value.trim()).filter(Boolean),
        ]);
        if (mediaId && !linkedMediaIds.has(mediaId))
          throw new Error("این محتوا دیگر به پاسخ انتخاب‌شده متصل نیست. از فهرست پاسخ‌ها دوباره وارد شوید.");
        if (linkedMediaIds.size > 1 && !mediaId)
          throw new Error("این پاسخ به چند محتوا متصل است. برای ویرایش مستقل، از دکمه ویرایش همان محتوا در فهرست استفاده کنید.");
        if (!controller.signal.aborted) setAutomation(item);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "دریافت پاسخ خودکار ناموفق بود.");
      }
    })();
    return () => controller.abort();
  }, [id, mediaId, retry]);

  if (!automation && !error) return <CommentAutomationEditSkeleton />;
  if (!automation) return (
    <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div role="alert" className="w-full rounded-xl border border-[var(--daira-error-border,#FECACA)] bg-[var(--daira-error-background,#FEF2F2)] px-4 py-4 text-sm text-[var(--daira-error-text,#B91C1C)]">{error}</div>
      <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 rounded-xl bg-[var(--daira-primary,#2F61FD)] px-5 text-sm font-bold text-white">تلاش دوباره</button>
    </div>
  );

  return <AutomationCreationFlow
    key={automation.id + ":" + (mediaId || "")}
    account={{
      id: automation.instagramAccountId,
      igUsername: automation.instagramAccount?.igUsername || "",
      igUserId: automation.instagramAccount?.igUserId || "",
      isConnected: automation.instagramAccount?.isConnected !== false,
    }}
    triggerType="COMMENT_KEYWORD"
    title="ویرایش پاسخ خودکار کامنت"
    description="تنظیمات ذخیره‌شده پاسخ خودکار را ویرایش کنید."
    editAutomation={automation}
    editingMediaId={mediaId}
  />;
}
