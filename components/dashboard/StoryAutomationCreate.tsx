"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Image as ImageIcon, Search, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type Story = {
  id: string;
  mediaType: string | null;
  mediaProductType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
};
type Automation = { id: string; triggerType: string; mediaId: string | null };

export default function StoryAutomationCreate() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Automation | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) throw new Error("پیج اینستاگرام متصل نیست.");

        const [storiesResponse, automationsResponse] = await Promise.all([
          fetch("/api/instagram/stories?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
        ]);
        const storiesResult = await storiesResponse.json();
        const automationsResult = await automationsResponse.json();
        if (!storiesResponse.ok || !storiesResult.success) throw new Error(storiesResult.error || storiesResult.message || "دریافت استوری‌ها ناموفق بود.");
        if (!automationsResponse.ok || !automationsResult.success) throw new Error(automationsResult.error || automationsResult.message || "دریافت اتوماسیون‌ها ناموفق بود.");

        if (!cancelled) {
          setAccount(active);
          setStories(Array.isArray(storiesResult.data) ? storiesResult.data : []);
          setAutomations((Array.isArray(automationsResult.data) ? automationsResult.data : []).filter((item: Automation) => item.triggerType === "STORY_REPLY_KEYWORD" && Boolean(item.mediaId)));
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

  const filteredStories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stories;
    return stories.filter((story) => {
      const timestamp = story.timestamp ? new Date(story.timestamp).toLocaleString("fa-IR") : "";
      return story.id.toLowerCase().includes(query) || timestamp.includes(query);
    });
  }, [stories, search]);

  function selectStory(story: Story) {
    const existing = automations.find((item) => item.mediaId === story.id && item.triggerType === "STORY_REPLY_KEYWORD");
    if (existing) {
      setDuplicate(existing);
      return;
    }
    router.push("/dashboard/story-automation/new/configure?mediaId=" + encodeURIComponent(story.id));
  }

  if (loading) {
    return <div dir="rtl" className="mx-auto w-full max-w-[1400px] animate-pulse"><div className="mb-5 h-8 w-40 rounded-lg bg-muted" /><div className="rounded-3xl border bg-card p-4"><div className="mb-5 h-11 rounded-xl bg-muted" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[9/14] rounded-2xl bg-muted" />)}</div></div></div>;
  }

  if (!account) {
    return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-sm leading-7 text-red-700">{error || "پیج اینستاگرام متصل نیست."}</div>;
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-5">
          <div className="flex justify-start"><button type="button" onClick={() => router.back()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"><ArrowRight size={18} />بازگشت</button></div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">پاسخ جدید</h1>
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="rounded-3xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">استوری فعال موردنظر را انتخاب کنید.</p>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی استوری..." className="h-10 rounded-xl pr-9 text-sm" />
              </div>
            </div>
          </div>

          {filteredStories.length === 0 ? (
            <div className="px-6 py-20 text-center"><ImageIcon className="mx-auto text-muted-foreground" size={25} /><h3 className="mt-4 text-sm font-bold">{search ? "استوری‌ای پیدا نشد" : "استوری فعالی وجود ندارد"}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{search ? "عبارت جستجو را تغییر دهید." : "برای ساخت پاسخ خودکار ابتدا یک استوری فعال منتشر کنید."}</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-5">
              {filteredStories.map((story) => {
                const image = story.thumbnailUrl || story.mediaUrl;
                const hasAutomation = automations.some((item) => item.mediaId === story.id);
                return (
                  <button key={story.id} type="button" onClick={() => selectStory(story)} className="group relative aspect-[9/14] overflow-hidden rounded-2xl bg-muted text-right transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-primary hover:scale-[1.01]">
                    {image ? <img src={image} alt="Instagram Story" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center">{story.mediaType === "VIDEO" ? <Video size={25} className="text-muted-foreground" /> : <ImageIcon size={25} className="text-muted-foreground" />}</div>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2.5 pt-12 text-right text-[10px] font-semibold text-white">
                      {story.mediaType === "VIDEO" ? "ویدیو" : "استوری"}
                    </div>
                    {hasAutomation && <div className="absolute inset-0 flex items-center justify-center bg-black/45"><span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-foreground shadow-lg">این استوری قبلاً انتخاب شده</span></div>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {duplicate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setDuplicate(null); }}>
          <div className="w-full max-w-[390px] rounded-[28px] border border-border/80 bg-background p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><Check size={20} /></div>
            <h2 className="mt-5 text-base font-bold">این استوری قبلاً انتخاب شده</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">برای این استوری قبلاً پاسخ خودکار ساخته‌اید. برای تغییر تنظیمات وارد صفحه ویرایش همان پاسخ شوید.</p>
            <div className="mt-6 flex gap-2">
              <Button type="button" onClick={() => router.push("/dashboard/story-automation/" + duplicate.id)} className="min-h-11 flex-1 rounded-xl text-sm font-semibold">رفتن به ویرایش</Button>
              <Button type="button" variant="outline" onClick={() => setDuplicate(null)} className="min-h-11 rounded-xl text-sm">انصراف</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
