"use client";

import { useEffect, useState } from "react";
import AutomationCreationFlow from "./AutomationCreationFlow";
import AutomationCreationSkeleton from "./AutomationCreationSkeleton";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };

export default function StoryAutomationConfigure() {
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
        if (!cancelled) setAccount(active);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت اطلاعات ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <AutomationCreationSkeleton triggerType="STORY_REPLY_KEYWORD" />;
  if (!account) return <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "استوری پیدا نشد."}</div>;

  return (
    <AutomationCreationFlow
      account={account}
      mediaId=""
      triggerType="STORY_REPLY_KEYWORD"
      title="ایجاد پاسخ خودکار استوری"
      description="این پاسخ برای تمام استوری‌های فعلی و آینده این پیج فعال می‌شود."
    />
  );
}
