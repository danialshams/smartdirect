"use client";

import { Button } from "@/components/dashboard/DashboardUI";
import { Input } from "@/components/dashboard/DashboardUI";
import { Textarea } from "@/components/dashboard/DashboardUI";
import {
  ArrowRight,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Play,
  Search,
  Send,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
};

type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  permalink?: string;
  timestamp?: string;
};

type Automation = {
  id: string;
  instagramAccountId: string;
  triggerType: string;
  mediaId: string | null;
};

function isSelectableMedia(item: MediaItem) {
  if (item.media_product_type === "STORY") return false;
  return item.media_type === "IMAGE" || item.media_type === "VIDEO" || item.media_type === "CAROUSEL_ALBUM";
}

function mediaLabel(item: MediaItem) {
  if (item.media_product_type === "REELS") return "ریلز";
  return "پست";
}

function getMediaImage(item: MediaItem) {
  return item.thumbnail_url || item.media_url || null;
}

export default function CommentAutomationCreate() {
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [duplicate, setDuplicate] = useState<Automation | null>(null);
  const [duplicateMedia, setDuplicateMedia] = useState<MediaItem | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mediaFailed, setMediaFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const accountsResponse = await fetch("/api/instagram/accounts", {
          cache: "no-store",
          credentials: "include",
        });
        const accountsResult = await accountsResponse.json();

        if (!accountsResponse.ok || !accountsResult.success) {
          throw new Error(
            accountsResult.error || accountsResult.message || "دریافت پیج اینستاگرام ناموفق بود.",
          );
        }

        const activeAccount =
          (Array.isArray(accountsResult.accounts)
            ? accountsResult.accounts
            : []
          ).find((item: Account) => item.isConnected) ?? null;

        if (!activeAccount) {
          if (!cancelled) {
            setAccount(null);
            setMedia([]);
            setAutomations([]);
          }
          return;
        }

        const [mediaResponse, automationsResponse] = await Promise.all([
          fetch(
            `/api/instagram/media?instagramAccountId=${encodeURIComponent(activeAccount.id)}`,
            { cache: "no-store", credentials: "include" },
          ),
          fetch(
            `/api/automations?instagramAccountId=${encodeURIComponent(activeAccount.id)}`,
            { cache: "no-store", credentials: "include" },
          ),
        ]);

        const mediaResult = await mediaResponse.json();
        const automationsResult = await automationsResponse.json();

        if (!mediaResponse.ok || !mediaResult.success) {
          throw new Error(
            mediaResult.error || mediaResult.message || "دریافت پست‌ها ناموفق بود.",
          );
        }

        if (!automationsResponse.ok || !automationsResult.success) {
          throw new Error(
            automationsResult.error ||
              automationsResult.message ||
              "دریافت اتوماسیون‌ها ناموفق بود.",
          );
        }

        if (!cancelled) {
          setAccount(activeAccount);
          setMedia(
            (Array.isArray(mediaResult.data) ? mediaResult.data : []).filter(
              isSelectableMedia,
            ),
          );
          setAutomations(
            (Array.isArray(automationsResult.data)
              ? automationsResult.data
              : []
            ).filter(
              (item: Automation) =>
                item.triggerType === "COMMENT_KEYWORD" && Boolean(item.mediaId),
            ),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "دریافت اطلاعات ناموفق بود.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return media;

    return media.filter((item) => {
      const caption = item.caption?.toLowerCase() || "";
      return (
        caption.includes(query) ||
        mediaLabel(item).toLowerCase().includes(query)
      );
    });
  }, [media, search]);

  function selectMedia(item: MediaItem) {
    setError("");
    const existing = automations.find(
      (automation) =>
        automation.mediaId === item.id &&
        automation.triggerType === "COMMENT_KEYWORD",
    );

    if (existing) {
      setDuplicate(existing);
      setDuplicateMedia(item);
      return;
    }

    router.push(
      `/dashboard/comment-automation/new/configure?mediaId=${encodeURIComponent(item.id)}`,
    );
  }


  if (loading) {
    return (
      <div dir="rtl" className="mx-auto w-full max-w-[1400px] animate-pulse">
        <div className="mb-5 h-8 w-48 rounded-lg bg-muted" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="rounded-3xl border bg-card p-4">
            <div className="mb-5 h-11 rounded-xl bg-muted" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="aspect-square rounded-2xl bg-muted" />
              ))}
            </div>
          </div>
          <div className="h-[520px] rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-dashed bg-card px-6 py-20 text-center">
        <ImageIcon className="mx-auto text-muted-foreground" size={25} />
        <h1 className="mt-4 text-base font-bold">پیج اینستاگرام متصل نیست</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          برای ساخت پاسخ خودکار ابتدا یک پیج اینستاگرام متصل کنید.
        </p>
        <Button
          type="button"
          onClick={() => router.back()}
          className="mt-5 rounded-xl"
        >
          بازگشت
        </Button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-5">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ArrowRight size={18} />
              بازگشت
            </button>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            پاسخ جدید
          </h1>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {error}
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <section className="rounded-3xl border border-border/80 bg-card shadow-sm">
            <div className="border-b border-border/70 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      محتوای موردنظر را بر اساس کپشن پیدا کنید.
                    </p>
                  </div>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="بخشی از متن کپشن را وارد کنید..."
                    className="h-10 rounded-xl pr-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {filteredMedia.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <ImageIcon className="mx-auto text-muted-foreground" size={25} />
                <h3 className="mt-4 text-sm font-bold">
                  {search ? "محتوایی پیدا نشد" : "پست یا ریلزی پیدا نشد"}
                </h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {search
                    ? "بخشی از متن کپشن را تغییر دهید."
                    : "برای این پیج هنوز محتوای قابل انتخابی دریافت نشده است."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4">
                {filteredMedia.map((item) => {
                  const imageUrl = getMediaImage(item);
                  const hasAutomation = automations.some(
                    (automation) =>
                      automation.mediaId === item.id &&
                      automation.triggerType === "COMMENT_KEYWORD",
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectMedia(item)}
                      className={[
                        "group relative aspect-square overflow-hidden rounded-2xl bg-muted text-right transition",
                        "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-primary",
                      ].join(" ")}
                    >
                      {imageUrl && !mediaFailed[item.id] ? (
                        <img
                          src={imageUrl}
                          alt={item.caption || mediaLabel(item)}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={() =>
                            setMediaFailed((current) => ({
                              ...current,
                              [item.id]: true,
                            }))
                          }
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {item.media_type === "VIDEO" ? (
                            <Video size={25} className="text-muted-foreground" />
                          ) : (
                            <ImageIcon size={25} className="text-muted-foreground" />
                          )}
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2.5 pt-10">
                        <div className="flex items-center justify-between gap-2 text-white">
                          <span className="rounded-lg bg-black/35 px-2 py-1 text-[10px] font-semibold backdrop-blur-sm">
                            {mediaLabel(item)}
                          </span>
                          {item.media_type === "VIDEO" && (
                            <Play size={13} fill="currentColor" />
                          )}
                        </div>
                      </div>

                      {hasAutomation && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                          <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-foreground shadow-lg">
                            قبلاً انتخاب شده
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>


        </div>
      </div>

      {duplicate && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDuplicate(null);
          }}
        >
          <div className="w-full max-w-[390px] rounded-[28px] border border-border/80 bg-background p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Check size={20} />
            </div>
            <h2 className="mt-5 text-base font-bold">
              این {duplicateMedia ? mediaLabel(duplicateMedia) : "محتوا"} قبلاً انتخاب شده
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              برای این {duplicateMedia ? mediaLabel(duplicateMedia) : "محتوا"} قبلاً پاسخ خودکار کامنت ساخته‌اید. برای تغییر تنظیمات، وارد صفحه ویرایش همان پاسخ شوید.
            </p>
            <div className="mt-6 flex gap-2">
              <Button
                type="button"
                onClick={() =>
                  router.push(
                    `/dashboard/comment-automation/${duplicate.id}`,
                  )
                }
                className="min-h-11 flex-1 rounded-xl text-sm font-semibold"
              >
                رفتن به ویرایش
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDuplicate(null);
                  setDuplicateMedia(null);
                }}
                className="min-h-11 rounded-xl text-sm"
              >
                انصراف
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
