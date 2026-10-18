"use client";

import { ArrowRight, Camera, Image as ImageIcon, Video, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/DashboardUI";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type Story = { id: string; mediaType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; };
type Automation = { mediaId: string | null; triggerType: string };

export default function StoryAutomationCreate() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"ALL" | "IMAGE" | "VIDEO">("ALL");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) {
          if (!cancelled) setAccount(null);
          return;
        }

        const [storiesResponse, automationsResponse] = await Promise.all([
          fetch("/api/instagram/stories?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
        ]);
        const storiesResult = await storiesResponse.json();
        const automationsResult = await automationsResponse.json();
        if (!storiesResponse.ok || !storiesResult.success) throw new Error(storiesResult.error || "دریافت استوری‌ها ناموفق بود.");
        if (!automationsResponse.ok || !automationsResult.success) throw new Error(automationsResult.error || "دریافت اتوماسیون‌ها ناموفق بود.");

        const used = new Set(
          (Array.isArray(automationsResult.data) ? automationsResult.data : [])
            .filter((item: Automation) => item.triggerType === "STORY_REPLY_KEYWORD" && item.mediaId)
            .map((item: Automation) => item.mediaId as string),
        );

        if (!cancelled) {
          setAccount(active);
          setStories((Array.isArray(storiesResult.data) ? storiesResult.data : []).filter((story: Story) => !used.has(story.id)));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت اطلاعات ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const visibleStories = stories.filter((story) => mediaFilter === "ALL" || (mediaFilter === "VIDEO" ? story.mediaType === "VIDEO" : story.mediaType !== "VIDEO"));

  if (loading) {
    return <div dir="rtl" className="mx-auto w-full max-w-5xl animate-pulse space-y-5 px-1"><div className="h-8 w-24 rounded-lg bg-[#E2E8F0]" /><div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><div className="h-5 w-36 rounded bg-[#E2E8F0]" /><div className="mt-3 h-3 w-64 max-w-full rounded bg-[#F1F5F9]" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="aspect-[9/14] rounded-xl bg-[#E2E8F0]" />)}</div></div>;
  }

  if (!account) {
    return <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center text-sm text-[#5A6B87]"><Camera size={26} className="mx-auto mb-3 text-[#94A3B8]" /><p className="font-semibold text-[#18233C]">{error || "پیج اینستاگرام متصل نیست."}</p><p className="mt-2 text-xs leading-5">ابتدا یک پیج اینستاگرام متصل کنید و دوباره تلاش کنید.</p></div>;
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)] rounded-[28px] bg-[#F4F7FC] p-2 sm:p-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="mb-1">
          <Button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-xs font-bold text-[#5A6B87] shadow-sm transition hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2F61FD]"
          >
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </Button>
        </div>
        <section className="mb-4 rounded-[24px] border border-[#E6ECF5] bg-white p-4 shadow-[0_4px_20px_rgba(24,35,60,0.035)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2F61FD]"><Camera size={21} /></span>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-[#18233C]">انتخاب استوری</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold text-[#2F61FD]">گام ۱ از ۳</span><span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-medium text-[#64748B]">پاسخ خودکار استوری</span></div>
              <p className="mt-1.5 text-xs leading-5 text-[#5A6B87] sm:text-sm">یک استوری فعال را برای پاسخ خودکار انتخاب کنید. استوری‌هایی که از قبل پاسخ خودکار دارند نمایش داده نمی‌شوند.</p>
            </div>
          </div>
        </section>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}<button type="button" onClick={() => window.location.reload()} className="mr-3 inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={13} />تلاش دوباره</button></div>}

        <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-[#E6ECF5] bg-white p-4 shadow-[0_3px_14px_rgba(24,35,60,0.025)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-xs font-medium text-[#64748B]">{visibleStories.length} استوری قابل انتخاب</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F1F5F9] p-1" role="group" aria-label="فیلتر نوع استوری">
            {([{value:"ALL",label:"همه"},{value:"IMAGE",label:"تصویری"},{value:"VIDEO",label:"ویدیویی"}] as const).map((option) => <button key={option.value} type="button" onClick={() => setMediaFilter(option.value)} aria-pressed={mediaFilter===option.value} className={"min-h-10 rounded-xl px-3.5 text-xs font-bold transition " + (mediaFilter===option.value ? "bg-white text-[#2F61FD] shadow-sm ring-1 ring-[#E6ECF5]" : "text-[#64748B] hover:text-[#18233C]")}>{option.label}</button>)}
          </div>
        </div>

        {stories.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-16 text-center">
            <ImageIcon className="mx-auto text-muted-foreground" size={25} />
            <h2 className="mt-4 text-sm font-bold">استوری قابل انتخابی وجود ندارد</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">استوری‌هایی که قبلاً پاسخ خودکار دارند در این لیست نمایش داده نمی‌شوند.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {visibleStories.map((story) => {
              const image = story.thumbnailUrl || story.mediaUrl;
              return (
                <button key={story.id} type="button" onClick={() => router.push("/dashboard/story-automation/new/configure?mediaId=" + encodeURIComponent(story.id))} className="group relative aspect-[9/14] overflow-hidden rounded-[20px] border border-[#E6ECF5] bg-[#F1F5F9] text-right shadow-[0_3px_12px_rgba(24,35,60,0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_12px_28px_rgba(24,35,60,0.08)] focus:outline-none focus:ring-2 focus:ring-[#2F61FD]/30">
                  {image ? (
                    story.mediaType === "VIDEO" && story.mediaUrl ? (
                      <video src={story.mediaUrl} poster={story.thumbnailUrl || undefined} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={image} alt="Instagram Story" className="h-full w-full object-cover" loading="lazy" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center">{story.mediaType === "VIDEO" ? <Video size={25} className="text-muted-foreground" /> : <ImageIcon size={25} className="text-muted-foreground" />}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3 pt-16 text-right text-xs font-bold text-white">{story.mediaType === "VIDEO" ? "ویدیو" : "استوری"}</div>
                </button>
              );
            })}
          </div>
        )}
        {stories.length > 0 && visibleStories.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-5 py-10 text-center text-sm text-[#5A6B87]">استوری‌ای با این فیلتر پیدا نشد. جست‌وجو یا فیلتر نوع را تغییر دهید.</div>}
      </div>
    </div>
  );
}
