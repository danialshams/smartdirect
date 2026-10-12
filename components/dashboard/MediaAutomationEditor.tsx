"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Check, MessageCircle, Save, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, DashboardLoading } from "@/components/dashboard/DashboardUI";

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
  instagramAccount?: { igUsername?: string | null };
};
type Preview = { mediaUrl?: string | null; thumbnailUrl?: string | null; mediaType?: string | null };

export default function MediaAutomationEditor({ id, expectedTriggerType }: { id: string; expectedTriggerType: TriggerType }) {
  const router = useRouter();
  const [automation, setAutomation] = useState<AutomationData | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [keyword, setKeyword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [commentReplyText, setCommentReplyText] = useState("");
  const [likeComment, setLikeComment] = useState(false);
  const [likeStoryReply, setLikeStoryReply] = useState(false);
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState("برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
  const [loading, setLoading] = useState(true);
  const [savingOptions, setSavingOptions] = useState(false);
  const [optionsDirty, setOptionsDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const response = await fetch(`/api/automations/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || "دریافت اتوماسیون ناموفق بود.");
        const item = result.data as AutomationData;
        if (item.triggerType !== expectedTriggerType) throw new Error("نوع پاسخ خودکار با این صفحه مطابقت ندارد.");
        if (!cancelled) {
          setAutomation(item);
          setKeyword(item.keyword || "");
          setIsActive(Boolean(item.isActive));
          setCommentReplyText(item.commentReplyText || "");
          setLikeComment(Boolean(item.likeComment));
          setLikeStoryReply(Boolean(item.likeStoryReply));
          setRequireFollow(Boolean(item.requireFollow));
          setFollowGateText(item.followGateText?.trim() || "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
        }
        if (item.mediaId) {
          const mediaResponse = await fetch(`/api/automations/media-preview?instagramAccountId=${encodeURIComponent(item.instagramAccountId)}&mediaId=${encodeURIComponent(item.mediaId)}`, { cache: "no-store", credentials: "include" });
          const mediaResult = await mediaResponse.json();
          if (!cancelled && mediaResponse.ok && mediaResult.success) setPreview(mediaResult.data as Preview);
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

  async function saveOptions() {
    if (!automation || savingOptions) return;
    if (requireFollow && !followGateText.trim()) {
      toast.error("متن درخواست فالو را وارد کنید.");
      return;
    }
    setSavingOptions(true);
    try {
      const response = await fetch(`/api/automations/${encodeURIComponent(automation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(expectedTriggerType === "COMMENT_KEYWORD" ? { commentReplyText: commentReplyText.trim() || null, likeComment } : { likeStoryReply }),
          requireFollow,
          followGateText: requireFollow ? followGateText.trim() : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || result.message || "ذخیره تنظیمات ناموفق بود.");
      setAutomation(result.data as AutomationData);
      setOptionsDirty(false);
      toast.success("تنظیمات تکمیلی ذخیره شد.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ذخیره تنظیمات ناموفق بود.");
    } finally {
      setSavingOptions(false);
    }
  }

  if (loading) return <DashboardLoading label="در حال دریافت پاسخ خودکار..." className="dashboard-loading--page" />;
  if (!automation) return <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-700">{error || "اتوماسیون پیدا نشد."}</div>;

  const previewUrl = preview?.thumbnailUrl || preview?.mediaUrl || null;
  const isStory = expectedTriggerType === "STORY_REPLY_KEYWORD";
  return (
    <div dir="rtl" className="min-h-full bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Button type="button" onClick={() => router.back()} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#2563EB] shadow-none hover:bg-[#DBEAFE]">
          <ArrowRight size={15} /> بازگشت
        </Button>
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">{isStory ? <Camera size={18} /> : <MessageCircle size={18} />}</span>
            <div>
              <h1 className="text-base font-bold text-[#0F172A]">ویرایش پاسخ خودکار {isStory ? "استوری" : "کامنت"}</h1>
              <p className="mt-1 text-xs text-[#64748B]">تنظیمات و نوع پاسخ فعلی بارگذاری شده‌اند؛ می‌توانید همه بخش‌ها را ویرایش کنید.</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-[#E2E8F0]">
              {previewUrl ? <img src={previewUrl} alt={isStory ? "پیش‌نمایش استوری" : "پیش‌نمایش محتوا"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#64748B]">{isStory ? <Camera size={18} /> : <MessageCircle size={18} />}</div>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0F172A]">@{automation.instagramAccount?.igUsername || "Instagram"}</p>
              <p className="mt-1 text-[11px] text-[#64748B]">{isStory ? "استوری انتخاب‌شده" : "محتوای دارای پاسخ خودکار"}</p>
            </div>
            <label className="mr-auto flex shrink-0 items-center gap-2 text-xs font-semibold text-[#334155]">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              فعال
            </label>
          </div>
        </section>

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
          finalSaveLabel="ذخیره پاسخ خودکار"
          finalSaveLoadingLabel="در حال ذخیره..."
          responseTypeTitle="نوع پاسخ"
          responseTypeDescription={isStory ? "نوع پاسخ این استوری را انتخاب کنید؛ می‌توانید مثلاً ویترین را به متن یا هر نوع پشتیبانی‌شده دیگری تغییر دهید." : "نوع پاسخ را دقیقاً مانند تنظیمات پاسخ خودکار هنگام انتشار محتوا تغییر دهید."}
          onAutomationReady={async () => {
            if (optionsDirty) await saveOptions();
            else toast.success("پاسخ خودکار ذخیره شد.");
          }}
        />

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><UserRoundCheck size={18} /></span>
            <div><h2 className="text-sm font-bold text-[#0F172A]">تنظیمات اختیاری</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">این تنظیمات جدا از نوع پیام ذخیره می‌شوند.</p></div>
          </div>
          {expectedTriggerType === "COMMENT_KEYWORD" && (
            <>
              <label className="mb-2 block text-xs font-bold text-[#334155]">پاسخ عمومی کامنت</label>
              <textarea value={commentReplyText} onChange={(e) => { setCommentReplyText(e.target.value); setOptionsDirty(true); }} rows={4} placeholder="متن پاسخ کامنت..." className="mb-4 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-base leading-7 outline-none focus:border-[#2563EB]" style={{ fontSize: "16px" }} />
              <label className="mb-4 flex items-center gap-2 text-xs font-medium text-[#334155]"><input type="checkbox" checked={likeComment} onChange={(e) => { setLikeComment(e.target.checked); setOptionsDirty(true); }} className="h-4 w-4 accent-blue-600" /> لایک‌کردن کامنت کاربر</label>
            </>
          )}
          {expectedTriggerType === "STORY_REPLY_KEYWORD" && (
            <label className="mb-4 flex items-center gap-2 text-xs font-medium text-[#334155]"><input type="checkbox" checked={likeStoryReply} onChange={(e) => { setLikeStoryReply(e.target.checked); setOptionsDirty(true); }} className="h-4 w-4 accent-blue-600" /> لایک‌کردن پاسخ استوری</label>
          )}
          <label className="mb-4 flex items-center gap-2 text-xs font-medium text-[#334155]"><input type="checkbox" checked={requireFollow} onChange={(e) => { setRequireFollow(e.target.checked); setOptionsDirty(true); }} className="h-4 w-4 accent-blue-600" /> درخواست فالو قبل از ارسال پاسخ</label>
          {requireFollow && <textarea value={followGateText} onChange={(e) => { setFollowGateText(e.target.value); setOptionsDirty(true); }} rows={3} placeholder="متن درخواست فالو..." className="mb-4 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-base leading-7 outline-none focus:border-[#2563EB]" style={{ fontSize: "16px" }} />}
          <Button type="button" onClick={() => void saveOptions()} disabled={!optionsDirty || savingOptions} className="min-h-10 w-full rounded-xl !bg-[#2563EB] px-4 text-xs font-bold text-white hover:!bg-[#1D4ED8] disabled:!bg-[#E2E8F0] disabled:!text-[#94A3B8]">
            {savingOptions ? "در حال ذخیره..." : <><Save size={15} /> ذخیره تنظیمات اختیاری</>}
          </Button>
        </section>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      </div>
    </div>
  );
}
