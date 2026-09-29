"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AutomationForm from "./AutomationForm";
import type { Automation } from "./AutomationManager";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean; createdAt?: string };

export default function StoryAutomationConfigure() {
  const router = useRouter();
  const params = useSearchParams();
  const mediaId = params.get("mediaId");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
    }
    void load();
    return () => { cancelled = true; };
  }, [mediaId]);

  const emptyAutomation: Automation = {
    id: "",
    instagramAccountId: account?.id || "",
    triggerType: "STORY_REPLY_KEYWORD",
    mediaId,
    keyword: null,
    commentReplyText: null,
    replyText: null,
    likeComment: false,
    sendDm: false,
    likeIncomingDm: false,
    likeStoryReply: false,
    requireFollow: false,
    followGateText: null,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  };

  if (loading) return <div dir="rtl" className="mx-auto w-full max-w-[1200px] animate-pulse"><div className="mb-5 h-8 w-44 rounded-lg bg-muted" /><div className="h-[650px] rounded-3xl bg-muted" /></div>;

  if (!account) return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "استوری پیدا نشد."}<div><Button type="button" onClick={() => router.back()} className="mt-5 rounded-xl">بازگشت</Button></div></div>;

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mb-5 flex justify-start"><button type="button" onClick={() => router.back()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:bg-muted"><ArrowRight size={18} />بازگشت</button></div>
      <AutomationForm
        account={account as never}
        automation={emptyAutomation}
        onClose={() => router.back()}
        onCreated={() => router.push("/dashboard/story-automation")}
        onUpdated={() => router.push("/dashboard/story-automation")}
      />
    </div>
  );
}
