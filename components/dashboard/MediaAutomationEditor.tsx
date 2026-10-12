"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { DashboardLoading } from "@/components/dashboard/DashboardUI";

const EntryPointFlowBuilder = dynamic(() => import("@/components/dashboard/EntryPointFlowBuilder"), {
  ssr: false,
  loading: () => <DashboardLoading label="در حال آماده‌سازی ویرایشگر..." className="min-h-32" />,
});

type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
type AutomationData = {
  id: string;
  instagramAccountId: string;
  triggerType: TriggerType;
  mediaId: string | null;
  keyword: string | null;
  commentReplyText: string | null;
  likeComment?: boolean;
  likeStoryReply?: boolean;
  requireFollow: boolean;
  followGateText: string | null;
  isActive: boolean;
};

export default function MediaAutomationEditor({ id, expectedTriggerType }: { id: string; expectedTriggerType: TriggerType }) {
  const router = useRouter();
  const [automation, setAutomation] = useState<AutomationData | null>(null);
  const [keyword, setKeyword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`/api/automations/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || "دریافت اتوماسیون ناموفق بود.");
        const item = result.data as AutomationData;
        if (item.triggerType !== expectedTriggerType) throw new Error("نوع پاسخ خودکار با این صفحه مطابقت ندارد.");
        if (!cancelled) {
          setAutomation(item);
          setKeyword(item.keyword || "");
          setIsActive(Boolean(item.isActive));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت اتوماسیون ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, expectedTriggerType]);

  if (loading) return <DashboardLoading label="در حال دریافت پاسخ خودکار..." className="dashboard-loading--page" />;
  if (!automation) return <div dir="rtl" className="mx-auto max-w-xl p-3 text-sm leading-7 text-red-700">{error || "اتوماسیون پیدا نشد."}</div>;

  return (
    <div dir="rtl" className="min-h-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-3">
          <button type="button" onClick={() => router.back()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none transition hover:bg-[#DBEAFE] hover:text-[#2563EB]">
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </button>
        </div>

        <EntryPointFlowBuilder
          accountId={automation.instagramAccountId}
          automationId={automation.id}
          triggerType={expectedTriggerType}
          keyword={keyword}
          onKeywordChange={setKeyword}
          isActive={isActive}
          onActiveChange={setIsActive}
          dirty={true}
          onDirtyChange={() => undefined}
          finalSaveLabel="ذخیره"
          finalSaveLoadingLabel="در حال ذخیره..."
          responseTypeTitle="نوع پاسخ خودکار"
          responseTypeDescription="نوع پاسخی را که می‌خواهید برای این محتوا ارسال شود انتخاب کنید."
          onAutomationReady={async () => {
            try {
              const response = await fetch(`/api/automations/${encodeURIComponent(automation.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  ...(expectedTriggerType === "COMMENT_KEYWORD"
                    ? { commentReplyText: automation.commentReplyText, likeComment: Boolean(automation.likeComment) }
                    : { likeStoryReply: Boolean(automation.likeStoryReply) }),
                  requireFollow: Boolean(automation.requireFollow),
                  followGateText: automation.requireFollow ? automation.followGateText : null,
                }),
              });
              const result = await response.json();
              if (!response.ok || !result.success) throw new Error(result.error || result.message || "ذخیره تنظیمات پاسخ خودکار ناموفق بود.");
              toast.success("پاسخ خودکار با موفقیت ذخیره شد.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "ذخیره پاسخ خودکار ناموفق بود.");
            }
          }}
        />
        {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
