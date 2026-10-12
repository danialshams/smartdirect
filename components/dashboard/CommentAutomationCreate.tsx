"use client";

import { ArrowRight, Image as ImageIcon, Images, Play, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DashboardLoading } from "@/components/dashboard/DashboardUI";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  timestamp?: string | null;
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
      <DashboardLoading label="در حال دریافت محتوا..." className="dashboard-loading--page" />
    );
  }

  if (!account) {
    return <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-dashed bg-card px-6 py-16 text-center text-sm text-muted-foreground">{error || "پیج اینستاگرام متصل نیست."}</div>;
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-9">
          <Button type="button" onClick={() => router.back()} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"><ArrowRight size={15} strokeWidth={2} />بازگشت</Button>
        </div>
        <section className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><ImageIcon size={19} /></span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#0F172A]">انتخاب محتوا</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B] sm:text-sm">یک پست، ریلز یا آلبوم را برای پاسخ خودکار کامنت انتخاب کنید.</p>
            </div>
          </div>
        </section>

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
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
            {visibleMedia.map((item) => {
              const image = item.thumbnail_url || item.media_url;
              const publishedDate = item.timestamp ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.timestamp)) : null;
              return (
                <button key={item.id} type="button" onClick={() => router.push("/dashboard/comment-automation/new/configure?mediaId=" + encodeURIComponent(item.id))} className="group block w-full min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] lg:rounded-xl lg:shadow-none lg:hover:translate-y-0 lg:hover:shadow-none">
                  <div className="relative aspect-square overflow-hidden bg-[#F1F5F9] lg:rounded-xl">
                    {image && !mediaFailed[item.id] ? (
                      <img src={image} alt={item.caption || mediaLabel(item)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="lazy" onError={() => setMediaFailed((current) => ({ ...current, [item.id]: true }))} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">{item.media_type === "VIDEO" ? <Video size={25} className="text-[#64748B]" /> : <ImageIcon size={25} className="text-[#64748B]" />}</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                    <span className="absolute right-2.5 top-2.5 inline-flex h-7 items-center gap-1 rounded-full bg-white/95 px-2 text-[10px] font-bold text-[#0F172A] shadow-sm">
                      {item.media_type === "VIDEO" ? <Video size={11} /> : item.media_type === "CAROUSEL_ALBUM" ? <Images size={11} /> : <ImageIcon size={11} />}
                      {mediaLabel(item)}
                    </span>
                    {item.media_type === "VIDEO" && <Play size={14} fill="currentColor" className="absolute bottom-3 left-3 text-white drop-shadow" />}
                  </div>
                  <div className="p-3 text-right">
                    <p className="mb-2 min-h-10 overflow-hidden text-left text-[11px] leading-[1.8] text-[#0F172A] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{item.caption?.trim() || "بدون کپشن"}</p>
                    <div className="flex items-center justify-end">
                      {publishedDate && <span className="text-[9.5px] font-medium text-[#64748B]">{publishedDate}</span>}
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
