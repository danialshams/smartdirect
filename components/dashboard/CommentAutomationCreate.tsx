"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const [keywords, setKeywords] = useState("");
  const [commentReply, setCommentReply] = useState("");
  const [sendDm, setSendDm] = useState(false);
  const [dmReply, setDmReply] = useState("");
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState(
    "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.",
  );

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Automation | null>(null);
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

  const existingAutomation = useMemo(() => {
    if (!selectedMedia) return null;
    return (
      automations.find(
        (item) =>
          item.mediaId === selectedMedia.id &&
          item.triggerType === "COMMENT_KEYWORD",
      ) ?? null
    );
  }, [automations, selectedMedia]);

  function selectMedia(item: MediaItem) {
    setError("");
    const existing = automations.find(
      (automation) =>
        automation.mediaId === item.id &&
        automation.triggerType === "COMMENT_KEYWORD",
    );

    if (existing) {
      setDuplicate(existing);
      return;
    }

    setSelectedMedia(item);
  }

  function resetEditor() {
    setSelectedMedia(null);
    setKeywords("");
    setCommentReply("");
    setSendDm(false);
    setDmReply("");
    setRequireFollow(false);
    setFollowGateText("برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
    setError("");
  }

  async function save() {
    if (!account || !selectedMedia || saving) return;

    setError("");

    const normalizedKeywords = keywords
      .split(/[,،;؛\n]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .filter(
        (value, index, list) =>
          list.findIndex(
            (item) => item.toLowerCase() === value.toLowerCase(),
          ) === index,
      )
      .join(", ");

    if (!normalizedKeywords) {
      setError("حداقل یک کلمه کلیدی وارد کنید.");
      return;
    }

    if (!commentReply.trim() && !sendDm && !requireFollow) {
      setError("حداقل یکی از پاسخ کامنت، پاسخ دایرکت یا اجبار به فالو را فعال کنید.");
      return;
    }

    if (sendDm && !dmReply.trim()) {
      setError("متن پاسخ دایرکت را وارد کنید.");
      return;
    }

    if (requireFollow && !followGateText.trim()) {
      setError("متن درخواست فالو را وارد کنید.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          triggerType: "COMMENT_KEYWORD",
          mediaId: selectedMedia.id,
          keyword: normalizedKeywords,
          commentReplyText: commentReply.trim() || null,
          sendDm: sendDm && Boolean(dmReply.trim()),
          replyText: sendDm ? dmReply.trim() || null : null,
          requireFollow,
          followGateText: requireFollow ? followGateText.trim() : null,
          isActive: true,
        }),
      });

      const result = await response.json();

      if (response.status === 409 && result.data?.id) {
        setDuplicate(result.data as Automation);
        setAutomations((current) => [
          ...current,
          result.data as Automation,
        ]);
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || result.message || "ساخت پاسخ خودکار ناموفق بود.",
        );
      }

      router.push("/dashboard/comment-automation");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "ساخت پاسخ خودکار ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
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
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              پاسخ جدید
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              یک پست یا ریلز را انتخاب کنید و پاسخ خودکار آن را تنظیم کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowRight size={18} />
            بازگشت
          </button>
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
                  <h2 className="text-base font-bold">انتخاب محتوا</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    فقط پست‌ها و ریلزهای پیج @{account.igUsername} نمایش داده می‌شوند.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="جستجوی محتوا..."
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
                    ? "عبارت جستجو را تغییر دهید."
                    : "برای این پیج هنوز محتوای قابل انتخابی دریافت نشده است."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4">
                {filteredMedia.map((item) => {
                  const imageUrl = getMediaImage(item);
                  const isSelected = selectedMedia?.id === item.id;
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
                        isSelected ? "ring-2 ring-primary" : "hover:scale-[1.01]",
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

          <section className="rounded-3xl border border-border/80 bg-card shadow-sm lg:sticky lg:top-5">
            {!selectedMedia ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <MessageCircle size={23} />
                </div>
                <h2 className="mt-4 text-base font-bold">محتوا را انتخاب کنید</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  بعد از انتخاب یک پست یا ریلز، تنظیمات پاسخ کامنت، دایرکت و اجبار به فالو در اینجا نمایش داده می‌شود.
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {getMediaImage(selectedMedia) ? (
                      <img
                        src={getMediaImage(selectedMedia) || ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon size={18} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      محتوای انتخاب‌شده
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {mediaLabel(selectedMedia)} · @{account.igUsername}
                    </p>
                  </div>
                </div>

                {existingAutomation ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-900">
                      این محتوا قبلاً برای پاسخ خودکار انتخاب شده است.
                    </p>
                    <p className="mt-2 text-xs leading-6 text-amber-800">
                      برای تغییر کلمات کلیدی، پاسخ کامنت، دایرکت یا اجبار به فالو، از صفحه ویرایش همین اتوماسیون استفاده کنید.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/dashboard/comment-automation/${existingAutomation.id}`,
                          )
                        }
                        className="min-h-10 flex-1 rounded-xl text-xs font-semibold"
                      >
                        رفتن به ویرایش
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetEditor}
                        className="min-h-10 rounded-xl text-xs"
                      >
                        انتخاب دیگر
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/70 p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <MessageCircle size={17} />
                        <div>
                          <h3 className="text-sm font-bold">کلمات کلیدی</h3>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            چند کلمه را با ویرگول جدا کنید.
                          </p>
                        </div>
                      </div>
                      <Input
                        value={keywords}
                        onChange={(event) => setKeywords(event.target.value)}
                        placeholder="مثلاً قیمت، خرید، اطلاعات"
                        className="h-11 rounded-xl text-sm"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <MessageCircle size={17} />
                        <div>
                          <h3 className="text-sm font-bold">پاسخ کامنت</h3>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            پاسخ عمومی زیر کامنت کاربر.
                          </p>
                        </div>
                      </div>
                      <Textarea
                        value={commentReply}
                        onChange={(event) => setCommentReply(event.target.value)}
                        placeholder="متن پاسخ کامنت..."
                        className="min-h-24 resize-none rounded-xl text-sm leading-6"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Send size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold">پاسخ دایرکت</h3>
                          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                            بعد از کامنت، یک پیام خصوصی متنی ارسال شود.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={sendDm}
                          onChange={(event) => setSendDm(event.target.checked)}
                          className="mt-1 h-5 w-5 shrink-0"
                          aria-label="فعال کردن پاسخ دایرکت"
                        />
                      </div>

                      <Textarea
                        value={dmReply}
                        onChange={(event) => setDmReply(event.target.value)}
                        disabled={!sendDm}
                        placeholder="متن پاسخ دایرکت..."
                        className="mt-3 min-h-24 resize-none rounded-xl text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={requireFollow}
                          onChange={(event) =>
                            setRequireFollow(event.target.checked)
                          }
                          className="mt-1 h-5 w-5 shrink-0"
                          aria-label="فعال کردن اجبار به فالو"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <UserRoundCheck size={17} />
                            <h3 className="text-sm font-bold">اجبار به فالو</h3>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            قبل از ادامه Flow، پیام درخواست فالو ارسال شود.
                          </p>
                        </div>
                      </div>

                      {requireFollow && (
                        <Textarea
                          value={followGateText}
                          onChange={(event) =>
                            setFollowGateText(event.target.value)
                          }
                          placeholder="برای دریافت این محتوا ابتدا پیج ما را فالو کنید."
                          className="mt-3 min-h-20 resize-none rounded-xl text-sm leading-6"
                        />
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetEditor}
                        disabled={saving}
                        className="min-h-12 rounded-xl px-4 text-sm"
                      >
                        انصراف
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving}
                        className="min-h-12 flex-1 rounded-xl text-sm font-semibold"
                      >
                        {saving ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Check size={17} />
                        )}
                        {saving ? "در حال ساخت..." : "ساخت پاسخ خودکار"}
                      </Button>
                    </div>
                  </div>
                )}
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
            <h2 className="mt-5 text-base font-bold">این محتوا قبلاً انتخاب شده</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              برای این پست یا ریلز قبلاً پاسخ خودکار کامنت ساخته‌اید. برای تغییر تنظیمات، وارد صفحه ویرایش همان پاسخ شوید.
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
                onClick={() => setDuplicate(null)}
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
