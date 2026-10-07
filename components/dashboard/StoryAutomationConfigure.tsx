"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AutomationCreationFlow from "./AutomationCreationFlow";

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
        if (!mediaId) throw new Error("استوری انتخاب نشده است.");
        const response = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(result.accounts) ? result.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) throw new Error("پیج اینستاگرام متصل نیست.");
        const storiesResponse = await fetch("/api/instagram/stories?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" });
        const storiesResult = await storiesResponse.json();
        if (!storiesResponse.ok || !storiesResult.success) throw new Error(storiesResult.error || storiesResult.message || "دریافت استوری ناموفق بود.");
        if (!(Array.isArray(storiesResult.data) ? storiesResult.data : []).some((item: { id: string }) => item.id === mediaId)) {
          throw new Error("این استوری دیگر فعال نیست. لطفاً یک استوری جدید انتخاب کنید.");
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

  if (loading) return <div dir="rtl" className="flex min-h-[50vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#2563EB]" aria-label="در حال بارگذاری" /></div>;
  if (!account) return <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "استوری پیدا نشد."}</div>;

  return (
    <AutomationCreationFlow
      account={account}
      mediaId={mediaId as string}
      triggerType="STORY_REPLY_KEYWORD"
      title="تنظیم پاسخ خودکار استوری"
      description="کلمات فعال‌کننده و نوع پاسخ را برای این استوری مشخص کن."
      onSaved={() => {
        toast.success("پاسخ خودکار با موفقیت ایجاد شد.", {
          description: "می‌توانید در بخش «مشاهده و ویرایش پاسخ‌های خودکار» آن را مشاهده و ویرایش کنید.",
          duration: 5000,
        });
        router.push("/dashboard/auto-replies");
      }}
    />
  );
}
