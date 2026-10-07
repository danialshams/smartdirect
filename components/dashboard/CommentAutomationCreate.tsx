"use client";

import { ArrowRight, Image as ImageIcon, Images, Loader2, Play, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/DashboardUI";

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
      <div dir="rtl" className="flex min-h-[50vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#2563EB]" aria-label="در حال بارگذاری" /></div>
    );
  }

  if (!account) {
    return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-dashed bg-card px-6 py-16 text-center text-sm text-muted-foreground">{error || "پیج اینستاگرام متصل نیست."}</div>;
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-2xl">
        <Button type="button" onClick={() => router.back()} className="mb-9 min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"><ArrowRight size={15} strokeWidth={2} />بازگشت</Button>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">انتخاب محتوا</h1>
        <p className="mt-2 text-xs leading-5 text-[#64748B] sm:text-sm">یک پست، ریلز یا آلبوم را برای پاسخ خودکار کامنت انتخاب کنید.</p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {([
            ["ALL", "همه", ImageIcon],
            ["POST", "پست", ImageIcon],
            ["ALBUM", "آلبوم", Images],
            ["REEL", "ریلز", Video],
          ] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={"inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition " + (filter === value ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]")}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {visibleMedia.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-16 text-center">
            <ImageIcon className="mx-auto text-muted-foreground" size={25} />
            <h2 className="mt-4 text-sm font-bold">محتوای قابل انتخابی وجود ندارد</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">محتواهایی که قبلاً پاسخ خودکار دارند در این لیست نمایش داده نمی‌شوند.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleMedia.map((item) => {
              const image = item.thumbnail_url || item.media_url;
              return (
                <button key={item.id} type="button" onClick={() => router.push("/dashboard/comment-automation/new/configure?mediaId=" + encodeURIComponent(item.id))} className="group relative aspect-square overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] text-right transition hover:border-[#BFDBFE] focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
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
