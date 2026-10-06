"use client";

import { ArrowRight, Image as ImageIcon, Play, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
};

type Automation = { mediaId: string | null; triggerType: string };
type Filter = "ALL" | "POST" | "REEL" | "ALBUM";

function mediaType(item: MediaItem): Exclude<Filter, "ALL"> {
  if (item.media_product_type === "REELS") return "REEL";
  if (item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "CAROUSEL_ALBUM") return "ALBUM";
  return "POST";
}

function mediaLabel(item: MediaItem) {
  const type = mediaType(item);
  return type === "REEL" ? "ریلز" : type === "ALBUM" ? "آلبوم" : "پست";
}

export default function CommentAutomationCreate() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [mediaFailed, setMediaFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");

        const active = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) {
          if (!cancelled) setAccount(null);
          return;
        }

        const [mediaResponse, automationsResponse] = await Promise.all([
          fetch("/api/instagram/media?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
        ]);
        const mediaResult = await mediaResponse.json();
        const automationsResult = await automationsResponse.json();
        if (!mediaResponse.ok || !mediaResult.success) throw new Error(mediaResult.error || "دریافت محتوا ناموفق بود.");
        if (!automationsResponse.ok || !automationsResult.success) throw new Error(automationsResult.error || "دریافت اتوماسیون‌ها ناموفق بود.");

        const used = new Set(
          (Array.isArray(automationsResult.data) ? automationsResult.data : [])
            .filter((item: Automation) => item.triggerType === "COMMENT_KEYWORD" && item.mediaId)
            .map((item: Automation) => item.mediaId as string),
        );

        if (!cancelled) {
          setAccount(active);
          setMedia(
            (Array.isArray(mediaResult.data) ? mediaResult.data : []).filter(
              (item: MediaItem) =>
                item.media_product_type !== "STORY" &&
                ["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].includes(item.media_type || "") &&
                !used.has(item.id),
            ),
          );
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

  const visibleMedia = useMemo(
    () => media.filter((item) => filter === "ALL" || mediaType(item) === filter),
    [media, filter],
  );

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="در حال بارگذاری" />
      </div>
    );
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
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">انتخاب محتوا</h1>
        <p className="mt-2 text-sm text-muted-foreground">یک پست، ریلز یا آلبوم را برای پاسخ خودکار کامنت انتخاب کنید.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ["ALL", "همه"],
            ["POST", "پست"],
            ["REEL", "ریلز"],
            ["ALBUM", "آلبوم"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${filter === value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {visibleMedia.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed bg-card px-6 py-20 text-center">
            <ImageIcon className="mx-auto text-muted-foreground" size={25} />
            <h2 className="mt-4 text-sm font-bold">محتوای قابل انتخابی وجود ندارد</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">محتواهایی که قبلاً پاسخ خودکار دارند در این لیست نمایش داده نمی‌شوند.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {visibleMedia.map((item) => {
              const image = item.thumbnail_url || item.media_url;
              return (
                <button key={item.id} type="button" onClick={() => router.push("/dashboard/comment-automation/new/configure?mediaId=" + encodeURIComponent(item.id))} className="group relative aspect-square overflow-hidden rounded-2xl bg-muted text-right transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-primary">
                  {image && !mediaFailed[item.id] ? (
                    <img src={image} alt={item.caption || mediaLabel(item)} className="h-full w-full object-cover" loading="lazy" onError={() => setMediaFailed((current) => ({ ...current, [item.id]: true }))} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">{item.media_type === "VIDEO" ? <Video size={25} className="text-muted-foreground" /> : <ImageIcon size={25} className="text-muted-foreground" />}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2.5 pt-10">
                    <div className="flex items-center justify-between gap-2 text-white">
                      <span className="rounded-lg bg-black/35 px-2 py-1 text-[10px] font-semibold backdrop-blur-sm">{mediaLabel(item)}</span>
                      {item.media_type === "VIDEO" && <Play size={13} fill="currentColor" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
