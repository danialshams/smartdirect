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
  const [likeStoryReply, setLikeStoryReply] = useState(false);
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState("برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
  const [commentReplyText, setCommentReplyText] = useState("");
  const [dirty, setDirty] = useState(false);
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
          setLikeStoryReply(Boolean(item.likeStoryReply));
          setRequireFollow(Boolean(item.requireFollow));
          setFollowGateText(item.followGateText || "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
          setCommentReplyText(item.commentReplyText || "");
          setDirty(false);
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
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <button type="button" onClick={() => router.back()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none transition hover:bg-[#DBEAFE] hover:text-[#2563EB]">
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </button>
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6">
          <h1 className="text-base font-bold text-[#0F172A]">{expectedTriggerType === "STORY_REPLY_KEYWORD" ? "ویرایش پاسخ خودکار استوری" : "ویرایش پاسخ خودکار کامنت"}</h1>
          <p className="mt-1.5 text-xs leading-5 text-[#64748B]">{expectedTriggerType === "STORY_REPLY_KEYWORD" ? "کلمات فعال‌کننده، گزینه‌های اختیاری و نوع پاسخ این استوری را ویرایش کنید." : "کلمات فعال‌کننده، گزینه‌های اختیاری و متن پاسخ این محتوا را ویرایش کنید."}</p>
        </div>
        <EntryPointFlowBuilder
          accountId={automation.instagramAccountId}
          automationId={automation.id}
          triggerType={expectedTriggerType}
          keyword={keyword}
          onKeywordChange={(value) => { setKeyword(value); setDirty(true); }}
          isActive={isActive}
          onActiveChange={setIsActive}
          dirty={dirty}
          onDirtyChange={setDirty}
          textOnly={expectedTriggerType === "COMMENT_KEYWORD"}
          optionalSettings={
            <div className="space-y-4 border-t border-[#E2E8F0] pt-5">
              {expectedTriggerType === "STORY_REPLY_KEYWORD" ? (
                <section className="rounded-2xl border border-[#E2E8F0] p-4">
                  <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-bold text-[#0F172A]">لایک Reply استوری</span>
                      <span className="mt-1 block text-xs leading-5 text-[#64748B]">Reply کاربر را به‌صورت خودکار لایک کن.</span>
                    </span>
                    <input type="checkbox" checked={likeStoryReply} onChange={(event) => { setLikeStoryReply(event.target.checked); setDirty(true); }} className="mt-1 h-5 w-5 shrink-0 accent-[#2563EB]" />
                  </label>
                </section>
              ) : (
                <section className="rounded-2xl border border-[#E2E8F0] p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={Boolean(commentReplyText.trim())} onChange={(event) => { setCommentReplyText(event.target.checked ? (commentReplyText.trim() || "ممنون از کامنت شما.") : ""); setDirty(true); }} className="mt-1 h-5 w-5 shrink-0 accent-[#2563EB]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#0F172A]">پاسخ عمومی به کامنت</span>
                      <span className="mt-1 block text-xs leading-5 text-[#64748B]">در صورت فعال‌سازی، یک پاسخ متنی زیر کامنت کاربر منتشر می‌شود.</span>
                      {Boolean(commentReplyText.trim()) && <textarea value={commentReplyText} onChange={(event) => { setCommentReplyText(event.target.value); setDirty(true); }} rows={3} maxLength={2000} placeholder="متن پاسخ عمومی..." className="mt-3 w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />}
                    </span>
                  </label>
                </section>
              )}
              <section className="rounded-2xl border border-[#E2E8F0] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={requireFollow} onChange={(event) => { setRequireFollow(event.target.checked); setDirty(true); }} className="mt-1 h-5 w-5 shrink-0 accent-[#2563EB]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#0F172A]">شرط فالو قبل از ارسال محتوا</span>
                    <span className="mt-1 block text-xs leading-5 text-[#64748B]">قبل از ارسال پاسخ، از فالو بودن کاربر مطمئن شو.</span>
                    {requireFollow && <textarea value={followGateText} onChange={(event) => { setFollowGateText(event.target.value); setDirty(true); }} rows={3} maxLength={1000} placeholder="برای دریافت این محتوا ابتدا پیج ما را فالو کنید." className="mt-3 w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />}
                  </span>
                </label>
              </section>
            </div>
          }
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
                    ? { commentReplyText: commentReplyText.trim() || null, likeComment: false }
                    : { likeStoryReply }),
                  requireFollow,
                  followGateText: requireFollow ? followGateText.trim() : null,
                }),
              });
              const result = await response.json();
              if (!response.ok || !result.success) throw new Error(result.error || result.message || "ذخیره تنظیمات پاسخ خودکار ناموفق بود.");
              setDirty(false);
              toast.success("پاسخ خودکار با موفقیت ذخیره شد.");
            } catch (e) {
              const message = e instanceof Error ? e.message : "ذخیره پاسخ خودکار ناموفق بود.";
              toast.error(message);
              throw e instanceof Error ? e : new Error(message);
            }
          }}
        />
        {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
        </section>
      </div>
    </div>
  );
}
