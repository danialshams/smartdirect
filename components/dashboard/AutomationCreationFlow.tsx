"use client";

import { ArrowRight, Camera, Image, Images, Loader2, MessageCircleReply, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/DashboardUI";
import PublishingStoryAutomationSetup from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import type { Automation } from "./AutomationManager";

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
  const setupRef = useRef<{ saveAndContinue: () => Promise<boolean> } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [commentReply, setCommentReply] = useState("");
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
          mediaId,
          keyword: cleanKeywords.join(","),
          commentReplyText: triggerType === "COMMENT_KEYWORD" ? commentReply.trim() || null : null,
          replyText: null,
          likeComment: false,
          sendDm: true,
          likeIncomingDm: false,
          likeStoryReply: false,
          requireFollow: false,
          followGateText: null,
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
        <Button type="button" onClick={() => router.back()} className="mb-7 min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]">
          <ArrowRight size={15} strokeWidth={2} />بازگشت
        </Button>

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
              <div className="flex items-center gap-2">
                <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="مثلاً قیمت، اطلاعات" className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-3 !text-base text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px" }} />
                <Button type="button" onClick={addKeyword} disabled={!keywordDraft.trim()} className="min-h-11 shrink-0 rounded-lg !bg-[#2563EB] px-3.5 text-xs font-semibold text-white hover:!bg-[#1D4ED8]">افزودن</Button>
              </div>
            </div>

            {triggerType === "COMMENT_KEYWORD" && (
              <div className="border-t border-[#E2E8F0] pt-5">
                <label className="mb-2 block text-sm font-bold text-[#0F172A]">متن ارسالی در کامنت</label>
                <textarea value={commentReply} onChange={(e) => setCommentReply(e.target.value)} rows={3} maxLength={2000} placeholder="پاسخی که زیر کامنت کاربر منتشر می‌شود بنویس..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />
              </div>
            )}

            <div className="border-t border-[#E2E8F0] pt-5">
              <PublishingStoryAutomationSetup
                ref={setupRef}
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
                  void saveAutomation(next);
                }}
                disabled={saving}
                showFinalSave
                finalSaveLabel="ساخت پاسخ خودکار"
                finalSaveLoadingLabel="در حال ساخت پاسخ خودکار..."
                finalSaveDisabled={saving}
                responseTypeTitle="نوع پاسخ خودکار"
                responseTypeDescription="نوع پاسخی را که می‌خواهید برای این محتوا ارسال شود انتخاب کنید."
                textPlaceholder={triggerType === "COMMENT_KEYWORD" ? "متن دایرکتی که بعد از کامنت برای کاربر ارسال می‌شود..." : "متنی که در پاسخ خودکار برای کاربر ارسال می‌شود..."}
              />
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium text-[#B91C1C]">{error}</div>}
        </section>
      </div>
    </div>
  );
}
