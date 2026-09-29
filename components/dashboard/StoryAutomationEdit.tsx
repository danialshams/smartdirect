"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AutomationForm from "./AutomationForm";
import type { Automation } from "./AutomationManager";

export default function StoryAutomationEdit({ id }: { id: string }) {
  const router = useRouter();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/automations/" + encodeURIComponent(id), { cache: "no-store", credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || "دریافت اتوماسیون ناموفق بود.");
        if (result.data?.triggerType !== "STORY_REPLY_KEYWORD") throw new Error("این صفحه فقط برای پاسخ خودکار استوری است.");
        if (!cancelled) setAutomation(result.data as Automation);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت اتوماسیون ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div dir="rtl" className="mx-auto w-full max-w-[1200px] animate-pulse"><div className="h-[650px] rounded-3xl bg-muted" /></div>;
  if (!automation) return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "اتوماسیون پیدا نشد."}</div>;

  return (
    <AutomationForm
      account={{
        id: automation.instagramAccountId,
        igUsername: automation.instagramAccount?.igUsername || "Instagram",
        igUserId: automation.instagramAccount?.igUserId || "",
        isConnected: automation.instagramAccount?.isConnected ?? true,
        createdAt: new Date(),
      }}
      automation={automation}
      onClose={() => router.back()}
      onCreated={() => router.push("/dashboard/story-automation")}
      onUpdated={() => router.push("/dashboard/story-automation")}
    />
  );
}
