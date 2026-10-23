"use client";

import { ArrowRight, Image as ImageIcon, Images, Play, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DashboardLoading } from "@/components/dashboard/DashboardUI";
import { dairaPalette } from "../../lib/design-system/palette";

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
  return type === "REEL" ? "ریلز" : type === "ALBUM" ? "پست اسلایدی" : "پست";
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
    return <div dir="rtl" className="mx-auto max-w-xl rounded-[24px] border border-dashed border-[var(--daira-outline)] bg-white px-6 py-16 text-center text-sm text-[var(--daira-text-secondary)]">{error || "پیج اینستاگرام متصل نیست."}</div>;
  }

  return (
    <div dir="rtl" style={{ backgroundColor: dairaPalette.background.page }} className="min-h-[calc(100dvh-2rem)] rounded-[28px] p-2 sm:p-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="mb-1">
          <Button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--daira-border)] bg-white px-3.5 text-xs font-bold text-[var(--daira-text-secondary)] shadow-sm transition hover:border-[#BFDBFE] hover:bg-[var(--daira-outline-hover-bg)] hover:text-[var(--daira-primary)]"
          >
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </Button>
        </div>
        <section className="mb-4 rounded-[24px] border border-[#E6ECF5] bg-white p-4 shadow-[0_4px_20px_rgba(24,35,60,0.035)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><ImageIcon size={21} /></span>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-[var(--daira-heading)]">انتخاب محتوا</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--daira-outline-hover-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--daira-primary)]">گام ۱ از ۳</span><span className="rounded-full bg-[var(--daira-neutral-bg)] px-2.5 py-1 text-[10px] font-medium text-[var(--daira-text-secondary)]">پاسخ خودکار کامنت</span></div>
              <p className="mt-1.5 text-xs leading-5 text-[var(--daira-text-secondary)] sm:text-sm">یک پست، ریلز یا پست اسلایدی را برای پاسخ خودکار کامنت انتخاب کنید.</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#E6ECF5] bg-white p-4 shadow-[0_3px_14px_rgba(24,35,60,0.025)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--daira-heading)]">محتواهای قابل انتخاب</p>
              <p className="mt-1 text-[10.5px] text-[var(--daira-text-secondary)]">نوع محتوایی را که می‌خواهی برای آن پاسخ خودکار بسازی انتخاب کن.</p>
            </div>
            <div className="mb-0 flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="فیلتر نوع محتوا">
              {([
                ["ALL", "همه", ImageIcon],
                ["POST", "پست", ImageIcon],
                ["REEL", "ریلز", Video],
                ["ALBUM", "پست اسلایدی", Images],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold transition ${filter === value ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)] shadow-sm" : "border-[#E6ECF5] bg-white text-[var(--daira-text-secondary)] hover:border-[#BFDBFE] hover:bg-[var(--daira-surface-hover)]"}`}
                >
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {visibleMedia.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--daira-outline)] bg-[var(--daira-surface-hover)] px-6 py-16 text-center">
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
                <button key={item.id} type="button" onClick={() => router.push("/dashboard/comment-automation/new/configure?mediaId=" + encodeURIComponent(item.id))} className="group block w-full min-w-0 overflow-hidden rounded-[20px] border border-[#E6ECF5] bg-white text-right shadow-[0_3px_12px_rgba(24,35,60,0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_12px_28px_rgba(24,35,60,0.08)] focus:outline-none focus:ring-2 focus:ring-[var(--daira-primary)]/30">
                  <div className="relative aspect-square overflow-hidden bg-[var(--daira-neutral-bg)]">
                    {image && !mediaFailed[item.id] ? (
                      <img src={image} alt={item.caption || mediaLabel(item)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="lazy" onError={() => setMediaFailed((current) => ({ ...current, [item.id]: true }))} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">{item.media_type === "VIDEO" ? <Video size={25} className="text-[var(--daira-text-secondary)]" /> : <ImageIcon size={25} className="text-[var(--daira-text-secondary)]" />}</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                    <span className="absolute right-2.5 top-2.5 inline-flex h-7 items-center gap-1 rounded-full border border-white/70 bg-white/95 px-2.5 text-[10px] font-bold text-[var(--daira-heading)] shadow-sm">
                      {item.media_type === "VIDEO" ? <Video size={11} /> : item.media_type === "CAROUSEL_ALBUM" ? <Images size={11} /> : <ImageIcon size={11} />}
                      {mediaLabel(item)}
                    </span>
                    {item.media_type === "VIDEO" && <Play size={14} fill="currentColor" className="absolute bottom-3 left-3 text-white drop-shadow" />}
                  </div>
                  <div className="p-3.5 text-right">
                    <p className="mb-2 min-h-10 overflow-hidden text-right text-[11px] font-medium leading-[1.8] text-[var(--daira-heading)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{item.caption?.trim() || "بدون کپشن"}</p>
                    <div className="flex items-center justify-end">
                      {publishedDate && <span className="text-[9.5px] font-medium text-[var(--daira-text-secondary)]">{publishedDate}</span>}
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
