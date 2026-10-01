"use client";

import { Button } from "@/components/dashboard/DashboardUI";
import { Input } from "@/components/dashboard/DashboardUI";
import { Textarea } from "@/components/dashboard/DashboardUI";
import { ArrowRight, Check, Loader2, MessageCircle, Plus, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AutomationMessage = {
  id: string;
  messageType: string;
  text: string | null;
  order: number;
};

type Automation = {
  id: string;
  instagramAccountId: string;
  triggerType: string;
  mediaId: string | null;
  keyword: string | null;
  commentReplyText: string | null;
  replyText: string | null;
  sendDm: boolean;
  requireFollow: boolean;
  followGateText: string | null;
  isActive: boolean;
  messages?: AutomationMessage[];
  instagramAccount?: {
    id: string;
    igUserId: string;
    igUsername: string;
    isConnected: boolean;
  };
};

type MediaPreview = {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "UNKNOWN";
};

function getExistingDmText(item: Automation) {
  if (item.replyText?.trim()) return item.replyText;

  const firstTextMessage = [...(item.messages ?? [])]
    .sort((a, b) => a.order - b.order)
    .find((message) => message.messageType === "TEXT" && message.text?.trim());

  return firstTextMessage?.text ?? "";
}

export default function CommentAutomationEditor({ id }: { id: string }) {
  const router = useRouter();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [commentReply, setCommentReply] = useState("");
  const [dmReply, setDmReply] = useState("");
  const [sendDm, setSendDm] = useState(false);
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState("");
  const [loading, setLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/automations/${encodeURIComponent(id)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || result.message || "دریافت اتوماسیون ناموفق بود.");
        }

        const item = result.data as Automation;
        if (item.triggerType !== "COMMENT_KEYWORD") {
          throw new Error("این صفحه فقط برای پاسخ خودکار کامنت است.");
        }

        const existingDmText = getExistingDmText(item);

        if (!cancelled) {
          setAutomation(item);
          setKeywords(
            (item.keyword || "")
              .split(/[,،;؛\n]+/)
              .map((v) => v.trim())
              .filter(Boolean)
              .filter(
                (value, index, list) =>
                  list.findIndex(
                    (item) => item.toLowerCase() === value.toLowerCase(),
                  ) === index,
              ),
          );
          setCommentReply(item.commentReplyText || "");
          setDmReply(existingDmText);
          setSendDm(Boolean(item.sendDm || existingDmText.trim()));
          setRequireFollow(Boolean(item.requireFollow));
          setFollowGateText(
            item.followGateText?.trim() ||
              "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.",
          );
        }

        if (!item.mediaId) {
          if (!cancelled) setMediaLoading(false);
          return;
        }

        const mediaResponse = await fetch(
          `/api/automations/media-preview?instagramAccountId=${encodeURIComponent(item.instagramAccountId)}&mediaId=${encodeURIComponent(item.mediaId)}`,
          { cache: "no-store", credentials: "include" },
        );
        const mediaResult = await mediaResponse.json();

        if (!cancelled && mediaResponse.ok && mediaResult.success) {
          setPreview(mediaResult.data as MediaPreview);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "دریافت اتوماسیون ناموفق بود.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setMediaLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const previewImage = useMemo(
    () => preview?.thumbnailUrl || preview?.mediaUrl || null,
    [preview],
  );

  async function save() {
    if (!automation || saving) return;

    setError("");
    setSaved(false);

    const normalizedKeywords = keywords.join(", ");

    if (!normalizedKeywords) {
      setError("حداقل یک کلمه کلیدی وارد کنید.");
      return;
    }

    if (!commentReply.trim() && !dmReply.trim() && !requireFollow) {
      setError("حداقل یک پاسخ کامنت، پاسخ دایرکت یا شرط فالو را فعال کنید.");
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

      const response = await fetch(`/api/automations/${encodeURIComponent(automation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          keyword: normalizedKeywords,
          commentReplyText: commentReply.trim() || null,
          replyText: sendDm ? dmReply.trim() || null : null,
          sendDm: sendDm && Boolean(dmReply.trim()),
          requireFollow,
          followGateText: requireFollow ? followGateText.trim() : null,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "ذخیره تغییرات ناموفق بود.");
      }

      const savedAutomation = result.data as Automation;
      setAutomation(savedAutomation);
      setDmReply(getExistingDmText(savedAutomation));
      setSendDm(Boolean(savedAutomation.sendDm || getExistingDmText(savedAutomation).trim()));
      setRequireFollow(Boolean(savedAutomation.requireFollow));
      setFollowGateText(
        savedAutomation.followGateText?.trim() ||
          "برای دریافت این محتوا ابتدا پیج ما را فالو کنید.",
      );
      setSaved(true);
      window.setTimeout(() => {
        router.push("/dashboard/comment-automation");
      }, 650);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ذخیره تغییرات ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div dir="rtl" className="mx-auto w-full max-w-[1200px] animate-pulse">
        <div className="mb-5 h-8 w-44 rounded-lg bg-muted" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="h-[460px] rounded-3xl bg-muted" />
          <div className="space-y-4">
            <div className="h-32 rounded-3xl bg-muted" />
            <div className="h-44 rounded-3xl bg-muted" />
            <div className="h-44 rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">
        {error || "اتوماسیون پیدا نشد."}
      </div>
    );
  }

  const accountName = automation.instagramAccount?.igUsername || "Instagram";

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-[1200px]">
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

          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">ویرایش پاسخ خودکار کامنت</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">تنظیمات پاسخ خودکار این پست را ویرایش کنید.</p>
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">ویرایش پاسخ خودکار کامنت</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">تنظیمات پاسخ خودکار این پست را ویرایش کنید.</p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm lg:sticky lg:top-5">
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <MessageCircle size={19} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">پست</p>
                  <p className="truncate text-sm font-semibold">@{accountName}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-muted">
                <div className="aspect-square w-full">
                  {mediaLoading ? (
                    <div className="h-full w-full animate-pulse bg-muted" />
                  ) : previewImage ? (
                    <img src={previewImage} alt="پست اینستاگرام" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                      پیش‌نمایش این پست در دسترس نیست
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="text-xs font-medium text-muted-foreground">کلمات کلیدی فعال</p>
                <p className="mt-1.5 break-words text-sm font-medium leading-6 text-foreground">
                  {keywords.length ? keywords.join("، ") : "بدون کلمه کلیدی"}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <h2 className="text-base font-bold">کلمات کلیدی</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">هر کلمه را جداگانه اضافه کنید.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const value = keywordInput.trim();
                      if (!value) return;
                      if (!keywords.some((item) => item.toLowerCase() === value.toLowerCase())) {
                        setKeywords((current) => [...current, value]);
                      }
                      setKeywordInput("");
                    }
                  }}
                  placeholder="مثلاً قیمت"
                  className="h-12 rounded-xl text-sm"
                  dir="rtl"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const value = keywordInput.trim();
                    if (!value) return;
                    if (!keywords.some((item) => item.toLowerCase() === value.toLowerCase())) {
                      setKeywords((current) => [...current, value]);
                    }
                    setKeywordInput("");
                  }}
                  className="h-12 shrink-0 rounded-xl px-4"
                >
                  <Plus size={16} />
                  افزودن
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium"
                    >
                      {keyword}
                      <button
                        type="button"
                        aria-label={"حذف کلمه کلیدی " + keyword}
                        onClick={() =>
                          setKeywords((current) => current.filter((item) => item !== keyword))
                        }
                        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><MessageCircle size={17} /></div>
                <div>
                  <h2 className="text-base font-bold">پاسخ کامنت</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">پاسخ عمومی که زیر کامنت کاربر ارسال می‌شود.</p>
                </div>
              </div>
              <Textarea value={commentReply} onChange={(event) => setCommentReply(event.target.value)} placeholder="متن پاسخ کامنت..." className="min-h-28 resize-none rounded-xl text-sm leading-6" />
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Send size={17} /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold">پاسخ دایرکت</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">بعد از کامنت، یک پیام خصوصی متنی برای کاربر ارسال شود.</p>
                </div>
                <Input type="checkbox" checked={sendDm} onChange={(event) => setSendDm(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" aria-label="فعال کردن پاسخ دایرکت" />
              </div>

              <Textarea value={dmReply} onChange={(event) => setDmReply(event.target.value)} disabled={!sendDm} placeholder="متن پاسخ دایرکت..." className="min-h-28 resize-none rounded-xl text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <Input type="checkbox" checked={requireFollow} onChange={(event) => setRequireFollow(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" aria-label="فعال کردن اجبار به فالو" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold">اجبار به فالو</h2>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">اگر فعال باشد، قبل از ارسال محتوای اصلی ابتدا پیام درخواست فالو برای کاربر ارسال می‌شود.</p>
                </div>
              </div>

              {requireFollow && (
                <div className="mt-4 border-t border-border/70 pt-4">
                  <label className="mb-2 block text-sm font-medium">متن درخواست فالو</label>
                  <Textarea value={followGateText} onChange={(event) => setFollowGateText(event.target.value)} placeholder="برای دریافت این محتوا ابتدا پیج ما را فالو کنید." className="min-h-24 resize-none rounded-xl text-sm leading-6" />
                </div>
              )}
            </div>

            <Button type="button" onClick={save} disabled={saving} className="min-h-12 w-full rounded-2xl text-sm font-semibold shadow-sm">
              {saving ? <Loader2 size={17} className="animate-spin" /> : saved ? <Check size={17} /> : null}
              {saving ? "در حال ذخیره..." : saved ? "ذخیره شد" : "ذخیره تغییرات"}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
