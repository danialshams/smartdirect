"use client";

import { ArrowRight, Image as ImageIcon, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type Story = { id: string; mediaType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; };
type Automation = { mediaId: string | null; triggerType: string };

export default function StoryAutomationCreate() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) {
    return <div dir="rtl" className="flex min-h-[50vh] items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="در حال بارگذاری" /></div>;
  }

  if (!account) {
    return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-dashed bg-card px-6 py-16 text-center text-sm text-muted-foreground">{error || "پیج اینستاگرام متصل نیست."}</div>;
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-[1200px]">
        <button type="button" onClick={() => router.back()} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <ArrowRight size={18} />
          بازگشت
        </button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">انتخاب استوری</h1>
        <p className="mt-2 text-sm text-muted-foreground">یک استوری فعال را برای پاسخ خودکار انتخاب کنید.</p>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {stories.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed bg-card px-6 py-20 text-center">
            <ImageIcon className="mx-auto text-muted-foreground" size={25} />
            <h2 className="mt-4 text-sm font-bold">استوری قابل انتخابی وجود ندارد</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">استوری‌هایی که قبلاً پاسخ خودکار دارند در این لیست نمایش داده نمی‌شوند.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {stories.map((story) => {
              const image = story.thumbnailUrl || story.mediaUrl;
              return (
                <button key={story.id} type="button" onClick={() => router.push("/dashboard/story-automation/new/configure?mediaId=" + encodeURIComponent(story.id))} className="group relative aspect-[9/14] overflow-hidden rounded-2xl bg-muted text-right transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-primary">
                  {image ? (
                    story.mediaType === "VIDEO" && story.mediaUrl ? (
                      <video src={story.mediaUrl} poster={story.thumbnailUrl || undefined} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={image} alt="Instagram Story" className="h-full w-full object-cover" loading="lazy" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center">{story.mediaType === "VIDEO" ? <Video size={25} className="text-muted-foreground" /> : <ImageIcon size={25} className="text-muted-foreground" />}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2.5 pt-12 text-right text-[10px] font-semibold text-white">{story.mediaType === "VIDEO" ? "ویدیو" : "استوری"}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
