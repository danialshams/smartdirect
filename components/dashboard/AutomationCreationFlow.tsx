"use client";

import { Camera, Check, MessageCircle, Send, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const PublishingStoryAutomationSetup = dynamic(() => import("./publishing/PublishingStoryAutomationSetup"), { ssr: false });
import { createEmptyMessage, normalizeMessages, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import { dairaPalette } from "../../lib/design-system/palette";
import AutomationPicker from "./AutomationPicker";
import { useDashboardBackNavigation } from "./DashboardBackNavigationContext";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
type CreationMode = "new" | "existing";
type AutomationTemplate = { id: string; triggerType: string; keyword?: string | null; keywordMatchMode?: string | null; commentReplyText?: string | null; requireFollow?: boolean; followGateText?: string | null; isActive?: boolean; mediaId?: string | null; messages?: unknown; };

type Props = {
  account: Account;
  mediaId?: string;
  triggerType: TriggerType;
  title: string;
  description: string;
  onSaved: () => void;
};

function sortNewestFirst<T extends { timestamp?: string | null }>(items: T[]): T[] {
  return items
    .map((item, index) => {
      const parsedTimestamp = item.timestamp ? Date.parse(item.timestamp) : Number.NaN;
      return {
        item,
        index,
        timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((a, b) => (b.timestamp - a.timestamp) || (a.index - b.index))
    .map(({ item }) => item);
}

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

export default function AutomationCreationFlow({ account, mediaId, triggerType, onSaved }: Props) {
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
  const [creationMode, setCreationMode] = useState<CreationMode>("new");
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);
  const [loadingResources, setLoadingResources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { registerBackHandler, registerPageTitle } = useDashboardBackNavigation();

  useEffect(() => {
    const handleBack = () => {
      if (flowStep > 1) {
        setFlowStep((current) => (current === 3 ? 2 : 1));
      } else {
        router.back();
      }
    };

    registerBackHandler(handleBack);
    return () => registerBackHandler(null);
  }, [flowStep, registerBackHandler, router]);

  useEffect(() => {
    const pageTitle = flowStep === 1
      ? (triggerType === "COMMENT_KEYWORD" ? "انتخاب محتوا" : "انتخاب استوری")
      : flowStep === 2
        ? "انتخاب پاسخ"
        : "ساخت پاسخ خودکار";
    registerPageTitle(pageTitle);
    return () => registerPageTitle(null);
  }, [flowStep, registerPageTitle, triggerType]);

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
              .filter((item: AutomationTemplate) => item.triggerType === triggerType && (item.keyword || Array.isArray(item.messages))),
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
    if (selectedTemplateId === template.id) {
      setSelectedTemplateId("");
      setCreationMode("new");
    } else {
      setSelectedTemplateId(template.id);
      setCreationMode("existing");
    }
    setError("");
  }

  function startNewAutomation() {
    // Returning to step 2 must not erase an unfinished new response.
    setFlowStep(3);
    setSelectedTemplateId("");
    setCreationMode("new");
    setError("");
  }

  const keywords = useMemo(() => keyword.split(",").map((item) => item.trim()).filter(Boolean), [keyword]);

  useEffect(() => {
    let cancelled = false;
    const mediaEndpoint = triggerType === "COMMENT_KEYWORD" ? "/api/instagram/media?instagramAccountId=" : "/api/instagram/stories?instagramAccountId=";
    void Promise.all([
      fetch(mediaEndpoint + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }).then((response) => response.json()),
      fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }).then((response) => response.json()),
    ])
      .then(([mediaResult, automationResult]) => {
        if (cancelled) return;
        if (!mediaResult?.success || !automationResult?.success || !Array.isArray(mediaResult?.data) || !Array.isArray(automationResult?.data)) {
          throw new Error("دریافت فهرست محتواها و پاسخ‌های خودکار ناموفق بود.");
        }
        const used = new Set<string>();
        for (const automation of automationResult.data) {
          if (automation?.triggerType !== triggerType) continue;
          if (typeof automation.mediaId === "string" && automation.mediaId) used.add(automation.mediaId);
          if (triggerType === "COMMENT_KEYWORD" && typeof automation.mediaIds === "string") {
            automation.mediaIds.split(",").map((id: string) => id.trim()).filter(Boolean).forEach((id: string) => used.add(id));
          }
        }
        const availableMedia = triggerType === "COMMENT_KEYWORD"
          ? mediaResult.data.filter((item: { id?: unknown; media_type?: string; media_product_type?: string }) =>
              typeof item.id === "string" && !used.has(item.id) &&
              (item.media_type === "IMAGE" || item.media_type === "VIDEO" || item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "REELS"))
          : mediaResult.data.filter((item: { id?: unknown }) => typeof item.id === "string" && !used.has(item.id))
              .map((item: { id: string; mediaType?: string | null; mediaUrl?: string | null; thumbnailUrl?: string | null; timestamp?: string | null; createdAt?: string | null; created_time?: string | null }) => ({
                id: item.id,
                media_type: item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
                media_product_type: "STORY",
                media_url: item.mediaUrl,
                thumbnail_url: item.thumbnailUrl,
                timestamp: item.timestamp ?? item.createdAt ?? item.created_time ?? undefined,
                caption: "استوری اینستاگرام",
              }));
        const availableIds = new Set<string>(availableMedia.map((item: { id: string }) => item.id));
        setMediaItems(sortNewestFirst(availableMedia));
        setSelectedMediaIds((current) => current.filter((id) => availableIds.has(id)));
      })
      .catch(() => { if (!cancelled) { setMediaItems([]); setError("دریافت فهرست محتواها یا پاسخ‌های خودکار ناموفق بود. صفحه را دوباره بارگذاری کنید."); } })
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
    const targetMediaIds = Array.from(new Set([...selectedMediaIds.filter(Boolean), ...(mediaId ? [mediaId] : [])]));

    if (creationMode === "existing") {
      const template = automationTemplates.find((item) => item.id === selectedTemplateId);
      const targetIds = targetMediaIds;
      if (!template) { setError("ابتدا پاسخ خودکار موجود را انتخاب کنید."); return; }
      if (targetIds.length === 0) { setError(triggerType === "COMMENT_KEYWORD" ? "حداقل یک پست یا ریلز انتخاب کنید." : "یک استوری انتخاب کنید."); return; }
      if (triggerType === "STORY_REPLY_KEYWORD" && targetIds.length !== 1) { setError("برای پاسخ خودکار استوری فقط یک استوری انتخاب کنید."); return; }
      setSaving(true);
      setError("");
      try {
        const response = await fetch("/api/automations/" + encodeURIComponent(template.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            linkMediaOnly: true,
            triggerType,
            mediaId: triggerType === "COMMENT_KEYWORD" ? (targetIds.length === 1 ? targetIds[0] : null) : targetIds[0],
            mediaIds: triggerType === "COMMENT_KEYWORD" ? targetIds : [],
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || "اتصال پاسخ خودکار ناموفق بود.");
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "اتصال پاسخ خودکار ناموفق بود.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK") {
      const invalidButton = linkButtons.find((button) => {
        let parsed: URL | null = null;
        try { parsed = new URL(button.url.trim()); } catch { parsed = null; }
        return !parsed || !["http:", "https:"].includes(parsed.protocol) || !button.title.trim() || button.title.trim().length > 20;
      });
      if (invalidButton) { setError("برای هر دکمه، لینک معتبر با http یا https و عنوان حداکثر ۲۰ کاراکتر وارد کنید."); return; }
      if (currentMessage.text.trim().length > 640) { setError("متن دایرکت همراه دکمه حداکثر ۶۴۰ کاراکتر است."); return; }
    }
    if (selectedMediaIds.length === 0 && !mediaId) {
      setError(triggerType === "COMMENT_KEYWORD" ? "حداقل یک پست یا ریلز انتخاب کنید." : "یک استوری انتخاب کنید.");
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
          mediaId: triggerType === "COMMENT_KEYWORD" ? (targetMediaIds.length === 1 ? targetMediaIds[0] : null) : targetMediaIds[0] || mediaId,
          keyword: keywordMatchMode === "CONTAINS_ANY" ? null : cleanKeywords.join(","),
          keywordMatchMode,
          mediaIds: triggerType === "COMMENT_KEYWORD" ? targetMediaIds : [],
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

  const selectedMediaCount = new Set([...selectedMediaIds, ...(mediaId ? [mediaId] : [])]).size;
  const flowSteps = [
    { number: 1 as const, title: triggerType === "COMMENT_KEYWORD" ? "انتخاب محتوا" : "انتخاب استوری" },
    { number: 2 as const, title: "انتخاب پاسخ" },
    { number: 3 as const, title: "تنظیم پاسخ" },
  ];
  const activeStepTitle = flowSteps[flowStep - 1]?.title ?? flowSteps[0].title;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-2 sm:py-4">
      <section
        aria-label="مراحل ساخت پاسخ خودکار"
        className="rounded-2xl border p-2 sm:p-4"
        style={{ borderColor: dairaPalette.border, background: dairaPalette.background.surface }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-[11px] font-bold sm:text-xs" style={{ color: dairaPalette.text.body }}>
            مرحله {new Intl.NumberFormat("fa-IR").format(flowStep)} از ۳
          </span>
          <span className="min-w-0 truncate text-left text-[11px] font-bold sm:text-xs" style={{ color: dairaPalette.text.heading }}>
            {activeStepTitle}
          </span>
        </div>
        <ol className="mt-2 grid list-none grid-cols-3 gap-1.5 sm:gap-2 p-0" aria-label="وضعیت مراحل ساخت پاسخ خودکار">
          {flowSteps.map((step) => {
            const isActive = step.number === flowStep;
            const isComplete = step.number < flowStep;
            const stepSurface = isActive
              ? dairaPalette.secondary.hoverBackground
              : isComplete
                ? dairaPalette.secondary.activeBackground
                : dairaPalette.background.surfaceHover;
            const stepBorder = isActive
              ? dairaPalette.primary.main
              : isComplete
                ? dairaPalette.secondary.activeBackground
                : dairaPalette.border;
            const stepText = isActive
              ? dairaPalette.text.heading
              : isComplete
                ? dairaPalette.primary.main
                : dairaPalette.text.muted;
            const stepCircleBackground = isActive
              ? dairaPalette.primary.main
              : isComplete
                ? dairaPalette.background.surface
                : dairaPalette.background.surfaceActive;
            const stepCircleColor = isActive
              ? dairaPalette.background.surface
              : isComplete
                ? dairaPalette.primary.main
                : dairaPalette.text.muted;
            const stepContent = (
              <>
                <span
                  className="inline-flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{ background: stepCircleBackground, color: stepCircleColor, border: `1px solid ${stepBorder}` }}
                  aria-hidden="true"
                >
                  {isComplete ? <Check size={13} strokeWidth={2.5} /> : new Intl.NumberFormat("fa-IR").format(step.number)}
                </span>
                <span className="min-w-0 leading-4 max-[480px]:hidden">{step.title}</span>
              </>
            );
            return (
              <li key={step.number} className="min-w-0">
                {isComplete ? (
                  <button
                    type="button"
                    onClick={() => { setFlowStep(step.number); setError(""); }}
                    aria-label={`بازگشت به مرحله ${new Intl.NumberFormat("fa-IR").format(step.number)}: ${step.title}`}
                    className="flex min-h-[38px] w-full items-center justify-center gap-1 rounded-xl border px-1 py-1 text-center text-[10px] font-bold transition-colors hover:brightness-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)] sm:min-h-12 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                    style={{ borderColor: stepBorder, background: stepSurface, color: stepText }}
                  >
                    {stepContent}
                  </button>
                ) : (
                  <div
                    aria-current={isActive ? "step" : undefined}
                    aria-disabled={!isActive}
                    className="flex min-h-[38px] w-full items-center justify-center gap-1 rounded-xl border px-1 py-1 text-center text-[10px] font-bold sm:min-h-12 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                    style={{ borderColor: stepBorder, background: stepSurface, color: stepText }}
                  >
                    {stepContent}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="space-y-5">
            {flowStep === 1 && !mediaId && (
              <AutomationPicker
                items={mediaItems}
                selectedIds={selectedMediaIds}
                loading={mediaLoading}
                showContentFilters={triggerType === "COMMENT_KEYWORD"}
                onToggle={(id) => setSelectedMediaIds((current) => triggerType === "COMMENT_KEYWORD" ? (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) : [id])}
              />
            )}
            {flowStep === 1 && triggerType === "STORY_REPLY_KEYWORD" && mediaId && (
              <section className="flex items-center gap-3 rounded-2xl border border-[var(--daira-outline-active-bg)] bg-[var(--daira-outline-hover-bg)] p-3.5 sm:p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[var(--daira-primary)]">
                  {(() => { const selected = mediaItems.find((item) => item.id === mediaId); const image = selected?.thumbnail_url || selected?.media_url; return image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Camera size={18} />; })()}
                </span>
                <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[var(--daira-heading)]">استوری انتخاب‌شده</p><p className="mt-1 truncate text-[11px] leading-5 text-[var(--daira-text)]">استوری انتخاب‌شده برای اتصال پاسخ خودکار</p></div>
                <button type="button" onClick={() => router.push("/dashboard/story-automation/new")} className="shrink-0 rounded-lg border border-[var(--daira-outline-active-bg)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--daira-primary)] transition hover:bg-[var(--daira-outline-active-bg)]">تغییر استوری</button>
              </section>
            )}
            {flowStep === 1 && triggerType === "COMMENT_KEYWORD" && mediaId && (
              <section className="flex items-center gap-3 rounded-2xl border border-[var(--daira-outline-active-bg)] bg-[var(--daira-outline-hover-bg)] p-3.5 sm:p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[var(--daira-primary)]">
                  {(() => { const selected = mediaItems.find((item) => item.id === mediaId); const image = selected?.thumbnail_url || selected?.media_url; return image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Camera size={18} />; })()}
                </span>
                <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[var(--daira-heading)]">محتوای انتخاب‌شده</p><p className="mt-1 truncate text-[11px] leading-5 text-[var(--daira-text)]">{mediaItems.find((item) => item.id === mediaId)?.caption?.trim() || "پست یا ریلز انتخاب‌شده برای این پاسخ خودکار"}</p></div>
                <button type="button" onClick={() => router.push("/dashboard/comment-automation/new")} className="shrink-0 rounded-lg border border-[var(--daira-outline-active-bg)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--daira-primary)] transition hover:bg-[var(--daira-outline-active-bg)]">تغییر محتوا</button>
              </section>
            )}
            {flowStep === 2 && (
              <section
                className="rounded-2xl border p-4 sm:p-5"
                style={{ borderColor: dairaPalette.border, background: dairaPalette.background.surface }}
              >
                <div className="mb-4 flex justify-start">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                    style={{ background: dairaPalette.secondary.hoverBackground, color: dairaPalette.text.body }}
                    aria-label={`${automationTemplates.length} پاسخ خودکار`}
                  >
                    <strong className="font-extrabold" style={{ color: dairaPalette.primary.main }}>
                      {new Intl.NumberFormat("fa-IR").format(automationTemplates.length)}
                    </strong>
                    <span>پاسخ خودکار</span>
                  </span>
                </div>
                {loadingResources ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="در حال دریافت پاسخ‌های قبلی">
                    {[0, 1].map((item) => (
                      <div
                        key={item}
                        className="h-[76px] animate-pulse rounded-xl"
                        style={{ background: dairaPalette.background.surfaceActive }}
                      />
                    ))}
                  </div>
                ) : automationTemplates.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto overscroll-contain rounded-xl pr-1">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {automationTemplates.map((template) => {
                    const previewMessages = normalizeMessages(template.messages);
                    const preview = previewMessages[0]?.text?.trim() || (previewMessages[0]?.messageType === "SHOWCASE" ? "ارسال ویترین" : previewMessages[0]?.messageType === "FORM" ? "ارسال فرم" : previewMessages[0]?.messageType === "IMAGE" ? "ارسال تصویر" : previewMessages[0]?.messageType === "VIDEO" ? "ارسال ویدیو" : previewMessages[0]?.messageType === "AUDIO" ? "ارسال پیام صوتی" : "بدون متن پاسخ");
                    const selected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyAutomationTemplate(template)}
                        aria-pressed={selected}
                        className="rounded-xl border p-3 text-right transition focus:outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/20"
                        style={{
                          borderColor: selected ? dairaPalette.primary.main : dairaPalette.border,
                          background: selected ? dairaPalette.secondary.hoverBackground : dairaPalette.background.surface,
                          boxShadow: selected ? `0 1px 3px ${dairaPalette.primary.main}20` : undefined,
                        }}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <strong className="min-w-0 text-xs font-bold leading-5" style={{ color: dairaPalette.text.heading }}>
                            {(template.keyword || "").split(/[,،;؛\n]+/).filter(Boolean).slice(0, 3).join("، ") || "بدون کلمه کلیدی"}
                          </strong>
                          <span
                            className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold"
                            style={{
                              background: selected ? dairaPalette.primary.main : dairaPalette.background.surfaceActive,
                              color: selected ? dairaPalette.background.surface : dairaPalette.text.body,
                            }}
                          >
                            {selected ? "برای اتصال انتخاب شد" : "اتصال این پاسخ"}
                          </span>
                        </span>
                        <span className="mt-2 block truncate text-[11px] leading-5" style={{ color: dairaPalette.text.body }}>
                          {preview}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                  </div>
                ) : (
                  <p
                    className="rounded-xl border border-dashed px-3 py-4 text-xs leading-6"
                    style={{ borderColor: dairaPalette.form.borderHover, background: dairaPalette.background.surfaceHover, color: dairaPalette.text.body }}
                  >
                    هنوز پاسخ خودکار قبلی برای این نوع وجود ندارد. می‌توانی تنظیمات را از ابتدا وارد کنی.
                  </p>
                )}
              </section>
            )}
            {flowStep === 3 && creationMode === "new" && (
            <div className="space-y-5">
            <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><Zap size={16} strokeWidth={2.2} aria-hidden="true" /></span><label className="block text-sm font-bold text-[var(--daira-heading)]">شرط فعال‌سازی</label></div>
              <p className="mb-3 text-xs leading-5 text-[var(--daira-text)]">
                {triggerType === "COMMENT_KEYWORD" ? (keywordMatchMode === "CONTAINS_ANY" ? "با ثبت هر کامنت زیر پست یا ریلز انتخاب‌شده، همین پاسخ ارسال می‌شود." : "با ثبت یکی از کلمات کلیدی مشخص‌شده در کامنت، پاسخ خودکار فعال می‌شود.") : "با وارد شدن یکی از کلمات کلیدی در Reply استوری، پاسخ خودکار فعال می‌شود."}
              </p>
              {keywordMatchMode !== "CONTAINS_ANY" && keywords.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {keywords.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]">
                      {item}
                      <button type="button" onClick={() => setKeyword(keywords.filter((value) => value !== item).join(","))} className="text-[var(--daira-text)] hover:text-[var(--daira-error-text)]" aria-label={"حذف " + item}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {keywordMatchMode !== "CONTAINS_ANY" && <div>
                <div className="mb-2 flex items-center justify-between gap-2"><label className="block text-xs text-[var(--daira-text)]">حداکثر {MAX_KEYWORDS} کلمه کلیدی</label><span className="text-[11px] text-[var(--daira-text)]">{keywords.length} از {MAX_KEYWORDS}</span></div>
                <div className="flex items-center gap-2">
                  <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="یک کلمه کلیدی وارد کنید" disabled={keywords.length >= MAX_KEYWORDS} className="min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)] focus:ring-2 focus:ring-[color:var(--daira-primary)]/10 disabled:bg-[var(--daira-surface-active)]" style={{ fontSize: "16px" }} />
                  <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim() || keywords.length >= MAX_KEYWORDS} className="min-h-11 shrink-0 rounded-lg bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:bg-[var(--daira-disabled-bg)] disabled:text-[var(--daira-disabled-text)]">افزودن</button>
                </div>
              </div>}
              {triggerType === "COMMENT_KEYWORD" && (
                <div className="mb-3 rounded-xl border border-[var(--daira-border)] p-3">
                  <p className="mb-2 text-xs font-bold text-[var(--daira-heading)]">روش فعال‌سازی پاسخ</p>
                  <div role="radiogroup" aria-label="روش فعال‌سازی پاسخ" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (keywordMatchMode === "EXACT" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-border)] bg-white text-[var(--daira-text)]")}>
                      <input type="radio" name="comment-keyword-match-mode" value="EXACT" checked={keywordMatchMode === "EXACT"} onChange={() => { setKeywordMatchMode("EXACT"); setKeyword(""); setKeywordDraft(""); }} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="mb-1 block">کلمات کلیدی مشخص</strong>
                        <span className="block leading-5">فقط وقتی کامنت با یکی از کلمات تعیین‌شده برابر باشد پاسخ ارسال می‌شود.</span>
                      </span>
                    </label>
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (keywordMatchMode === "CONTAINS_ANY" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-border)] bg-white text-[var(--daira-text)]")}>
                      <input type="radio" name="comment-keyword-match-mode" value="CONTAINS_ANY" checked={keywordMatchMode === "CONTAINS_ANY"} onChange={() => { setKeywordMatchMode("CONTAINS_ANY"); setKeyword(""); setKeywordDraft(""); }} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="mb-1 block">شامل هر کلمه</strong>
                        <span className="block leading-5">با ثبت هر کامنت زیر محتوای انتخاب‌شده، پاسخ خودکار ارسال می‌شود.</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

            </div>

            {triggerType === "COMMENT_KEYWORD" && (
              <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><MessageCircle size={15} strokeWidth={2.1} aria-hidden="true" /></span><label className="block text-sm font-bold text-[var(--daira-heading)]">پاسخ زیر کامنت</label></div>
                <textarea value={commentReply} onChange={(e) => setCommentReply(e.target.value)} rows={3} maxLength={2000} placeholder="پاسخی که زیر کامنت کاربر منتشر می‌شود بنویس..." className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none placeholder:text-[11px] placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis focus:border-[var(--daira-input-focus)] focus:bg-white focus:ring-2 focus:ring-[color:var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />
              </div>
            )}

              {triggerType === "COMMENT_KEYWORD" ? (
                <section className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><Send size={15} strokeWidth={2.1} aria-hidden="true" /></span>
                      <h2 className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>پیام دایرکت</h2>
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: dairaPalette.text.body }}>متنی را که پس از کامنت برای کاربر ارسال می‌شود بنویس.</p>
                  </div>

                  <div role="radiogroup" aria-label="نوع پیام دایرکت" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (dmMode === "TEXT" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]" : "border-[var(--daira-border)] bg-white")}>
                      <input type="radio" name="direct-message-mode" value="TEXT" checked={dmMode === "TEXT"} onChange={() => setDmMode("TEXT")} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>متن ساده</strong>
                        <span className="mt-1 block leading-5" style={{ color: dairaPalette.text.body }}>ارسال پیام متنی بدون دکمه</span>
                      </span>
                    </label>
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (dmMode === "TEXT_WITH_LINK" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]" : "border-[var(--daira-border)] bg-white")}>
                      <input type="radio" name="direct-message-mode" value="TEXT_WITH_LINK" checked={dmMode === "TEXT_WITH_LINK"} onChange={() => setDmMode("TEXT_WITH_LINK")} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>متن همراه دکمه لینک</strong>
                        <span className="mt-1 block leading-5" style={{ color: dairaPalette.text.body }}>نمایش یک دکمه برای باز کردن لینک</span>
                      </span>
                    </label>
                  </div>

                  <textarea value={message.text} onChange={(event) => setMessage((current) => ({ ...current, messageType: "TEXT", text: event.target.value, mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: [] }))} maxLength={dmMode === "TEXT_WITH_LINK" ? 640 : 2000} rows={4} placeholder="متن دایرکتی که بعد از کامنت برای کاربر ارسال می‌شود..." className="w-full rounded-xl border bg-white px-3.5 py-3 text-base leading-7 outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />

                  {dmMode === "TEXT_WITH_LINK" && (
                    <div className="space-y-3">
                      <p className="text-xs leading-5" style={{ color: dairaPalette.text.body }}>حداکثر {MAX_LINK_BUTTONS} دکمه لینک می‌توانید اضافه کنید.</p>
                      {linkButtons.map((button, index) => (
                        <div key={index} className="rounded-xl border p-3" style={{ borderColor: dairaPalette.form.border }}>
                          <div className="mb-3 flex items-center justify-between">
                            <strong className="text-xs" style={{ color: dairaPalette.text.heading }}>دکمه {index + 1}</strong>
                            {linkButtons.length > 1 && <button type="button" onClick={() => setLinkButtons((current) => current.filter((_, i) => i !== index))} className="text-xs font-semibold text-[var(--daira-error-text)]">حذف</button>}
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>آدرس لینک</label>
                              <input type="url" value={button.url} onChange={(event) => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} placeholder="https://example.com" dir="ltr" className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>عنوان دکمه (حداکثر ۲۰ کاراکتر)</label>
                              <input value={button.title} onChange={(event) => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value.slice(0, 20) } : item))} maxLength={20} placeholder="مشاهده لینک" className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {linkButtons.length < MAX_LINK_BUTTONS && <button type="button" onClick={() => setLinkButtons((current) => [...current, { title: "", url: "" }])} className="min-h-10 rounded-lg border px-3 text-xs font-semibold" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.primary.main }}>افزودن دکمه لینک</button>}
                    </div>
                  )}

                  <section className="border-t pt-5" style={{ borderColor: dairaPalette.border }}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><ShieldCheck size={15} strokeWidth={2.1} aria-hidden="true" /></span>
                      <span className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>شرط فالو</span>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors" style={{ borderColor: requireFollow ? dairaPalette.primary.main : dairaPalette.border, background: requireFollow ? dairaPalette.secondary.hoverBackground : dairaPalette.background.surfaceHover }}>
                      <input type="checkbox" role="switch" aria-label="الزام به فالو قبل از ارسال پاسخ" aria-checked={requireFollow} checked={requireFollow} onChange={(event) => setRequireFollow(event.target.checked)} className="daira-form-switch mt-1" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>الزام به فالو قبل از ارسال پاسخ (اختیاری)</strong>
                        <span className="mt-1 block text-xs leading-5" style={{ color: dairaPalette.text.body }}>اگر کاربر پیج را فالو نکرده باشد، ابتدا پیام درخواست فالو و دکمه بررسی ارسال می‌شود.</span>
                      </span>
                    </label>
                    {requireFollow && (
                      <div className="mt-3">
                        <label className="mb-2 block text-sm font-semibold" style={{ color: dairaPalette.text.heading }}>متن درخواست فالو</label>
                        <textarea value={followGateText} onChange={(event) => setFollowGateText(event.target.value)} maxLength={640} rows={3} placeholder="برای دریافت پاسخ، ابتدا پیج ما را فالو کنید." className="w-full rounded-xl border bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading }} />
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
            )}

          </div>

          {error && <div role="alert" className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-6 text-[var(--daira-error-text)]">{error}</div>}

        {flowStep === 1 && (
          <div className="daira-flow-action-dock" role="group" aria-label="ادامه ساخت پاسخ خودکار">
            <div className="daira-flow-action-dock__inner">
              <button
                type="button"
                onClick={() => {
                  setFlowStep(2);
                  setError("");
                }}
                disabled={mediaLoading || selectedMediaCount === 0}
                className="daira-flow-action-dock__button daira-flow-action-dock__button--primary"
              >
                ادامه ({new Intl.NumberFormat("fa-IR").format(selectedMediaCount)} محتوا)
              </button>
            </div>
          </div>
        )}

        {flowStep === 2 && (
          <div className="daira-flow-action-dock" role="group" aria-label="اقدامات پاسخ خودکار">
            <div className="daira-flow-action-dock__inner">
              <button
                type="button"
                onClick={() => {
                  setCreationMode("existing");
                  void saveAutomation();
                }}
                disabled={!selectedTemplateId || loadingResources || mediaLoading || selectedMediaCount === 0 || saving}
                className="daira-flow-action-dock__button daira-flow-action-dock__button--primary"
              >
                {saving ? "در حال اتصال..." : "انتخاب پاسخ"}
              </button>
              <button
                type="button"
                onClick={startNewAutomation}
                disabled={Boolean(selectedTemplateId) || saving}
                className="daira-flow-action-dock__button daira-flow-action-dock__button--secondary"
              >
                ساخت پاسخ جدید
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
