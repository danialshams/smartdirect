"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AutomationForm from "./AutomationForm";
import type { Automation } from "./AutomationManager";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean; createdAt?: string };

export default function CommentAutomationCreateConfigure() {
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
        if (!mediaId) throw new Error("محتوا انتخاب نشده است.");
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) throw new Error("پیج اینستاگرام متصل نیست.");

        const [mediaResponse, automationsResponse] = await Promise.all([
          fetch("/api/instagram/media?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
        ]);
        const mediaResult = await mediaResponse.json();
        const automationsResult = await automationsResponse.json();
        if (!mediaResponse.ok || !mediaResult.success) throw new Error(mediaResult.error || "دریافت محتوا ناموفق بود.");
        if (!automationsResponse.ok || !automationsResult.success) throw new Error(automationsResult.error || "دریافت اتوماسیون‌ها ناموفق بود.");

        const selected = (Array.isArray(mediaResult.data) ? mediaResult.data : []).find((item: { id: string }) => item.id === mediaId);
        if (!selected) throw new Error("این محتوا دیگر در پیج پیدا نشد.");
        const existing = (Array.isArray(automationsResult.data) ? automationsResult.data : []).find((item: Automation) => item.triggerType === "COMMENT_KEYWORD" && item.mediaId === mediaId);
        if (existing) {
          router.replace("/dashboard/auto-replies");
          return;
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
  }, [mediaId, router]);

  if (loading) return <div dir="rtl" className="flex min-h-[50vh] items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="در حال بارگذاری" /></div>;

  if (!account) return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "محتوا پیدا نشد."}</div>;

  const emptyAutomation: Automation = {
    id: "",
    instagramAccountId: account.id,
    triggerType: "COMMENT_KEYWORD",
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

  const notifySuccess = () => {
    toast.success("پاسخ خودکار با موفقیت ایجاد شد.", {
      description: "می‌توانید در بخش «مشاهده و ویرایش پاسخ‌های خودکار» آن را مشاهده و ویرایش کنید.",
      duration: 5000,
    });
    router.push("/dashboard/auto-replies");
  };

  return (
    <AutomationForm
      account={account}
      automation={emptyAutomation}
      onClose={() => router.back()}
      onCreated={notifySuccess}
      onUpdated={notifySuccess}
    />
  );
}
