"use client";

import { Button, Input, Select, Textarea } from "@/components/dashboard/DashboardUI";
import {
  ArrowDown,
  BookmarkPlus,
  ArrowUp,
  Check,
  ChevronDown,
  ClipboardList,
  ImagePlus,
  MessageSquareText,
  Mic,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
import { uploadFileWithProgress } from "./publishing/shared-upload";
import { requestStorageCleanupByPublicUrl, useStorageUploadLease } from "./publishing/useStorageUploadLease";
import type { AutomationTriggerType } from "./AutomationManager";
import type {
  FormItem,
  MessageDraft,
  QuickReplyDestinationType,
  QuickReplyDraft,
  Showcase,
} from "./automation-form-utils";

type Props = {
  message: MessageDraft;
  triggerType: AutomationTriggerType;
  index: number;
  total: number;
  showcases: Showcase[];
  forms?: FormItem[];
  loadingResources: boolean;
  instagramAccountId?: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onAddQuickReply: () => void;
  onUpdateQuickReply: (quickReplyId: string, patch: Partial<QuickReplyDraft>) => void;
  onUpdateQuickReplyTree: (
    quickReplyId: string,
    updater: (quickReply: QuickReplyDraft) => QuickReplyDraft,
  ) => void;
  onRemoveQuickReply: (quickReplyId: string) => void;
  onShowcaseCreated?: (showcase: Showcase) => void;
  onFormCreated?: (form: FormItem) => void;
};

type MediaKind = "IMAGE" | "VIDEO" | "AUDIO";

type ShowcaseItemDraft = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  previewUrl: string;
};

const palette = {
  primary: "var(--daira-primary)",
  automation: "var(--daira-processing)",
  success: "var(--daira-publishing-completed)",
  warning: "var(--daira-warning)",
  error: "var(--daira-error-text)",
  text: "var(--daira-heading)",
  secondary: "var(--daira-text-secondary)",
  border: "var(--daira-border)",
  surface: "var(--daira-surface)",
  muted: "var(--daira-surface-hover)",
};

const newShowcaseItem = (): ShowcaseItemDraft => ({
  id: `showcase_item_${crypto.randomUUID()}`,
  title: "",
  description: "",
  imageUrl: "",
  previewUrl: "",
});

type SavedAutomationResponse = Pick<MessageDraft, "messageType" | "text" | "mediaUrl" | "mediaId" | "showcaseId" | "formId" | "quickReplies"> & { id: string; title?: string };

