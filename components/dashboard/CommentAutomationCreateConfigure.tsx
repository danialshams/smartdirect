"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AutomationCreationFlow from "./AutomationCreationFlow";
import AutomationCreationSkeleton from "./AutomationCreationSkeleton";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };

export default function CommentAutomationCreateConfigure() {
  const params = useSearchParams();
  const mediaId = params.get("mediaId");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) throw new Error("پیج اینستاگرام متصل نیست.");

        if (mediaId) {
          const mediaResponse = await fetch("/api/instagram/media?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" });
          const mediaResult = await mediaResponse.json();
          if (!mediaResponse.ok || !mediaResult.success) throw new Error(mediaResult.message || "دریافت محتوا ناموفق بود.");
          const selected = (Array.isArray(mediaResult.data) ? mediaResult.data : []).find((item: { id: string }) => item.id === mediaId);
          if (!selected) throw new Error("این محتوا دیگر در پیج پیدا نشد.");
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

  if (loading) return <AutomationCreationSkeleton triggerType="COMMENT_KEYWORD" />;
  if (!account) return <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "پیج اینستاگرام پیدا نشد."}</div>;

  return (
    <AutomationCreationFlow
      account={account}
      mediaId={mediaId ?? ""}
      triggerType="COMMENT_KEYWORD"
      title="ایجاد پاسخ خودکار کامنت"
      description="پست‌ها و ریلزها را انتخاب کن، روش ساخت را مشخص کن و پاسخ خودکار را در همین صفحه تنظیم کن."
    />
  );
}
