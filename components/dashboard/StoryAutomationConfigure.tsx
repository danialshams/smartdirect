"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AutomationCreationFlow from "./AutomationCreationFlow";
import AutomationCreationSkeleton from "./AutomationCreationSkeleton";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };

export default function StoryAutomationConfigure() {
  const router = useRouter();
  const params = useSearchParams();
  const mediaId = params.get("mediaId");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(result.accounts) ? result.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) throw new Error("پیج اینستاگرام متصل نیست.");
        if (mediaId) {
          const storiesResponse = await fetch("/api/instagram/stories?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" });
          const storiesResult = await storiesResponse.json();
          if (!storiesResponse.ok || !storiesResult.success) throw new Error(storiesResult.error || storiesResult.message || "دریافت استوری ناموفق بود.");
          if (!(Array.isArray(storiesResult.data) ? storiesResult.data : []).some((item: { id: string }) => item.id === mediaId)) {
            throw new Error("این استوری دیگر فعال نیست. لطفاً یک استوری جدید انتخاب کنید.");
          }
        }
        if (!cancelled) setAccount(active);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت اطلاعات ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mediaId]);

  if (loading) return <AutomationCreationSkeleton triggerType="STORY_REPLY_KEYWORD" />;
  if (!account) return <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "استوری پیدا نشد."}</div>;

  return (
    <AutomationCreationFlow
      account={account}
      mediaId={mediaId ?? ""}
      triggerType="STORY_REPLY_KEYWORD"
      title="ایجاد پاسخ خودکار استوری"
      description="استوری را انتخاب کن، روش ساخت را مشخص کن و پاسخ خودکار را در همین صفحه تنظیم کن."
    />
  );
}
