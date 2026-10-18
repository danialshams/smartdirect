"use client";

import { ArrowRight, Camera, MessageCircleReply, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/DashboardUI";
import PublishingStoryAutomationSetup from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import { dairaPalette } from "../../lib/design-system/palette";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";

type Props = {
  account: Account;
  mediaId: string;
  triggerType: TriggerType;
  title: string;
  description: string;
  onSaved: () => void;
};

function serializeQuickReplies(replies: QuickReplyDraft[]): unknown[] {
  return replies.map((reply) => ({
    id: reply.id,
    title: reply.title.trim(),
    payload: reply.payload,
    destinationType: reply.destinationType,
    destinationText: reply.destinationText.trim(),
    destinationFormId: reply.destinationFormId,
    destinationShowcaseId: reply.destinationShowcaseId,
    destinationMediaUrl: reply.destinationMediaUrl,
    destinationMediaId: reply.destinationMediaId,
    destinationQuestion: reply.destinationQuestion.trim(),
    question: reply.destinationQuestion.trim(),
    destinationQuickReplies: serializeQuickReplies(reply.destinationQuickReplies),
    nextMessageId: null,
  }));
}

export default function AutomationCreationFlow({ account, mediaId, triggerType, title, description, onSaved }: Props) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordMatchMode, setKeywordMatchMode] = useState<"EXACT" | "CONTAINS_ANY">("EXACT");
  const [mediaItems, setMediaItems] = useState<Array<{id:string; caption?:string; media_type?:string; media_product_type?:string; thumbnail_url?:string|null; media_url?:string|null; timestamp?:string}>>([]);
  const [mediaSelectionMode, setMediaSelectionMode] = useState<"ALL" | "SELECTED">(mediaId ? "SELECTED" : "ALL");
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(mediaId ? [mediaId] : []);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [commentReply, setCommentReply] = useState("");
  const [requireFollow, setRequireFollow] = useState(false);
  const [dmMode, setDmMode] = useState<"TEXT" | "TEXT_WITH_LINK">("TEXT");
  const [linkButtonUrl, setLinkButtonUrl] = useState("");
  const [linkButtonTitle, setLinkButtonTitle] = useState("مشاهده لینک");
  const [followGateText, setFollowGateText] = useState("برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.");
  const [message, setMessage] = useState<MessageDraft>(() => createEmptyMessage());
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [showcaseResponse, formResponse] = await Promise.all([
          fetch("/api/showcases?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/forms?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
        ]);
        const showcaseResult = await showcaseResponse.json();
        const formResult = await formResponse.json();
        if (!cancelled) {
          setShowcases(Array.isArray(showcaseResult) ? showcaseResult : Array.isArray(showcaseResult?.data) ? showcaseResult.data : []);
          setForms(Array.isArray(formResult) ? formResult : Array.isArray(formResult?.data) ? formResult.data : []);
        }
      } catch {
        if (!cancelled) {
          setShowcases([]);
          setForms([]);
        }
      } finally {
        if (!cancelled) setLoadingResources(false);
      }
    })();
    return () => { cancelled = true; };
  }, [account.id]);

  const keywords = useMemo(() => keyword.split(",").map((item) => item.trim()).filter(Boolean), [keyword]);

  useEffect(() => {
    if (triggerType !== "COMMENT_KEYWORD") { setMediaLoading(false); return; }
    let cancelled = false;
    void fetch("/api/instagram/media?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((result) => { if (!cancelled) setMediaItems(Array.isArray(result?.data) ? result.data.filter((item: {id?:unknown;media_type?:string;media_product_type?:string}) => typeof item.id === "string" && (item.media_type === "IMAGE" || item.media_type === "VIDEO" || item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "REELS")) : []); })
      .catch(() => { if (!cancelled) setMediaItems([]); })
      .finally(() => { if (!cancelled) setMediaLoading(false); });
    return () => { cancelled = true; };
  }, [account.id, triggerType]);

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value || keywords.includes(value)) return;
    setKeyword([...keywords, value].join(","));
    setKeywordDraft("");
  }

  async function saveAutomation(finalMessage?: MessageDraft) {
    if (saving) return;
    const cleanKeywords = keyword.split(",").map((item) => item.trim()).filter(Boolean);
    const currentMessage = finalMessage ?? message;

    if (triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK") {
      let parsedUrl: URL | null = null;
      try { parsedUrl = new URL(linkButtonUrl.trim()); } catch { parsedUrl = null; }
      if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) { setError("آدرس دکمه باید یک لینک معتبر با http یا https باشد."); return; }
      if (!linkButtonTitle.trim() || linkButtonTitle.trim().length > 20) { setError("عنوان دکمه را وارد کن (حداکثر ۲۰ کاراکتر)."); return; }
      if (currentMessage.text.trim().length > 640) { setError("متن دایرکت همراه دکمه حداکثر ۶۴۰ کاراکتر است."); return; }
    }
    if (triggerType === "COMMENT_KEYWORD" && mediaSelectionMode === "SELECTED" && selectedMediaIds.length === 0) {
      setError("حداقل یک پست یا ریلز انتخاب کنید، یا گزینه همه محتواها را بزنید.");
      return;
    }
    if (triggerType === "COMMENT_KEYWORD" && requireFollow && !followGateText.trim()) {
      setError("متن درخواست فالو را وارد کنید.");
      return;
    }
    if (!cleanKeywords.length) {
      setError("حداقل یک کلمه کلیدی وارد کنید.");
      return;
    }
    if (currentMessage.messageType === "TEXT" && !currentMessage.text.trim()) {
      setError("متن پاسخ را وارد کنید.");
      return;
    }
    if (["IMAGE", "VIDEO", "AUDIO"].includes(currentMessage.messageType) && !currentMessage.mediaUrl.trim()) {
      setError("فایل پاسخ را انتخاب کنید.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          triggerType,
          mediaId: triggerType === "COMMENT_KEYWORD" ? (mediaSelectionMode === "SELECTED" && selectedMediaIds.length === 1 ? selectedMediaIds[0] : null) : mediaId,
          keyword: cleanKeywords.join(","),
          keywordMatchMode,
          mediaIds: triggerType === "COMMENT_KEYWORD" && mediaSelectionMode === "SELECTED" ? selectedMediaIds : [],
          commentReplyText: triggerType === "COMMENT_KEYWORD" ? commentReply.trim() || null : null,
          replyText: null,
          likeComment: false,
          sendDm: true,
          likeIncomingDm: false,
          likeStoryReply: false,
          requireFollow: triggerType === "COMMENT_KEYWORD" && requireFollow,
          followGateText: triggerType === "COMMENT_KEYWORD" && requireFollow ? followGateText.trim() : null,
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.id) {
        throw new Error(result.error || result.message || "ذخیره پاسخ خودکار ناموفق بود.");
      }

      const automationId = result.data.id as string;
      const messageResponse = await fetch("/api/automations/" + automationId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messageType: currentMessage.messageType,
          text: currentMessage.text.trim() || null,
          mediaUrl: currentMessage.mediaUrl.trim() || null,
          mediaId: currentMessage.mediaId.trim() || null,
          showcaseId: currentMessage.showcaseId || null,
          formId: currentMessage.formId || null,
          order: 0,
          linkButtonUrl: triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK" ? linkButtonUrl.trim() : null,
          linkButtonTitle: triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK" ? linkButtonTitle.trim() : null,
        }),
      });
      const messageResult = await messageResponse.json();
      if (!messageResponse.ok || !messageResult.success || !messageResult.data?.id) {
        throw new Error(messageResult.error || messageResult.message || "ذخیره پیام پاسخ ناموفق بود.");
      }

      const serverMessageId = messageResult.data.id as string;
      for (const reply of currentMessage.quickReplies) {
        const qrResponse = await fetch("/api/automations/" + automationId + "/messages/" + serverMessageId + "/quick-replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: reply.title.trim(),
            payload: reply.payload,
            destinationType: reply.destinationType,
            destinationText: reply.destinationText.trim(),
            destinationFormId: reply.destinationFormId,
            destinationShowcaseId: reply.destinationShowcaseId,
            destinationMediaUrl: reply.destinationMediaUrl,
            destinationMediaId: reply.destinationMediaId,
            destinationQuestion: reply.destinationQuestion.trim(),
            question: reply.destinationQuestion.trim(),
            destinationQuickReplies: serializeQuickReplies(reply.destinationQuickReplies),
            nextMessageId: null,
          }),
        });
        const qrResult = await qrResponse.json();
        if (!qrResponse.ok || !qrResult.success) {
          throw new Error(qrResult.error || qrResult.message || "ذخیره گزینه‌های پاسخ ناموفق بود.");
        }
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره پاسخ خودکار ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-9">
          <Button
            type="button"
            onClick={() => router.back()}
            className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"
          >
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </Button>
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
              {triggerType === "COMMENT_KEYWORD" ? <MessageCircleReply size={17} /> : <Camera size={17} />}
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#0F172A]">{title}</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">{description}</p>
            </div>
          </div>

          <div className="space-y-5">
            {triggerType === "COMMENT_KEYWORD" && (
              <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <h2 className="mb-2 text-sm font-bold text-[#0F172A]">انتخاب پست‌ها و ریلزها</h2>
                <p className="mb-3 text-xs leading-5 text-[#64748B]">یک یا چند محتوا را انتخاب کن یا پاسخ را برای همه پست‌ها و ریلزها فعال کن.</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => { setMediaSelectionMode("SELECTED"); setSelectedMediaIds(mediaItems.map((item) => item.id)); }} className="min-h-9 rounded-lg bg-white px-3 text-xs text-[#2563EB]">انتخاب همه موارد فعلی</Button>
                  <Button type="button" onClick={() => { setMediaSelectionMode("ALL"); setSelectedMediaIds([]); }} className="min-h-9 rounded-lg bg-white px-3 text-xs text-[#475569]">همه پست‌ها و ریلزها</Button>
                </div>
                {mediaLoading ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="aspect-square animate-pulse rounded-lg bg-[#E2E8F0]" />)}</div> : mediaItems.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{mediaItems.map((item) => { const selected = selectedMediaIds.includes(item.id); const image = item.thumbnail_url || item.media_url; return <button key={item.id} type="button" onClick={() => { if (selected) { const next = selectedMediaIds.filter((id) => id !== item.id); setSelectedMediaIds(next); if (next.length === 0) setMediaSelectionMode("ALL"); } else { setMediaSelectionMode("SELECTED"); setSelectedMediaIds((current) => [...current,item.id]); } }} className={"relative overflow-hidden rounded-lg border-2 text-right " + (selected ? "border-[#2563EB] ring-2 ring-[#2563EB]/15" : "border-transparent")} aria-pressed={selected}>{image ? <img src={image} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-[#E2E8F0] text-xs">بدون تصویر</div>}<span className={"absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full " + (selected ? "bg-[#2563EB] text-white" : "bg-white/90 text-transparent")}><Check size={13}/></span><span className="block truncate bg-white px-1.5 py-1 text-[10px] text-[#475569]">{item.media_product_type === "REELS" || item.media_type === "VIDEO" ? "ریلز / ویدیو" : item.media_type === "CAROUSEL_ALBUM" ? "پست اسلایدی" : "پست"}</span></button>})}</div> : <p className="rounded-lg bg-white p-3 text-xs text-[#64748B]">محتوایی دریافت نشد. اتصال اینستاگرام و دسترسی رسانه‌ها را بررسی کن.</p>}
                <p className="mt-3 text-xs text-[#64748B]">{mediaSelectionMode === "ALL" ? "پاسخ برای همه پست‌ها و ریلزها، از جمله محتواهای آینده، فعال می‌شود." : `${selectedMediaIds.length} محتوا انتخاب شده`}</p>
              </section>
            )}
            <div>
              <label className="mb-2 block text-sm font-bold text-[#0F172A]">کلمات کلیدی</label>
              <p className="mb-3 text-xs leading-5 text-[#64748B]">
                {triggerType === "COMMENT_KEYWORD" ? "با وارد شدن این کلمات در کامنت، پاسخ خودکار فعال می‌شود." : "با وارد شدن این کلمات در Reply استوری، پاسخ خودکار فعال می‌شود."}
              </p>
              {keywords.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {keywords.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#2563EB]">
                      {item}
                      <button type="button" onClick={() => setKeyword(keywords.filter((value) => value !== item).join(","))} className="text-[#64748B] hover:text-[#DC2626]" aria-label={"حذف " + item}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {triggerType === "COMMENT_KEYWORD" && <div className="mb-3 rounded-xl border border-[#E2E8F0] p-3"><p className="mb-2 text-xs font-bold text-[#334155]">روش تطبیق کلمات</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={() => setKeywordMatchMode("EXACT")} className={"rounded-lg border p-3 text-right text-xs " + (keywordMatchMode === "EXACT" ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#E2E8F0] text-[#475569]")}><strong className="block mb-1">عبارت دقیق</strong>کامنت باید با یکی از کلمات برابر باشد.</button><button type="button" onClick={() => setKeywordMatchMode("CONTAINS_ANY")} className={"rounded-lg border p-3 text-right text-xs " + (keywordMatchMode === "CONTAINS_ANY" ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#E2E8F0] text-[#475569]")}><strong className="block mb-1">شامل هر کلمه</strong>اگر کامنت شامل یکی از کلمات باشد، فعال می‌شود.</button></div></div>}
              <div className="flex items-center gap-2">
                <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="مثلاً قیمت، اطلاعات" className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-3 !text-base text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px" }} />
                <Button type="button" onClick={addKeyword} disabled={!keywordDraft.trim()} className="min-h-11 shrink-0 rounded-lg !bg-[#2563EB] px-3.5 text-xs font-semibold text-white hover:!bg-[#1D4ED8] disabled:!bg-[#E2E8F0] disabled:!text-[#94A3B8]">افزودن</Button>
              </div>
            </div>

            {triggerType === "COMMENT_KEYWORD" && (
              <div className="border-t border-[#E2E8F0] pt-5">
                <label className="mb-2 block text-sm font-bold text-[#0F172A]">متن ارسالی در کامنت</label>
                <textarea value={commentReply} onChange={(e) => setCommentReply(e.target.value)} rows={3} maxLength={2000} placeholder="پاسخی که زیر کامنت کاربر منتشر می‌شود بنویس..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none placeholder:text-[11px] placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />
              </div>
            )}

            {triggerType === "COMMENT_KEYWORD" && (
              <section className="border-t pt-5" style={{ borderColor: dairaPalette.border }}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3" style={{ borderColor: dairaPalette.border, background: dairaPalette.background.surfaceHover }}>
                  <input type="checkbox" checked={requireFollow} onChange={(event) => setRequireFollow(event.target.checked)} className="mt-1 h-4 w-4 accent-[#2F61FD]" />
                  <span className="min-w-0">
                    <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>الزام به فالو قبل از ارسال پاسخ</strong>
                    <span className="mt-1 block text-xs leading-5" style={{ color: dairaPalette.text.body }}>اگر کاربر پیج را فالو نکرده باشد، ابتدا پیام درخواست فالو و دکمه بررسی ارسال می‌شود.</span>
                  </span>
                </label>
                {requireFollow && (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-semibold" style={{ color: dairaPalette.text.heading }}>متن درخواست فالو</label>
                    <textarea value={followGateText} onChange={(event) => setFollowGateText(event.target.value)} maxLength={640} rows={3} placeholder="برای دریافت پاسخ، ابتدا پیج ما را فالو کنید." className="w-full rounded-xl border bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#2F61FD]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                    {!followGateText.trim() && <p className="mt-1 text-xs" style={{ color: dairaPalette.status.error }}>وارد کردن متن درخواست فالو الزامی است.</p>}
                  </div>
                )}
              </section>
            )}

            <div className="border-t border-[#E2E8F0] pt-5">
              {triggerType === "COMMENT_KEYWORD" ? (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>پیام دایرکت</h2>
                    <p className="mt-1 text-xs leading-5" style={{ color: dairaPalette.text.body }}>متنی را که پس از کامنت برای کاربر ارسال می‌شود بنویس.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => setDmMode("TEXT")} className={"rounded-xl border p-3 text-right text-xs " + (dmMode === "TEXT" ? "border-[#2F61FD] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-white")} aria-pressed={dmMode === "TEXT"}>
                      <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>متن ساده</strong>
                      <span className="mt-1 block leading-5" style={{ color: dairaPalette.text.body }}>ارسال پیام متنی بدون دکمه</span>
                    </button>
                    <button type="button" onClick={() => setDmMode("TEXT_WITH_LINK")} className={"rounded-xl border p-3 text-right text-xs " + (dmMode === "TEXT_WITH_LINK" ? "border-[#2F61FD] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-white")} aria-pressed={dmMode === "TEXT_WITH_LINK"}>
                      <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>متن همراه دکمه لینک</strong>
                      <span className="mt-1 block leading-5" style={{ color: dairaPalette.text.body }}>نمایش یک دکمه برای باز کردن لینک</span>
                    </button>
                  </div>
                  <textarea value={message.text} onChange={(event) => setMessage((current) => ({ ...current, messageType: "TEXT", text: event.target.value, mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: [] }))} maxLength={dmMode === "TEXT_WITH_LINK" ? 640 : 2000} rows={4} placeholder="متن دایرکتی که بعد از کامنت برای کاربر ارسال می‌شود..." className="w-full rounded-xl border bg-white px-3.5 py-3 text-base leading-7 outline-none focus:ring-2 focus:ring-[#2F61FD]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />
                  {dmMode === "TEXT_WITH_LINK" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>آدرس لینک</label>
                        <input type="url" value={linkButtonUrl} onChange={(event) => setLinkButtonUrl(event.target.value)} placeholder="https://example.com" dir="ltr" className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2F61FD]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>عنوان دکمه (حداکثر ۲۰ کاراکتر)</label>
                        <input value={linkButtonTitle} onChange={(event) => setLinkButtonTitle(event.target.value.slice(0, 20))} maxLength={20} placeholder="مشاهده لینک" className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2F61FD]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => { setMessage((current) => ({ ...current, messageType: "TEXT" })); void saveAutomation({ ...message, messageType: "TEXT" }); }} disabled={saving} className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition disabled:opacity-60" style={{ background: dairaPalette.primary.main }}>
                    {saving ? "در حال ساخت پاسخ خودکار..." : "ساخت پاسخ خودکار"}
                  </button>
                </section>
              ) : (
                <PublishingStoryAutomationSetup
                  message={message}
                  showcases={showcases}
                  forms={forms}
                  loadingResources={loadingResources}
                  instagramAccountId={account.id}
                  onUpdate={(patch) => setMessage((current) => ({ ...current, ...patch }))}
                  keywordValid={keywords.length > 0}
                  onContinue={(nextMessage) => {
                    const next = nextMessage ?? message;
                    setMessage(next);
                    return saveAutomation(next);
                  }}
                  disabled={saving}
                  showFinalSave
                  finalSaveLabel="ساخت پاسخ خودکار"
                  finalSaveLoadingLabel="در حال ساخت پاسخ خودکار..."
                  finalSaveDisabled={saving}
                  responseTypeTitle="نوع پاسخ خودکار"
                  responseTypeDescription="نوع پاسخی که می‌خواهید در دایرکت برای کاربر ارسال شود."
                  textPlaceholder="متنی که در پاسخ خودکار برای کاربر ارسال می‌شود..."
                />
              )}
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium text-[#B91C1C]">{error}</div>}
        </section>
      </div>
    </div>
  );
}
