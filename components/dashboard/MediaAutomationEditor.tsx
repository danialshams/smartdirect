"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LoadingState = ({ label }: { label: string }) => (
  <div dir="rtl" className="flex min-h-[60vh] w-full items-center justify-center px-4 py-10">
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 size={30} strokeWidth={1.8} className="animate-spin text-[#2563EB]" />
      <p className="text-sm leading-6 text-[#64748B]">{label}</p>
    </div>
  </div>
);

const EntryPointFlowBuilder = dynamic(() => import("@/components/dashboard/EntryPointFlowBuilder"), {
  ssr: false,
  loading: () => <LoadingState label="در حال آماده‌سازی ویرایشگر..." />,
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
  const [followGateText, setFollowGateText] = useState("برای دریافت پاسخ، ابتدا پیج را Follow کنید.");
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
          setFollowGateText(item.followGateText || "برای دریافت پاسخ، ابتدا پیج را Follow کنید.");
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

  if (loading) return <LoadingState label={expectedTriggerType === "STORY_REPLY_KEYWORD" ? "در حال دریافت اطلاعات استوری..." : "در حال دریافت اطلاعات محتوا..."} />;
  if (!automation) return <div dir="rtl" className="flex min-h-[50vh] items-center justify-center px-4 text-center text-sm leading-7 text-red-700">{error || "اتوماسیون پیدا نشد."}</div>;

  const isStory = expectedTriggerType === "STORY_REPLY_KEYWORD";

  return (
    <div dir="rtl" className="min-h-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => router.back()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none transition hover:bg-[#DBEAFE] hover:text-[#2563EB]">
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </button>
        </div>

        <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">{isStory ? "۴" : "۶"}</span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0F172A]">{isStory ? "تنظیم پاسخ خودکار استوری" : "تنظیم پاسخ خودکار"}</h2>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">{isStory ? "کلمات فعال‌کننده و پاسخ Reply استوری را مشخص کن." : "کلمات فعال‌کننده و متن پیام دایرکت را مشخص کن."}</p>
            </div>
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
            textOnly={!isStory}
            keywordLabel={isStory ? "کلمات کلیدی Reply استوری" : "کلمات کلیدی"}
            keywordDescription={isStory ? "با وارد شدن این کلمات در Reply استوری، پاسخ خودکار فعال می‌شود." : "با وارد شدن این کلمات در کامنت، پاسخ خودکار فعال می‌شود."}
            optionalSettings={
              <div className={isStory ? "space-y-3" : "space-y-5"}>
                {isStory && (
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={likeStoryReply} onChange={(event) => { setLikeStoryReply(event.target.checked); setDirty(true); }} className="mt-0.5 h-4 w-4 accent-[#2563EB]" />
                      <span>
                        <span className="block text-sm font-bold text-[#0F172A]">لایک ریپلای <span className="font-medium text-[#2563EB]">(اختیاری)</span></span>
                        <span className="mt-1 block text-xs leading-5 text-[#64748B]">در صورت فعال بودن، Reply استوری کاربر لایک می‌شود.</span>
                      </span>
                    </label>
                  </div>
                )}

                {!isStory && (
                  <div className="border-t border-[#E2E8F0] pt-5">
                    <label htmlFor="edit-publishing-comment-reply" className="mb-2 block text-sm font-bold text-[#0F172A]">متن ارسالی در کامنت</label>
                    <textarea id="edit-publishing-comment-reply" value={commentReplyText} onChange={(event) => { setCommentReplyText(event.target.value); setDirty(true); }} rows={3} maxLength={2000} inputMode="text" placeholder="پاسخی که زیر کامنت کاربر منتشر می‌شود بنویس..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none placeholder:text-xs focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                  </div>
                )}

                <div className={isStory ? "rounded-xl border border-[#E2E8F0] bg-white p-3.5" : "border-t border-[#E2E8F0] pt-5"}>
                  <label className={isStory ? "flex cursor-pointer items-start gap-3" : "flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5"}>
                    <input type="checkbox" checked={requireFollow} onChange={(event) => { setRequireFollow(event.target.checked); setDirty(true); }} className="mt-0.5 h-4 w-4 accent-[#2563EB]" />
                    <span>
                      <span className="block text-sm font-bold text-[#0F172A]">اجبار به فالو <span className="font-medium text-[#2563EB]">(اختیاری)</span></span>
                      <span className="mt-1 block text-xs leading-5 text-[#64748B]">در صورت فعال بودن، کاربر باید پیج را فالو کرده باشد تا پاسخ را دریافت کند.</span>
                    </span>
                  </label>
                  {requireFollow && (
                    <div className="mt-2.5">
                      <label htmlFor="edit-publishing-follow-gate-text" className="mb-2 block text-sm font-bold text-[#0F172A]">متن درخواست فالو</label>
                      <textarea id="edit-publishing-follow-gate-text" value={followGateText} onChange={(event) => { setFollowGateText(event.target.value); setDirty(true); }} rows={2} maxLength={500} inputMode="text" placeholder="مثلاً برای دریافت اطلاعات لطفاً ابتدا پیج را فالو کنید." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none placeholder:text-xs focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                    </div>
                  )}
                </div>
              </div>
            }
            finalSaveLabel={isStory ? "ذخیره" : "ذخیره متن و ادامه"}
            finalSaveLoadingLabel="در حال ذخیره..."
            responseTypeTitle="نوع پاسخ خودکار"
            responseTypeDescription="نوع پاسخی را که می‌خواهید برای این محتوا ارسال شود انتخاب کنید."
            onAutomationReady={async () => {
              try {
                if (requireFollow && !followGateText.trim()) throw new Error("متن درخواست فالو را وارد کنید.");
                if (!isStory && !commentReplyText.trim()) throw new Error("متن ارسالی در کامنت را وارد کنید.");
                const response = await fetch(`/api/automations/${encodeURIComponent(automation.id)}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    ...(isStory ? { likeStoryReply } : { commentReplyText: commentReplyText.trim() }),
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
          {error && <div role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-5 text-[#B91C1C]">{error}</div>}
        </section>
      </div>
    </div>
  );
}
