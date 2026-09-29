"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check, Image as ImageIcon, Loader2, MessageCircle, Send, UserRoundCheck, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type MediaItem = { id: string; caption?: string; media_type?: string; media_product_type?: string; media_url?: string | null; thumbnail_url?: string | null };
type Automation = { id: string; mediaId: string | null; triggerType: string };

function mediaLabel(item: MediaItem) {
  return item.media_product_type === "REELS" ? "ریلز" : "پست";
}

function getMediaImage(item: MediaItem) {
  return item.thumbnail_url || item.media_url || null;
}

export default function CommentAutomationCreateConfigure() {
  const router = useRouter();
  const params = useSearchParams();
  const mediaId = params.get("mediaId");

  const [account, setAccount] = useState<Account | null>(null);
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [commentReply, setCommentReply] = useState("");
  const [sendDm, setSendDm] = useState(false);
  const [dmReply, setDmReply] = useState("");
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState("برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!mediaId) {
        setError("محتوا انتخاب نشده است.");
        setLoading(false);
        return;
      }
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");
        const active = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : []).find((item: Account) => item.isConnected) ?? null;
        if (!active) throw new Error("پیج اینستاگرام متصل نیست.");

        const [mediaResponse, automationsResponse] = await Promise.all([
          fetch("/api/instagram/media?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(active.id), { cache: "no-store", credentials: "include" }),
        ]);
        const mediaResult = await mediaResponse.json();
        const automationsResult = await automationsResponse.json();
        if (!mediaResponse.ok || !mediaResult.success) throw new Error(mediaResult.error || "دریافت محتوا ناموفق بود.");
        if (!automationsResponse.ok || !automationsResult.success) throw new Error(automationsResult.error || "دریافت اتوماسیون‌ها ناموفق بود.");

        const selected = (Array.isArray(mediaResult.data) ? mediaResult.data : []).find((item: MediaItem) => item.id === mediaId) ?? null;
        if (!selected) throw new Error("این محتوا دیگر در پیج پیدا نشد.");
        const existing = (Array.isArray(automationsResult.data) ? automationsResult.data : []).find((item: Automation) => item.triggerType === "COMMENT_KEYWORD" && item.mediaId === mediaId);
        if (existing) {
          router.replace("/dashboard/comment-automation/" + existing.id);
          return;
        }
        if (!cancelled) {
          setAccount(active);
          setMedia(selected);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت اطلاعات ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [mediaId, router]);

  function addKeyword() {
    const value = keywordInput.trim();
    if (!value) return;
    if (!keywords.some((item) => item.toLowerCase() === value.toLowerCase())) setKeywords((current) => [...current, value]);
    setKeywordInput("");
  }

  async function save() {
    if (!account || !media || saving) return;
    setError("");
    if (!keywords.length) return setError("حداقل یک کلمه کلیدی وارد کنید.");
    if (!commentReply.trim() && !sendDm && !requireFollow) return setError("حداقل یکی از پاسخ کامنت، پاسخ دایرکت یا اجبار به فالو را فعال کنید.");
    if (sendDm && !dmReply.trim()) return setError("متن پاسخ دایرکت را وارد کنید.");
    if (requireFollow && !followGateText.trim()) return setError("متن درخواست فالو را وارد کنید.");

    try {
      setSaving(true);
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          triggerType: "COMMENT_KEYWORD",
          mediaId: media.id,
          keyword: keywords.join(", "),
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
        router.replace("/dashboard/comment-automation/" + result.data.id);
        return;
      }
      if (!response.ok || !result.success) throw new Error(result.error || result.message || "ساخت پاسخ خودکار ناموفق بود.");
      router.push("/dashboard/comment-automation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخت پاسخ خودکار ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div dir="rtl" className="mx-auto w-full max-w-[1200px] animate-pulse">
      <div className="mb-5 h-8 w-44 rounded-lg bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="h-[460px] rounded-3xl bg-muted" />
        <div className="space-y-4"><div className="h-32 rounded-3xl bg-muted" /><div className="h-44 rounded-3xl bg-muted" /><div className="h-44 rounded-3xl bg-muted" /></div>
      </div>
    </div>
  );

  if (!media || !account) return (
    <div dir="rtl" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">{error || "محتوا پیدا نشد."}</div>
  );

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-5">
          <div className="flex justify-start">
            <button type="button" onClick={() => router.back()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <ArrowRight size={18} /> بازگشت
            </button>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">پاسخ جدید</h1>
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm lg:sticky lg:top-5">
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><MessageCircle size={19} className="text-muted-foreground" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{mediaLabel(media)}</p>
                  <p className="truncate text-sm font-semibold">@{account.igUsername}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl bg-muted">
                <div className="aspect-square w-full">
                  {getMediaImage(media) ? <img src={getMediaImage(media) || ""} alt={media.caption || mediaLabel(media)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">پیش‌نمایش در دسترس نیست</div>}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">محتوای انتخاب‌شده</p>
                <p className="mt-1 text-sm font-semibold">{mediaLabel(media)}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4"><h2 className="text-base font-bold">کلمات کلیدی</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">هر کلمه را جداگانه اضافه کنید.</p></div>
              <div className="flex gap-2">
                <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="مثلاً قیمت" className="h-12 rounded-xl text-sm" />
                <Button type="button" variant="outline" onClick={addKeyword} className="h-12 shrink-0 rounded-xl px-4"><Plus size={16} /> افزودن</Button>
              </div>
              {keywords.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{keywords.map((keyword) => (
                <span key={keyword} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium">
                  {keyword}
                  <button type="button" onClick={() => setKeywords((current) => current.filter((item) => item !== keyword))} className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"><X size={13} /></button>
                </span>
              ))}</div>}
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><MessageCircle size={17} /></div><div><h2 className="text-base font-bold">پاسخ کامنت</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">پاسخ عمومی که زیر کامنت کاربر ارسال می‌شود.</p></div></div>
              <Textarea value={commentReply} onChange={(e) => setCommentReply(e.target.value)} placeholder="متن پاسخ کامنت..." className="min-h-28 resize-none rounded-xl text-sm leading-6" />
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><Send size={17} /></div><div className="min-w-0 flex-1"><h2 className="text-base font-bold">پاسخ دایرکت</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">بعد از کامنت، یک پیام خصوصی متنی برای کاربر ارسال شود.</p></div><input type="checkbox" checked={sendDm} onChange={(e) => setSendDm(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" aria-label="فعال کردن پاسخ دایرکت" /></div>
              <Textarea value={dmReply} onChange={(e) => setDmReply(e.target.value)} disabled={!sendDm} placeholder="متن پاسخ دایرکت..." className="min-h-28 resize-none rounded-xl text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3"><input type="checkbox" checked={requireFollow} onChange={(e) => setRequireFollow(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" aria-label="فعال کردن اجبار به فالو" /><div className="min-w-0 flex-1"><h2 className="text-base font-bold">اجبار به فالو</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">اگر فعال باشد، قبل از ارسال محتوای اصلی ابتدا پیام درخواست فالو برای کاربر ارسال می‌شود.</p></div></div>
              {requireFollow && <div className="mt-4 border-t border-border/70 pt-4"><label className="mb-2 block text-sm font-medium">متن درخواست فالو</label><Textarea value={followGateText} onChange={(e) => setFollowGateText(e.target.value)} placeholder="برای دریافت این محتوا ابتدا پیج ما را فالو کنید." className="min-h-24 resize-none rounded-xl text-sm leading-6" /></div>}
            </div>

            <Button type="button" onClick={() => void save()} disabled={saving} className="min-h-12 w-full rounded-2xl text-sm font-semibold shadow-sm">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
              {saving ? "در حال ساخت..." : "ساخت پاسخ خودکار"}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
