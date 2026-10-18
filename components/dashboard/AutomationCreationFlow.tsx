"use client";

import { ArrowRight, Camera, MessageCircleReply } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const PublishingStoryAutomationSetup = dynamic(() => import("./publishing/PublishingStoryAutomationSetup"), { ssr: false });
import { createEmptyMessage, normalizeMessages, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import { dairaPalette } from "../../lib/design-system/palette";
import AutomationPicker from "./AutomationPicker";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
type AutomationTemplate = { id: string; triggerType: string; keyword?: string | null; keywordMatchMode?: string | null; commentReplyText?: string | null; requireFollow?: boolean; followGateText?: string | null; isActive?: boolean; mediaId?: string | null; messages?: unknown; };

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
  const MAX_KEYWORDS = 10;
  const MAX_LINK_BUTTONS = 3;
  const [linkButtons, setLinkButtons] = useState<Array<{ title: string; url: string }>>([{ title: "مشاهده لینک", url: "" }]);
  const [mediaItems, setMediaItems] = useState<Array<{id:string; caption?:string; media_type?:string; media_product_type?:string; thumbnail_url?:string|null; media_url?:string|null; timestamp?:string}>>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(mediaId ? [mediaId] : []);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [commentReply, setCommentReply] = useState("");
  const [requireFollow, setRequireFollow] = useState(false);
  const [dmMode, setDmMode] = useState<"TEXT" | "TEXT_WITH_LINK">("TEXT");
  const [followGateText, setFollowGateText] = useState("برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.");
  const [message, setMessage] = useState<MessageDraft>(() => createEmptyMessage());
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [automationTemplates, setAutomationTemplates] = useState<AutomationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingResources, setLoadingResources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [showcaseResponse, formResponse, automationResponse] = await Promise.all([
          fetch("/api/showcases?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/forms?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
        ]);
        const showcaseResult = await showcaseResponse.json();
        const formResult = await formResponse.json();
        const automationResult = await automationResponse.json();
        if (!cancelled) {
          setShowcases(Array.isArray(showcaseResult) ? showcaseResult : Array.isArray(showcaseResult?.data) ? showcaseResult.data : []);
          setForms(Array.isArray(formResult) ? formResult : Array.isArray(formResult?.data) ? formResult.data : []);
          setAutomationTemplates(
            (Array.isArray(automationResult?.data) ? automationResult.data : [])
              .filter((item: AutomationTemplate) => item.triggerType === triggerType && (item.keyword || Array.isArray(item.messages)))
              .slice(0, 30),
          );
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
  }, [account.id, triggerType]);

  function applyAutomationTemplate(template: AutomationTemplate) {
    setSelectedTemplateId(template.id);
    setKeyword(typeof template.keyword === "string" ? template.keyword : "");
    setKeywordDraft("");
    setKeywordMatchMode(template.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT");
    setCommentReply(typeof template.commentReplyText === "string" ? template.commentReplyText : "");
    setRequireFollow(Boolean(template.requireFollow));
    setFollowGateText(typeof template.followGateText === "string" && template.followGateText.trim() ? template.followGateText : "برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.");
    const normalized = normalizeMessages(template.messages);
    if (normalized[0]) setMessage(normalized[0]);
    if (triggerType === "COMMENT_KEYWORD") setDmMode("TEXT");
    setError("");
  }

  const keywords = useMemo(() => keyword.split(",").map((item) => item.trim()).filter(Boolean), [keyword]);

  useEffect(() => {
    if (triggerType !== "COMMENT_KEYWORD") { setMediaLoading(false); return; }
    let cancelled = false;
    void Promise.all([
      fetch("/api/instagram/media?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }).then((response) => response.json()),
      fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }).then((response) => response.json()),
    ])
      .then(([mediaResult, automationResult]) => {
        if (cancelled) return;
        if (!mediaResult?.success || !automationResult?.success || !Array.isArray(mediaResult?.data) || !Array.isArray(automationResult?.data)) {
          throw new Error("دریافت فهرست محتواها و پاسخ‌های خودکار ناموفق بود.");
        }
        const existingMediaIds = new Set<string>();
        const automations = Array.isArray(automationResult?.data) ? automationResult.data : [];
        for (const automation of automations) {
          if (automation?.triggerType !== "COMMENT_KEYWORD") continue;
          if (typeof automation.mediaId === "string" && automation.mediaId) existingMediaIds.add(automation.mediaId);
          if (typeof automation.mediaIds === "string") {
            for (const id of automation.mediaIds.split(",").map((value: string) => value.trim()).filter(Boolean)) existingMediaIds.add(id);
          }
        }
        const availableMedia = Array.isArray(mediaResult?.data)
          ? mediaResult.data.filter((item: { id?: unknown; media_type?: string; media_product_type?: string }) =>
              typeof item.id === "string" &&
              !existingMediaIds.has(item.id) &&
              (item.media_type === "IMAGE" || item.media_type === "VIDEO" || item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "REELS"))
          : [];
        const availableIds = new Set<string>(availableMedia.map((item: { id: string }) => item.id));
        setMediaItems(availableMedia);
        setSelectedMediaIds((current) => current.filter((id) => availableIds.has(id)));
      })
      .catch(() => { if (!cancelled) { setMediaItems([]); setError("دریافت فهرست پست‌ها یا پاسخ‌های خودکار ناموفق بود. صفحه را دوباره بارگذاری کنید."); } })
      .finally(() => { if (!cancelled) setMediaLoading(false); });
    return () => { cancelled = true; };
  }, [account.id, triggerType]);

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value || keywords.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase()) || keywords.length >= MAX_KEYWORDS) return;
    setKeyword([...keywords, value].join(","));
    setKeywordDraft("");
  }

  async function saveAutomation(finalMessage?: MessageDraft) {
    if (saving) return;
    const cleanKeywords = keyword.split(",").map((item) => item.trim()).filter(Boolean);
    const currentMessage = finalMessage ?? message;

    if (triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK") {
      const invalidButton = linkButtons.find((button) => {
        let parsed: URL | null = null;
        try { parsed = new URL(button.url.trim()); } catch { parsed = null; }
        return !parsed || !["http:", "https:"].includes(parsed.protocol) || !button.title.trim() || button.title.trim().length > 20;
      });
      if (invalidButton) { setError("برای هر دکمه، لینک معتبر با http یا https و عنوان حداکثر ۲۰ کاراکتر وارد کنید."); return; }
      if (currentMessage.text.trim().length > 640) { setError("متن دایرکت همراه دکمه حداکثر ۶۴۰ کاراکتر است."); return; }
    }
    if (triggerType === "COMMENT_KEYWORD" && selectedMediaIds.length === 0) {
      setError("حداقل یک پست یا ریلز انتخاب کنید.");
      return;
    }
    if (triggerType === "COMMENT_KEYWORD" && requireFollow && !followGateText.trim()) {
      setError("متن درخواست فالو را وارد کنید.");
      return;
    }
    if (keywordMatchMode !== "CONTAINS_ANY" && !cleanKeywords.length) {
      setError("حداقل یک کلمه کلیدی وارد کنید.");
      return;
    }
    if (cleanKeywords.length > MAX_KEYWORDS) {
      setError(`حداکثر ${MAX_KEYWORDS} کلمه کلیدی می‌توانید اضافه کنید.`);
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
          mediaId: triggerType === "COMMENT_KEYWORD" ? (selectedMediaIds.length === 1 ? selectedMediaIds[0] : null) : mediaId,
          keyword: keywordMatchMode === "CONTAINS_ANY" ? null : cleanKeywords.join(","),
          keywordMatchMode,
          mediaIds: triggerType === "COMMENT_KEYWORD" ? selectedMediaIds : [],
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
          linkButtons: triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK" ? linkButtons.map((button) => ({ url: button.url.trim(), title: button.title.trim() })) : [],
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
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)] rounded-[28px] bg-[#F4F7FC] p-2 sm:p-4">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="mb-5">
          <button type="button" onClick={() => router.back()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#2F61FD] transition hover:bg-[#DBEAFE] hover:text-[#2F61FD]">
            <ArrowRight size={15} strokeWidth={2} />بازگشت
          </button>
        </div>

        <section className="rounded-[24px] border border-[#E6ECF5] bg-white p-4 shadow-[0_4px_20px_rgba(24,35,60,0.035)] sm:p-6">
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#E6ECF5] bg-[#F8FAFC] p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2F61FD]">
              {triggerType === "COMMENT_KEYWORD" ? <MessageCircleReply size={17} /> : <Camera size={17} />}
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#18233C]">{title}</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#5A6B87]">{description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold text-[#2F61FD]">گام ۲ از ۳ · تنظیم پاسخ</span><span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-[#64748B]">{triggerType === "COMMENT_KEYWORD" ? "پاسخ خودکار کامنت" : "پاسخ خودکار استوری"}</span></div>
            </div>
          </div>

          <div className="space-y-5">
            {triggerType === "COMMENT_KEYWORD" && !mediaId && (
              <AutomationPicker
                items={mediaItems}
                selectedIds={selectedMediaIds}
                loading={mediaLoading}
                onToggle={(id) => setSelectedMediaIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}
              />
            )}
            {triggerType === "COMMENT_KEYWORD" && mediaId && (
              <section className="flex items-center gap-3 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-3.5 sm:p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[#2F61FD]">
                  {(() => { const selected = mediaItems.find((item) => item.id === mediaId); const image = selected?.thumbnail_url || selected?.media_url; return image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Camera size={18} />; })()}
                </span>
                <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#18233C]">محتوای انتخاب‌شده</p><p className="mt-1 truncate text-[11px] leading-5 text-[#5A6B87]">{mediaItems.find((item) => item.id === mediaId)?.caption?.trim() || "پست یا ریلز انتخاب‌شده برای این پاسخ خودکار"}</p></div>
                <button type="button" onClick={() => router.push("/dashboard/comment-automation/new")} className="shrink-0 rounded-lg border border-[#BFDBFE] bg-white px-3 py-2 text-[11px] font-bold text-[#2F61FD] transition hover:bg-[#DBEAFE]">تغییر محتوا</button>
              </section>
            )}
            {automationTemplates.length > 0 && (
              <section className="rounded-2xl border border-[#E6ECF5] bg-white p-4 sm:p-5" aria-labelledby="automation-template-heading">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2F61FD]"><MessageCircleReply size={17} /></span>
                  <div className="min-w-0 flex-1"><h2 id="automation-template-heading" className="text-sm font-bold text-[#18233C]">استفاده از پاسخ خودکار قبلی</h2><p className="mt-1 text-xs leading-5 text-[#5A6B87]">یکی از اتوماسیون‌های قبلی را انتخاب کن تا کلمات کلیدی، پیام‌ها و تنظیماتش برای این محتوا کپی شود؛ اتوماسیون قبلی تغییر نمی‌کند.</p></div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {automationTemplates.map((template) => {
                    const previewMessages = normalizeMessages(template.messages);
                    const preview = previewMessages[0]?.text?.trim() || (previewMessages[0]?.messageType === "SHOWCASE" ? "ارسال ویترین" : previewMessages[0]?.messageType === "FORM" ? "ارسال فرم" : previewMessages[0]?.messageType === "IMAGE" ? "ارسال تصویر" : previewMessages[0]?.messageType === "VIDEO" ? "ارسال ویدیو" : previewMessages[0]?.messageType === "AUDIO" ? "ارسال پیام صوتی" : "بدون متن پاسخ");
                    const selected = selectedTemplateId === template.id;
                    return <button key={template.id} type="button" onClick={() => applyAutomationTemplate(template)} aria-pressed={selected} className={"rounded-xl border p-3 text-right transition focus:outline-none focus:ring-2 focus:ring-[#2F61FD]/20 " + (selected ? "border-[#2F61FD] bg-[#EFF6FF] shadow-sm" : "border-[#E6ECF5] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFC]")}>
                      <span className="flex items-start justify-between gap-2"><strong className="min-w-0 text-xs font-bold leading-5 text-[#18233C]">{(template.keyword || "").split(/[,،;؛\n]+/).filter(Boolean).slice(0, 3).join("، ") || "بدون کلمه کلیدی"}</strong><span className={"shrink-0 rounded-full px-2 py-1 text-[10px] font-bold " + (selected ? "bg-[#2F61FD] text-white" : "bg-[#F1F5F9] text-[#64748B]")}>{selected ? "انتخاب شد" : "انتخاب"}</span></span>
                      <span className="mt-2 block truncate text-[11px] leading-5 text-[#64748B]">{preview}</span>
                    </button>;
                  })}
                </div>
              </section>
            )}
            <div className="rounded-2xl border border-[#E6ECF5] bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-sm font-bold text-[#2F61FD]">۲</span><label className="block text-sm font-bold text-[#18233C]">شرط فعال‌سازی</label></div>
              <p className="mb-3 text-xs leading-5 text-[#5A6B87]">
                {triggerType === "COMMENT_KEYWORD" ? (keywordMatchMode === "CONTAINS_ANY" ? "با ثبت هر کامنت زیر پست یا ریلز انتخاب‌شده، همین پاسخ ارسال می‌شود." : "با ثبت یکی از کلمات کلیدی مشخص‌شده در کامنت، پاسخ خودکار فعال می‌شود.") : "با وارد شدن یکی از کلمات کلیدی در Reply استوری، پاسخ خودکار فعال می‌شود."}
              </p>
              {keywordMatchMode !== "CONTAINS_ANY" && keywords.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {keywords.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#2F61FD]">
                      {item}
                      <button type="button" onClick={() => setKeyword(keywords.filter((value) => value !== item).join(","))} className="text-[#5A6B87] hover:text-[#DC2626]" aria-label={"حذف " + item}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {keywordMatchMode !== "CONTAINS_ANY" && <div>
                <div className="mb-2 flex items-center justify-between gap-2"><label className="block text-xs text-[#5A6B87]">حداکثر {MAX_KEYWORDS} کلمه کلیدی</label><span className="text-[11px] text-[#5A6B87]">{keywords.length} از {MAX_KEYWORDS}</span></div>
                <div className="flex items-center gap-2">
                  <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="یک کلمه کلیدی وارد کنید" disabled={keywords.length >= MAX_KEYWORDS} className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-3 text-base text-[#18233C] outline-none focus:border-[#2F61FD] focus:ring-2 focus:ring-[#2F61FD]/10 disabled:bg-[#F1F5F9]" style={{ fontSize: "16px" }} />
                  <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim() || keywords.length >= MAX_KEYWORDS} className="min-h-11 shrink-0 rounded-lg bg-[#2F61FD] px-3.5 text-xs font-semibold text-white transition hover:bg-[#1E4BD8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">افزودن</button>
                </div>
              </div>}
              {triggerType === "COMMENT_KEYWORD" && <div className="mb-3 rounded-xl border border-[#E2E8F0] p-3"><p className="mb-2 text-xs font-bold text-[#18233C]">روش فعال‌سازی پاسخ</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={() => { setKeywordMatchMode("EXACT"); setKeyword(""); setKeywordDraft(""); }} className={"rounded-lg border p-3 text-right text-xs " + (keywordMatchMode === "EXACT" ? "border-[#2F61FD] bg-[#EFF6FF] text-[#1E4BD8]" : "border-[#E2E8F0] text-[#5A6B87]")}><strong className="mb-1 block">کلمات کلیدی مشخص</strong><span className="block leading-5">فقط وقتی کامنت با یکی از کلمات تعیین‌شده برابر باشد پاسخ ارسال می‌شود.</span></button><button type="button" onClick={() => { setKeywordMatchMode("CONTAINS_ANY"); setKeyword(""); setKeywordDraft(""); }} className={"rounded-lg border p-3 text-right text-xs " + (keywordMatchMode === "CONTAINS_ANY" ? "border-[#2F61FD] bg-[#EFF6FF] text-[#1E4BD8]" : "border-[#E2E8F0] text-[#5A6B87]")}><strong className="mb-1 block">شامل هر کلمه</strong><span className="block leading-5">با ثبت هر کامنت زیر محتوای انتخاب‌شده، پاسخ خودکار ارسال می‌شود.</span></button></div></div>}

            </div>

            {triggerType === "COMMENT_KEYWORD" && (
              <div className="rounded-2xl border border-[#E6ECF5] bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-sm font-bold text-[#2F61FD]">۳</span><label className="block text-sm font-bold text-[#18233C]">پاسخ زیر کامنت</label></div>
                <textarea value={commentReply} onChange={(e) => setCommentReply(e.target.value)} rows={3} maxLength={2000} placeholder="پاسخی که زیر کامنت کاربر منتشر می‌شود بنویس..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#18233C] outline-none placeholder:text-[11px] placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis focus:border-[#2F61FD] focus:bg-white focus:ring-2 focus:ring-[#2F61FD]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />
              </div>
            )}

            <div className="rounded-2xl border border-[#E6ECF5] bg-white p-4 sm:p-5">
              {triggerType === "COMMENT_KEYWORD" ? (
                <section className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-sm font-bold text-[#2F61FD]">۴</span>
                      <h2 className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>پیام دایرکت</h2>
                    </div>
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
                    <div className="space-y-3">
                      <p className="text-xs leading-5" style={{ color: dairaPalette.text.body }}>حداکثر {MAX_LINK_BUTTONS} دکمه لینک می‌توانید اضافه کنید.</p>
                      {linkButtons.map((button, index) => (
                        <div key={index} className="rounded-xl border p-3" style={{ borderColor: dairaPalette.form.border }}>
                          <div className="mb-3 flex items-center justify-between">
                            <strong className="text-xs" style={{ color: dairaPalette.text.heading }}>دکمه {index + 1}</strong>
                            {linkButtons.length > 1 && <button type="button" onClick={() => setLinkButtons((current) => current.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-600">حذف</button>}
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>آدرس لینک</label>
                              <input type="url" value={button.url} onChange={(event) => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} placeholder="https://example.com" dir="ltr" className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2F61FD]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>عنوان دکمه (حداکثر ۲۰ کاراکتر)</label>
                              <input value={button.title} onChange={(event) => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value.slice(0, 20) } : item))} maxLength={20} placeholder="مشاهده لینک" className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#2F61FD]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {linkButtons.length < MAX_LINK_BUTTONS && <button type="button" onClick={() => setLinkButtons((current) => [...current, { title: "", url: "" }])} className="min-h-10 rounded-lg border px-3 text-xs font-semibold" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.primary.main }}>افزودن دکمه لینک</button>}
                    </div>
                  )}

                  <section className="border-t pt-5" style={{ borderColor: dairaPalette.border }}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-sm font-bold text-[#2F61FD]">۵</span>
                      <span className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>شرط فالو</span>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3" style={{ borderColor: dairaPalette.border, background: dairaPalette.background.surfaceHover }}>
                      <input type="checkbox" checked={requireFollow} onChange={(event) => setRequireFollow(event.target.checked)} className="mt-1 h-4 w-4 accent-[#2F61FD]" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>الزام به فالو قبل از ارسال پاسخ (اختیاری)</strong>
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

          {error && <div role="alert" className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-6 text-[#B91C1C]">{error}</div>}
        </section>
      </div>
    </div>
  );
}