async function readJsonResponse(response: Response, fallback: string) {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(`${fallback} (پاسخ خالی از سرور)`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${fallback} (پاسخ نامعتبر از سرور)`);
  }
}

async function uploadFile(file: File, onProgress: (progress: number) => void = () => undefined): Promise<string> {
  const result = await uploadFileWithProgress(file, "MESSAGE", onProgress, { purpose: "AUTOMATION" });
  return result.publicUrl;
}

async function uploadBranchMedia(file: File, onProgress: (progress: number) => void): Promise<string> {
  return uploadFile(file, onProgress);
}

const typeOptions: Array<{
  value: MessageDraft["messageType"];
  label: string;
  Icon: LucideIcon;
  color: string;
  softColor: string;
}> = [
  { value: "TEXT", label: "متن", Icon: MessageSquareText, color: palette.primary, softColor: "var(--daira-outline-hover-bg)" },
  { value: "IMAGE", label: "تصویر", Icon: ImagePlus, color: palette.automation, softColor: "#F5F3FF" },
  { value: "AUDIO", label: "وویس", Icon: Mic, color: palette.warning, softColor: "var(--daira-warning-bg)" },
];

export default function AutomationFlowMessage({
  message,
  triggerType,
  index,
  total,
  showcases,
  forms,
  loadingResources,
  instagramAccountId,
  onUpdate,
  onAddQuickReply,
  onUpdateQuickReply,
  onUpdateQuickReplyTree,
  onRemoveQuickReply,
  onShowcaseCreated,
}: Props) {
  const availableTypes = useMemo(
    () =>
      triggerType === "COMMENT_KEYWORD"
        ? typeOptions.filter((item) => item.value === "TEXT")
        : typeOptions,
    [triggerType],
  );

  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [mediaRetryFile, setMediaRetryFile] = useState<File | null>(null);
  const [contentStep, setContentStep] = useState(false);
  const [error, setError] = useState("");
  const [savedResponses, setSavedResponses] = useState<SavedAutomationResponse[]>([]);
  const [savedResponseTitle, setSavedResponseTitle] = useState("");
  const [savedResponseLoading, setSavedResponseLoading] = useState(false);
  const [savedResponseSaving, setSavedResponseSaving] = useState(false);
  const [selectedSavedResponseId, setSelectedSavedResponseId] = useState("");
  const [savedResponseDeleting, setSavedResponseDeleting] = useState(false);
  const [savedResponseError, setSavedResponseError] = useState("");

  useEffect(() => {
    if (!instagramAccountId) {
      setSavedResponses([]);
      return;
    }
    let cancelled = false;
    setSavedResponseLoading(true);
    fetch(`/api/saved-responses?instagramAccountId=${encodeURIComponent(instagramAccountId)}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result?.success) throw new Error(result?.error || "دریافت پاسخ‌های ذخیره‌شده ناموفق بود.");
        if (!cancelled) setSavedResponses(Array.isArray(result.data) ? result.data as SavedAutomationResponse[] : []);
      })
      .catch((loadError) => {
        if (!cancelled) setSavedResponseError(loadError instanceof Error ? loadError.message : "دریافت پاسخ‌های ذخیره‌شده ناموفق بود.");
      })
      .finally(() => {
        if (!cancelled) setSavedResponseLoading(false);
      });
    return () => { cancelled = true; };
  }, [instagramAccountId]);

  async function saveCurrentResponse() {
    if (!instagramAccountId) return;
    const title = savedResponseTitle.trim();
    if (!title) {
      setSavedResponseError("برای پاسخ ذخیره‌شده یک عنوان بنویس.");
      return;
    }
    setSavedResponseSaving(true);
    setSavedResponseError("");
    try {
      const response = await fetch("/api/saved-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId,
          title,
          messageType: message.messageType,
          text: message.text || null,
          mediaUrl: message.mediaUrl || null,
          mediaId: message.mediaId || null,
          showcaseId: message.showcaseId || null,
          formId: message.formId || null,
          quickReplies: message.quickReplies || [],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success || !result?.data?.id) {
        throw new Error(result?.error || "ذخیره پاسخ ناموفق بود.");
      }
      const savedResponse = result.data as SavedAutomationResponse;
      setSavedResponses((current) => [savedResponse, ...current.filter((item) => item.id !== savedResponse.id)]);
      setSavedResponseTitle("");
    } catch (saveError) {
      setSavedResponseError(saveError instanceof Error ? saveError.message : "ذخیره پاسخ ناموفق بود.");
    } finally {
      setSavedResponseSaving(false);
    }
  }

  function applySavedResponse(saved: SavedAutomationResponse) {
    const cloneQuickReply = (reply: QuickReplyDraft): QuickReplyDraft => ({
      ...reply,
      id: `quick_reply_${crypto.randomUUID()}`,
      payload: `payload_${crypto.randomUUID()}`,
      nextMessageId: null,
      destinationQuickReplies: Array.isArray(reply.destinationQuickReplies)
        ? reply.destinationQuickReplies.map(cloneQuickReply)
        : [],
    });
    onUpdate({
      messageType: saved.messageType,
      text: saved.text || "",
      mediaUrl: saved.mediaUrl || "",
      mediaId: saved.mediaId || "",
      showcaseId: saved.showcaseId || "",
      formId: saved.formId || "",
      quickReplies: Array.isArray(saved.quickReplies) ? saved.quickReplies.map(cloneQuickReply) : [],
    });
    setContentStep(saved.messageType !== "TEXT");
    setSavedResponseError("");
  }

  useEffect(() => {
    if (triggerType === "COMMENT_KEYWORD" && message.messageType !== "TEXT") {
      onUpdate({
        messageType: "TEXT",
        mediaUrl: "",
        mediaId: "",
        showcaseId: "",
        formId: "",
        quickReplies: [],
      });
    }
  }, [triggerType, message.messageType, onUpdate]);

  async function handleMedia(file?: File): Promise<boolean> {
    if (file?.type.startsWith("video/")) { setError("آپلود ویدیو برای پاسخ‌های خودکار فعلاً غیرفعال است."); return false; }
    if (!file) return false;
    setError("");
    setMediaUploading(true);
    setMediaRetryFile(file);
    setMediaProgress(15);
    try {
      const url = await uploadFile(file, setMediaProgress);
      setMediaProgress(100);
      if (message.mediaUrl && message.mediaUrl !== url) {
        void requestStorageCleanupByPublicUrl(message.mediaUrl).catch(() => undefined);
      }
      onUpdate({ mediaUrl: url, mediaId: "" });
      setMediaRetryFile(null);
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
      return false;
    } finally {
      setMediaUploading(false);
    }
  }

  function clearMessageMedia() {
    void requestStorageCleanupByPublicUrl(message.mediaUrl).catch(() => undefined);
    onUpdate({ mediaUrl: "", mediaId: "" });
    setMediaRetryFile(null);
    setMediaProgress(0);
    setError("");
  }

  return (
    <article dir="rtl" className="daira-flow-glass relative overflow-hidden rounded-[28px] border bg-white" style={{ borderColor: palette.border }}>
      {instagramAccountId && (
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center" style={{ borderColor: palette.border, background: "var(--daira-surface-hover)" }}>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <input
              value={savedResponseTitle}
              onChange={(event) => setSavedResponseTitle(event.target.value)}
              maxLength={80}
              placeholder="عنوان برای ذخیره پاسخ (مثلاً معرفی محصول)"
              aria-label="عنوان پاسخ ذخیره‌شده"
              className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              style={{ borderColor: palette.border }}
            />
            <button
              type="button"
              disabled={savedResponseSaving}
              onClick={() => void saveCurrentResponse()}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: palette.primary }}
            >
              <Save size={16} />
              {savedResponseSaving ? "در حال ذخیره..." : "ذخیره پاسخ"}
            </button>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:w-[300px]">
            <BookmarkPlus size={17} style={{ color: palette.secondary, flexShrink: 0 }} />
            <select
              aria-label="استفاده از پاسخ ذخیره‌شده"
              defaultValue=""
              disabled={savedResponseLoading || savedResponses.length === 0}
              value={selectedSavedResponseId}
              onChange={(event) => setSelectedSavedResponseId(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2.5 text-sm"
              style={{ borderColor: palette.border }}
            >
              <option value="">{savedResponseLoading ? "در حال دریافت پاسخ‌ها..." : savedResponses.length ? "انتخاب پاسخ ذخیره‌شده..." : "پاسخی ذخیره نشده است"}</option>
              {savedResponses.map((saved) => (
                <option key={saved.id} value={saved.id}>{saved.title} · {saved.messageType}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedSavedResponseId || savedResponseDeleting}
              onClick={() => {
                const selected = savedResponses.find((item) => item.id === selectedSavedResponseId);
                if (selected) applySavedResponse(selected);
              }}
              className="rounded-xl border bg-white px-3 py-2.5 text-xs font-bold disabled:opacity-40"
              style={{ borderColor: palette.border, color: palette.primary }}
            >
              استفاده
            </button>
            <button
              type="button"
              title="حذف از پاسخ‌های ذخیره‌شده"
              aria-label="حذف پاسخ ذخیره‌شده"
              disabled={!selectedSavedResponseId || savedResponseDeleting}
              onClick={() => {
                const selected = savedResponses.find((item) => item.id === selectedSavedResponseId);
                if (!selected || !window.confirm("پاسخ انتخاب‌شده از فهرست ذخیره‌شده‌ها حذف شود؟")) return;
                setSavedResponseDeleting(true);
                setSavedResponseError("");
                fetch("/api/saved-responses/" + encodeURIComponent(selected.id), {
                  method: "DELETE",
                  credentials: "include",
                })
                  .then(async (response) => {
                    const result = await response.json();
                    if (!response.ok || !result?.success) throw new Error(result?.error || "حذف پاسخ ناموفق بود.");
                    setSavedResponses((current) => current.filter((item) => item.id !== selected.id));
                    setSelectedSavedResponseId("");
                  })
                  .catch((deleteError) => setSavedResponseError(deleteError instanceof Error ? deleteError.message : "حذف پاسخ ناموفق بود."))
                  .finally(() => setSavedResponseDeleting(false));
              }}
              className="rounded-xl border bg-white px-3 py-2.5 text-xs font-bold disabled:opacity-40"
              style={{ borderColor: "var(--daira-error-border)", color: palette.error }}
            >
              {savedResponseDeleting ? "..." : "حذف"}
            </button>
          </div>
          {savedResponseError && <p className="text-xs" style={{ color: palette.error }}>{savedResponseError}</p>}
        </div>
      )}

      <div
        className={[
          "transition-all duration-300 ease-out",
          contentStep ? "pointer-events-none max-h-0 -translate-y-3 overflow-hidden opacity-0" : "max-h-[720px] translate-y-0 opacity-100",
        ].join(" ")}
      >
        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {availableTypes.map(({ value, label, Icon, color, softColor }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  onUpdate({ messageType: value });
                  setContentStep(true);
                }}
                className="group flex min-h-[170px] flex-col items-center justify-center rounded-[24px] border-2 bg-white p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] active:translate-y-0 sm:min-h-[190px]"
                style={{ borderColor: color }}
              >
                <span
                  className="flex h-20 w-20 items-center justify-center rounded-[22px] transition-transform duration-200 group-hover:scale-105"
                  style={{ background: softColor, color }}
                >
                  <Icon size={34} strokeWidth={1.9} />
                </span>
                <span className="mt-5 text-sm font-bold" style={{ color: palette.text }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={[
          "transition-all duration-300 ease-out",
          contentStep ? "translate-y-0 opacity-100" : "pointer-events-none max-h-0 translate-y-3 overflow-hidden opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setContentStep(false)}
          className="absolute left-4 top-4 z-10 inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[11px] font-bold transition-colors hover:bg-slate-50"
          style={{ borderColor: palette.border, color: palette.secondary }}
        >
          <ArrowDown className="rotate-90" size={14} />
          بازگشت
        </button>

        <section className="min-w-0 p-5 pt-16 sm:p-7 sm:pt-16">
          {message.messageType === "TEXT" && (
            <TextComposer
              message={message}
              onUpdate={onUpdate}
              onAddQuickReply={onAddQuickReply}
              onUpdateQuickReply={onUpdateQuickReply}
              onUpdateQuickReplyTree={onUpdateQuickReplyTree}
              onRemoveQuickReply={onRemoveQuickReply}
              showcases={showcases}
              instagramAccountId={instagramAccountId}
              triggerType={triggerType}
            />
          )}

          {(["IMAGE", "VIDEO", "AUDIO"] as const).includes(message.messageType as MediaKind) && (
            <MediaComposer
              kind={message.messageType as MediaKind}
              url={message.mediaUrl}
              uploading={mediaUploading}
              error={error}
              onUpload={handleMedia}
              onClear={clearMessageMedia}
              progress={mediaProgress}
              retryFile={mediaRetryFile}
            />
          )}

          {message.messageType === "SHOWCASE" && (
            <ShowcaseComposer
              instagramAccountId={instagramAccountId}
              showcaseId={message.showcaseId}
              showcases={showcases}
              onCreated={(showcase) => {
                onUpdate({ showcaseId: showcase.id });
                onShowcaseCreated?.(showcase);
              }}
            />
          )}

          {message.messageType === "FORM" && (
            <FormComposer
              message={message}
              showcases={showcases}
              instagramAccountId={instagramAccountId}
              onUpdate={onUpdate}
              onUpdateQuickReplyTree={onUpdateQuickReplyTree}
              onRemoveQuickReply={onRemoveQuickReply}
              loadingResources={loadingResources}
            />
          )}

          {error && (
            <p className="mt-4 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: "var(--daira-error-border)", background: "var(--daira-error-background)", color: palette.error }}>
              {error}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}

function TextComposer({
  message,
  onUpdate,
  onAddQuickReply,
  onUpdateQuickReply,
  onUpdateQuickReplyTree,
  onRemoveQuickReply,
  showcases,
  instagramAccountId,
  triggerType,
}: {
  message: MessageDraft;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onAddQuickReply: () => void;
  onUpdateQuickReply: (id: string, patch: Partial<QuickReplyDraft>) => void;
  onUpdateQuickReplyTree: (id: string, updater: (reply: QuickReplyDraft) => QuickReplyDraft) => void;
  onRemoveQuickReply: (id: string) => void;
  showcases: Showcase[];
  instagramAccountId?: string;
  triggerType: AutomationTriggerType;
}) {
  const canReply = triggerType !== "COMMENT_KEYWORD";
  return (
    <div className="space-y-5">
      <ComposerTitle title="پیام متنی" description="متن پاسخ را بنویس و در صورت نیاز مسیرهای انتخابی برای کاربر بساز." />

      <Field label="متن پیام" required>
        <Textarea
          value={message.text}
          onChange={(event) => onUpdate({ text: event.target.value })}
          rows={7}
          placeholder="مثلاً: سلام، خوش آمدی. از گزینه‌های زیر یکی را انتخاب کن."
          className="w-full resize-none rounded-2xl border bg-[#FAFAFC] px-4 py-3.5 text-sm leading-7 outline-none transition focus:bg-white"
          style={{ borderColor: palette.border, color: palette.text }}
        />
      </Field>

      {canReply && (
        <QuickReplySection
          replies={message.quickReplies}
          showcases={showcases}
          instagramAccountId={instagramAccountId}
          onAdd={onAddQuickReply}
          onUpdate={onUpdateQuickReplyTree}
          onRemove={onRemoveQuickReply}
          depth={0}
        />
      )}
    </div>
  );
}

function FormComposer({
  message,
  showcases,
  instagramAccountId,
  onUpdate,
  onUpdateQuickReplyTree,
  onRemoveQuickReply,
  loadingResources,
}: {
  message: MessageDraft;
  showcases: Showcase[];
  instagramAccountId?: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onUpdateQuickReplyTree: (id: string, updater: (reply: QuickReplyDraft) => QuickReplyDraft) => void;
  onRemoveQuickReply: (id: string) => void;
  loadingResources: boolean;
}) {
  return (
    <div className="space-y-5">
      <ComposerTitle title="سؤال تعاملی" description="سؤال را تعریف کن و برای هر گزینه، نتیجه یا سؤال بعدی را مشخص کن." />

      <Field label="سؤال" required>
        <Textarea
          value={message.text}
          onChange={(event) => onUpdate({ text: event.target.value })}
          rows={4}
          placeholder="مثلاً: برای چه موضوعی راهنمایی می‌خواهید؟"
          className="w-full resize-none rounded-2xl border bg-[#FAFAFC] px-4 py-3.5 text-sm leading-7 outline-none transition focus:bg-white"
          style={{ borderColor: palette.border, color: palette.text }}
        />
      </Field>

      <QuickReplySection
        replies={message.quickReplies}
        showcases={showcases}
        instagramAccountId={instagramAccountId}
        onAdd={() => {
          if (message.quickReplies.length < 13) {
            onUpdate({
              quickReplies: [
                ...message.quickReplies,
                createReply(),
              ],
            });
          }
        }}
        onUpdate={onUpdateQuickReplyTree}
        onRemove={onRemoveQuickReply}
        depth={0}
        loadingResources={loadingResources}
      />
    </div>
  );
}

function QuickReplySection({
  replies,
  showcases,
  instagramAccountId,
  onAdd,
  onUpdate,
  onRemove,
  depth,
  loadingResources = false,
}: {
  replies: QuickReplyDraft[];
  showcases: Showcase[];
  instagramAccountId?: string;
  onAdd: () => void;
  onUpdate: (id: string, updater: (reply: QuickReplyDraft) => QuickReplyDraft) => void;
  onRemove: (id: string) => void;
  depth: number;
  loadingResources?: boolean;
}) {
  return (
    <section className="daira-flow-glass rounded-2xl border p-4 sm:p-5" style={{ borderColor: palette.border, background: palette.muted }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold" style={{ color: palette.text }}>
            {depth === 0 ? "مسیرهای پاسخ" : "سؤال بعدی"}
          </p>
          <p className="mt-1 text-[10px] leading-5" style={{ color: palette.secondary }}>
            {depth === 0 ? "انتخاب کاربر را به یک مقصد مشخص وصل کن." : "برای این شاخه سؤال بعدی تعریف کن."}
          </p>
        </div>
        <Button
          type="button"
          onClick={onAdd}
          disabled={replies.length >= 13}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"
          style={{ background: palette.automation }}
        >
          <Plus size={13} />
          افزودن گزینه
        </Button>
      </div>

      {replies.length === 0 ? (
        <div className="daira-empty-state mt-4 rounded-xl border border-dashed bg-white px-4 py-7 text-center" style={{ borderColor: palette.border }}>
          <p className="text-xs font-semibold" style={{ color: palette.text }}>هنوز گزینه‌ای وجود ندارد</p>
          <p className="mt-1 text-[10px]" style={{ color: palette.secondary }}>برای شروع یک گزینه پاسخ اضافه کن.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {replies.map((reply, replyIndex) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              index={replyIndex}
              showcases={showcases}
              instagramAccountId={instagramAccountId}
              onUpdate={onUpdate}
              onRemove={onRemove}
              loadingResources={loadingResources}
              depth={depth}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReplyCard({
  reply,
  index,
  showcases,
  instagramAccountId,
  onUpdate,
  onRemove,
  loadingResources,
  depth,
}: {
  reply: QuickReplyDraft;
  index: number;
  showcases: Showcase[];
  instagramAccountId?: string;
  onUpdate: (id: string, updater: (reply: QuickReplyDraft) => QuickReplyDraft) => void;
  onRemove: (id: string) => void;
  loadingResources: boolean;
  depth: number;
}) {
  const destinationOptions: Array<[QuickReplyDestinationType, string]> = [
    ["TEXT", "متن"],
    ["FORM", "سؤال بعدی"],
    ["SHOWCASE", "ویترین"],
    ["IMAGE", "تصویر"],
    ["AUDIO", "وویس"],
  ];

  const patch = (value: Partial<QuickReplyDraft>) => onUpdate(reply.id, (current) => ({ ...current, ...value }));

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: palette.border }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: "#F5F3FF", color: palette.automation }}>
            {index + 1}
          </span>
          <span className="text-xs font-bold" style={{ color: palette.text }}>گزینه پاسخ</span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(reply.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-50"
          style={{ color: palette.secondary }}
          title="حذف گزینه"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_230px]">
        <Field label="متن گزینه" required hint="حداکثر ۲۰ کاراکتر">
          <Input
            value={reply.title}
            maxLength={20}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="مثلاً قیمت، مشاوره، اطلاعات بیشتر"
            className="w-full rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm outline-none"
            style={{ borderColor: palette.border }}
          />
        </Field>

        <Field label="بعد از انتخاب">
          <div className="relative">
            <Select
              value={reply.destinationType ?? ""}
              onChange={(event) => patch({ destinationType: (event.target.value || null) as QuickReplyDestinationType | null })}
              className="w-full appearance-none rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm outline-none"
            >
              <option value="">انتخاب مقصد</option>
              {destinationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <ChevronDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: palette.secondary }} />
          </div>
        </Field>
      </div>

      {reply.destinationType === "TEXT" && (
        <div className="mt-4">
          <Field label="متن مقصد" required>
            <Textarea
              value={reply.destinationText}
              onChange={(event) => patch({ destinationText: event.target.value })}
              rows={4}
              placeholder="متنی که بعد از انتخاب این گزینه ارسال می‌شود..."
              className="w-full resize-none rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm leading-7 outline-none"
              style={{ borderColor: palette.border }}
            />
          </Field>
        </div>
      )}

      {reply.destinationType === "SHOWCASE" && (
        <div className="mt-4">
          <ShowcaseDestination
            showcases={showcases}
            showcaseId={reply.destinationShowcaseId}
            instagramAccountId={instagramAccountId}
            loading={loadingResources}
            onChange={(id) => patch({ destinationShowcaseId: id })}
          />
        </div>
      )}

      {(["IMAGE", "VIDEO", "AUDIO"] as const).includes(reply.destinationType as MediaKind) && (
        <div className="mt-4">
          <BranchMediaDestination
            kind={reply.destinationType as MediaKind}
            url={reply.destinationMediaUrl}
            onChange={(url) => patch({ destinationMediaUrl: url, destinationMediaId: "" })}
          />
        </div>
      )}

      {reply.destinationType === "FORM" && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: palette.border, background: palette.muted }}>
          <Field label="سؤال بعدی" required>
            <Textarea
              value={reply.destinationQuestion}
              onChange={(event) => patch({ destinationQuestion: event.target.value })}
              rows={3}
              placeholder="سؤال بعدی را بنویس..."
              className="w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-sm leading-7 outline-none"
              style={{ borderColor: palette.border }}
            />
          </Field>

          <div className="mt-4">
            <QuickReplySection
              replies={reply.destinationQuickReplies}
              showcases={showcases}
              instagramAccountId={instagramAccountId}
              onAdd={() => {
                if (reply.destinationQuickReplies.length < 13) {
                  patch({ destinationQuickReplies: [...reply.destinationQuickReplies, createReply()] });
                }
              }}
              onUpdate={onUpdate}
              onRemove={(id) => patch({ destinationQuickReplies: reply.destinationQuickReplies.filter((item) => item.id !== id) })}
              depth={depth + 1}
              loadingResources={loadingResources}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ComposerTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h4 className="text-base font-bold" style={{ color: palette.text }}>{title}</h4>
      <p className="mt-1.5 max-w-2xl text-xs leading-6" style={{ color: palette.secondary }}>{description}</p>
    </div>
  );
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold" style={{ color: palette.text }}>
          {label}{required && <span className="mr-1" style={{ color: palette.error }}>*</span>}
        </span>
        {hint && <span className="text-[10px]" style={{ color: palette.secondary }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function MediaComposer({
  kind,
  url,
  uploading,
  error,
  onUpload,
  onClear,
  progress,
  retryFile,
}: {
  kind: MediaKind;
  url: string;
  uploading: boolean;
  error: string;
  onUpload: (file?: File) => void | Promise<boolean>;
  onClear: () => void;
  progress: number;
  retryFile: File | null;
}) {
  const accept = kind === "IMAGE" ? "image/jpeg,image/png,image/webp" : kind === "VIDEO" ? "video/mp4,video/quicktime" : "audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/x-wav,audio/m4a,.mp3,.m4a,.aac,.wav,.webm,.ogg";
  const labels = { IMAGE: "تصویر", VIDEO: "ویدیو", AUDIO: "وویس" } as const;
  useStorageUploadLease([url]);

  return (
    <div className="space-y-5">
      <ComposerTitle title={labels[kind]} description={kind === "AUDIO" ? "وویس را از دستگاه انتخاب کن یا با میکروفون همین‌جا ضبط و آپلود کن." : `فایل ${labels[kind]} را انتخاب کن تا در این مرحله برای کاربر ارسال شود.`} />

      {url ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--daira-success-border)", background: "var(--daira-success-bg)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#DCFCE7", color: palette.success }}>
                <Check size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: "#166534" }}>فایل آماده ارسال است</p>
                {kind === "AUDIO" ? (
                  <audio src={url} controls className="mt-2 w-full max-w-md" />
                ) : (
                  <p className="mt-1 max-w-[360px] truncate text-[10px]" dir="ltr" style={{ color: palette.secondary }}>{url}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <FilePicker accept={accept} disabled={uploading} onChange={onUpload} label="جایگزین" />
              <button type="button" onClick={onClear} className="rounded-xl border bg-white px-3 py-2 text-[11px] font-bold" style={{ borderColor: palette.border, color: palette.error }}>حذف</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {uploading || retryFile ? (
            <div className={["rounded-2xl border p-4", error && retryFile && !uploading ? "border-[var(--daira-error-border)] bg-[var(--daira-error-background)]" : "border-[#BFDBFE] bg-[var(--daira-outline-hover-bg)]"].join(" ")}>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
                <span className={error && retryFile && !uploading ? "text-[var(--daira-error-text)]" : "text-[var(--daira-primary)]"}>
                  {error && retryFile && !uploading ? "آپلود ناموفق بود" : "در حال آپلود..."}
                </span>
                <span className={error && retryFile && !uploading ? "text-[var(--daira-error-text)]" : "text-[var(--daira-primary)]"}>{progress}٪</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--daira-border)]">
                <div className={["h-full rounded-full transition-[width] duration-300", error && retryFile && !uploading ? "bg-[var(--daira-error-text)]" : "bg-[var(--daira-primary)]"].join(" ")} style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} />
              </div>
              {error && retryFile && !uploading && (
                <button type="button" onClick={() => void onUpload(retryFile)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--daira-error-text)] px-3 py-2 text-[11px] font-bold text-white">
                  <RotateCcw size={14} />
                  تلاش دوباره
                </button>
              )}
            </div>
          ) : (
            <FilePicker
              accept={accept}
              disabled={uploading}
              onChange={onUpload}
              label={`انتخاب ${labels[kind]} از دستگاه`}
              large
              kind={kind}
            />
          )}
          {kind === "AUDIO" && (
            <>
              <div className="text-center text-[10px] font-semibold text-[var(--daira-text-disabled)]">یا</div>
              <VoiceRecorder disabled={uploading} onRecorded={onUpload} />
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs" style={{ color: palette.error }}>{error}</p>}
    </div>
  );
}

function FilePicker({
  accept,
  disabled,
  onChange,
  label,
  large = false,
  kind,
}: {
  accept: string;
  disabled: boolean;
  onChange: (file?: File) => void;
  label: string;
  large?: boolean;
  kind?: MediaKind;
}) {
  const Icon = kind === "VIDEO" ? Video : kind === "AUDIO" ? Mic : Upload;
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition hover:bg-[#F5F3FF] ${large ? "min-h-[230px]" : "min-h-11"} ${disabled ? "pointer-events-none opacity-60" : ""}`}
      style={{ borderColor: "var(--daira-outline)", background: large ? palette.muted : palette.surface }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "#F5F3FF", color: palette.automation }}>
        <Icon size={22} />
      </span>
      <span className="mt-3 text-xs font-bold" style={{ color: palette.text }}>{label}</span>
      {large && <span className="mt-1 text-[10px]" style={{ color: palette.secondary }}>فایل را از دستگاه انتخاب کن</span>}
      <Input type="file" accept={accept} className="hidden" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; onChange(file); }} />
    </label>
  );
}

function ShowcaseDestination({
  showcases,
  showcaseId,
  instagramAccountId,
  loading,
  onChange,
}: {
  showcases: Showcase[];
  showcaseId: string;
  instagramAccountId?: string;
  loading: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="ویترین">
        <Select
          value={showcaseId}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm outline-none"
          disabled={loading}
        >
          <option value="">{loading ? "در حال دریافت ویترین‌ها..." : "انتخاب ویترین"}</option>
          {showcases.map((showcase) => <option key={showcase.id} value={showcase.id}>{showcase.title}</option>)}
        </Select>
      </Field>
      {showcases.length === 0 && !loading && (
        <p className="rounded-xl border px-3 py-2.5 text-[10px] leading-5" style={{ borderColor: palette.border, background: palette.muted, color: palette.secondary }}>
          ویترینی برای انتخاب وجود ندارد. ساخت ویترین را می‌توان از بخش ویترین‌های حساب انجام داد.
        </p>
      )}
      {!instagramAccountId && <p className="text-[10px]" style={{ color: palette.warning }}>اکانت Instagram انتخاب نشده است.</p>}
    </div>
  );
}

function BranchMediaDestination({
  kind,
  url,
  onChange,
}: {
  kind: MediaKind;
  url: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const accept = kind === "IMAGE" ? "image/*" : kind === "VIDEO" ? "video/*" : "audio/*";
  useStorageUploadLease([url]);

  async function choose(file?: File): Promise<boolean> {
    if (!file) return false;
    setUploading(true);
    setProgress(15);
    setError("");
    setRetryFile(file);
    try {
      const uploaded = await uploadBranchMedia(file, setProgress);
      if (url && url !== uploaded) void requestStorageCleanupByPublicUrl(url).catch(() => undefined);
      onChange(uploaded);
      setRetryFile(null);
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
      return false;
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {url ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "#BBF7D0", background: "var(--daira-success-bg)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold" style={{ color: "#166534" }}>فایل مقصد آماده است</p>
            {kind === "AUDIO" ? <audio src={url} controls className="mt-2 w-full max-w-md" /> : <p className="mt-1 max-w-[420px] truncate text-[10px]" dir="ltr" style={{ color: palette.secondary }}>{url}</p>}
          </div>
          <div className="flex gap-2">
            <FilePicker accept={accept} disabled={uploading} onChange={choose} label="جایگزین" />
            <button type="button" onClick={() => { void requestStorageCleanupByPublicUrl(url).catch(() => undefined); onChange(""); }} className="rounded-xl border bg-white px-3 py-2 text-[11px] font-bold" style={{ borderColor: palette.border, color: palette.error }}>حذف</button>
          </div>
        </div>
      ) : uploading || retryFile ? (
        <div className={["rounded-xl border p-3", error && retryFile && !uploading ? "border-[var(--daira-error-border)] bg-[var(--daira-error-background)]" : "border-[#BFDBFE] bg-[var(--daira-outline-hover-bg)]"].join(" ")}>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className={error && retryFile && !uploading ? "text-[var(--daira-error-text)]" : "text-[var(--daira-primary)]"}>{error && retryFile && !uploading ? "آپلود ناموفق بود" : "در حال آپلود..."}</span>
            <span className={error && retryFile && !uploading ? "text-[var(--daira-error-text)]" : "text-[var(--daira-primary)]"}>{progress}٪</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--daira-border)]"><div className={["h-full rounded-full transition-[width] duration-300", error && retryFile && !uploading ? "bg-[var(--daira-error-text)]" : "bg-[var(--daira-primary)]"].join(" ")} style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} /></div>
          {error && retryFile && !uploading && <button type="button" onClick={() => void choose(retryFile)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--daira-error-text)] px-3 py-2 text-[11px] font-bold text-white"><RotateCcw size={14} /> تلاش دوباره</button>}
        </div>
      ) : (
        <div className="space-y-3">
          <FilePicker accept={accept} disabled={uploading} onChange={choose} label="انتخاب فایل مقصد" />
          {kind === "AUDIO" && <><div className="text-center text-[10px] font-semibold text-[var(--daira-text-disabled)]">یا</div><VoiceRecorder disabled={uploading} onRecorded={choose} /></>}
        </div>
      )}
      {error && <p className="text-[10px]" style={{ color: palette.error }}>{error}</p>}
    </div>
  );
}

function ShowcaseComposer({
  instagramAccountId,
  showcaseId,
  showcases,
  onCreated,
}: {
  instagramAccountId?: string;
  showcaseId: string;
  showcases: Showcase[];
  onCreated: (showcase: Showcase) => void;
}) {
  const existing = showcases.find((item) => item.id === showcaseId) ?? null;
  const [items, setItems] = useState<ShowcaseItemDraft[]>([newShowcaseItem()]);
  useStorageUploadLease(items.map((item) => item.imageUrl));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const rawItems = Array.isArray(existing?.items) ? existing.items : [];
    if (!rawItems.length) return;
    setItems(rawItems.map((raw: unknown) => {
      const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      return ({
      id: typeof record.id === "string" ? record.id : `showcase_item_${crypto.randomUUID()}`,
      title: typeof record.title === "string" ? record.title : "",
      description: typeof record.description === "string" ? record.description : "",
      imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : "",
      previewUrl: typeof record.imageUrl === "string" ? record.imageUrl : "",
      });
    }));
  }, [showcaseId]);

  function patchItem(id: string, patch: Partial<ShowcaseItemDraft>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (item?.imageUrl) void requestStorageCleanupByPublicUrl(item.imageUrl).catch(() => undefined);
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  const [uploadingItems, setUploadingItems] = useState<Record<string, boolean>>({});
  const [uploadProgressItems, setUploadProgressItems] = useState<Record<string, number>>({});
  const [retryFiles, setRetryFiles] = useState<Record<string, File | null>>({});

  async function chooseImage(id: string, file?: File) {
    if (!file) return;
    setError("");
    setRetryFiles((current) => ({ ...current, [id]: file }));
    setUploadProgressItems((current) => ({ ...current, [id]: 10 }));
    setUploadingItems((current) => ({ ...current, [id]: true }));
    try {
      const previewUrl = URL.createObjectURL(file);
      patchItem(id, { previewUrl });
      const previousUrl = items.find((item) => item.id === id)?.imageUrl;
      const publicUrl = await uploadFile(file, (progress) => setUploadProgressItems((current) => ({ ...current, [id]: progress })));
      if (previousUrl && previousUrl !== publicUrl) void requestStorageCleanupByPublicUrl(previousUrl).catch(() => undefined);
      setUploadProgressItems((current) => ({ ...current, [id]: 100 }));
      patchItem(id, { imageUrl: publicUrl, previewUrl: publicUrl });
      setRetryFiles((current) => ({ ...current, [id]: null }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود تصویر ناموفق بود.");
    } finally {
      setUploadingItems((current) => ({ ...current, [id]: false }));
    }
  }

  async function save() {
    if (!instagramAccountId) return setError("اکانت Instagram انتخاب نشده است.");
    if (!items.length) return setError("حداقل یک کارت اضافه کنید.");
    for (let i = 0; i < items.length; i += 1) {
      if (!items[i]?.title.trim()) return setError(`عنوان کارت ${i + 1} را وارد کنید.`);
      if (!items[i]?.imageUrl.trim()) return setError(`تصویر کارت ${i + 1} را آپلود کنید.`);
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId,
          title: `ویترین ${new Date().toLocaleDateString("fa-IR")}`,
          description: null,
          isActive: true,
        }),
      });
      const result = await readJsonResponse(response, "ساخت ویترین ناموفق بود.");
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "ساخت ویترین ناموفق بود.");
      const created = result.data ?? result;

      for (let i = 0; i < items.length; i += 1) {
        const responseItem = await fetch(`/api/showcases/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: items[i].title.trim(),
            description: items[i].description.trim() || null,
            imageUrl: items[i].imageUrl.trim(),
            order: i,
            isActive: true,
          }),
        });
        const itemResult = await readJsonResponse(responseItem, `ساخت کارت ${i + 1} ناموفق بود.`);
        if (!responseItem.ok || itemResult?.error) throw new Error(itemResult?.error || itemResult?.message || `ساخت کارت ${i + 1} ناموفق بود.`);
      }

      onCreated({ ...created, items });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ساخت ویترین ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <ComposerTitle title="ویترین" description="یک مجموعه کارت تصویری بساز و همان را به‌عنوان پاسخ این مرحله ارسال کن." />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold" style={{ color: palette.text }}>{showcaseId ? "ویترین انتخاب شده" : "کارت‌های ویترین"}</p>
          <p className="mt-1 text-[10px]" style={{ color: palette.secondary }}>برای هر کارت تصویر، عنوان و توضیح کوتاه وارد کن.</p>
        </div>
        {!showcaseId && (
          <Button type="button" onClick={() => setItems((current) => [...current, newShowcaseItem()])} className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-[11px] font-bold" style={{ borderColor: palette.border, color: palette.text }}>
            <Plus size={13} /> کارت
          </Button>
        )}
      </div>

      {showcaseId && existing ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: "#BBF7D0", background: "var(--daira-success-bg)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#DCFCE7", color: palette.success }}><Check size={16} /></div>
            <div><p className="text-xs font-bold" style={{ color: "#166534" }}>«{existing.title}» به این مرحله متصل است.</p><p className="mt-1 text-[10px]" style={{ color: "var(--daira-chart-increase)" }}>برای مدیریت محتوای ویترین از بخش ویترین‌ها استفاده کن.</p></div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item, itemIndex) => (
              <div key={item.id} className="grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-[132px_minmax(0,1fr)_32px]" style={{ borderColor: palette.border }}>
                <label className="flex min-h-[132px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed" style={{ borderColor: "var(--daira-outline)", background: palette.muted }}>
                  {uploadingItems[item.id] ? (
  <div className="flex w-full flex-col items-center justify-center px-4">
    <span className="mb-2 text-[10px] font-bold text-[var(--daira-primary)]">{uploadProgressItems[item.id] ?? 0}٪</span>
    <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--daira-border)]"><div className="h-full rounded-full bg-[var(--daira-primary)] transition-[width] duration-150" style={{ width: `${uploadProgressItems[item.id] ?? 0}%` }} /></div>
  </div>
) : item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-[10px]" style={{ color: palette.secondary }}><ImagePlus size={22} />تصویر کارت {itemIndex + 1}</span>}
                  <Input type="file" accept="image/*" disabled={uploadingItems[item.id]} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void chooseImage(item.id, file); }} />
                </label>
                <div className="space-y-3">
                  <Input value={item.title} onChange={(event) => patchItem(item.id, { title: event.target.value })} placeholder="عنوان کارت" className="w-full rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm outline-none" style={{ borderColor: palette.border }} />
                  <Textarea value={item.description} onChange={(event) => patchItem(item.id, { description: event.target.value })} rows={3} placeholder="توضیح کوتاه کارت" className="w-full resize-none rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm leading-6 outline-none" style={{ borderColor: palette.border }} />
                </div>
                <button type="button" disabled={items.length === 1} onClick={() => removeItem(item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25" style={{ color: palette.secondary }}><X size={15} /></button>
              </div>
            ))}
          </div>

          {error && <p className="text-xs" style={{ color: palette.error }}>{error}</p>}

          <Button type="button" disabled={saving} onClick={() => void save()} className="w-full rounded-xl py-3 text-xs font-bold text-white disabled:opacity-50" style={{ background: palette.primary }}>
            {saving ? "در حال ساخت ویترین..." : "ساخت و اتصال ویترین"}
          </Button>
        </>
      )}
    </div>
  );
}

function createReply(): QuickReplyDraft {
  return {
    id: `branch_${crypto.randomUUID()}`,
    title: "",
    payload: `payload_${crypto.randomUUID()}`,
    nextMessageId: null,
    destinationType: null,
    destinationText: "",
    destinationFormId: "",
    destinationShowcaseId: "",
    destinationMediaUrl: "",
    destinationMediaId: "",
    destinationQuestion: "",
    destinationQuickReplies: [],
  };
}
