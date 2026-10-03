"use client";

import { Button, Input, Select, Textarea } from "@/components/dashboard/DashboardUI";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ClipboardList,
  ImagePlus,
  MessageSquareText,
  Mic,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  primary: "#2563EB",
  automation: "#7C3AED",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
  text: "#0F172A",
  secondary: "#64748B",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  muted: "#F8FAFC",
};

const newShowcaseItem = (): ShowcaseItemDraft => ({
  id: \`showcase_item_\${crypto.randomUUID()}\`,
  title: "",
  description: "",
  imageUrl: "",
  previewUrl: "",
});

async function readJsonResponse(response: Response, fallback: string) {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(\`\${fallback} (پاسخ خالی از سرور)\`);
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    throw new Error(\`\${fallback} (پاسخ نامعتبر از سرور)\`);
  }
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/instagram/publishing/upload", {
    method: "POST",
    body: formData,
  });
  const result = await readJsonResponse(response, "آپلود فایل ناموفق بود.");
  if (!response.ok || !result?.success || typeof result?.data?.publicUrl !== "string") {
    throw new Error(result?.message || "آپلود فایل ناموفق بود.");
  }
  return result.data.publicUrl;
}

async function uploadBranchMedia(
  file: File,
  onProgress: (progress: number) => void,
): Promise<string> {
  onProgress(20);
  const url = await uploadFile(file);
  onProgress(100);
  return url;
}

const typeOptions: Array<{
  value: MessageDraft["messageType"];
  label: string;
  description: string;
  Icon: LucideIcon;
}> = [
  { value: "TEXT", label: "متن", description: "پیام متنی و دکمه‌های پاسخ", Icon: MessageSquareText },
  { value: "IMAGE", label: "تصویر", description: "یک تصویر همراه پیام", Icon: ImagePlus },
  { value: "VIDEO", label: "ویدیو", description: "یک ویدیوی قابل ارسال", Icon: Video },
  { value: "AUDIO", label: "وویس", description: "پیام صوتی", Icon: Mic },
  { value: "SHOWCASE", label: "ویترین", description: "چند کارت تصویری", Icon: ImagePlus },
  { value: "FORM", label: "سؤال", description: "سؤال و مسیرهای بعدی", Icon: ClipboardList },
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
  const [error, setError] = useState("");

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

  async function handleMedia(file?: File) {
    if (!file) return;
    setError("");
    setMediaUploading(true);
    try {
      const url = await uploadFile(file);
      onUpdate({ mediaUrl: url, mediaId: "" });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
    } finally {
      setMediaUploading(false);
    }
  }

  function clearMessageMedia() {
    onUpdate({ mediaUrl: "", mediaId: "" });
  }

  return (
    <article
      dir="rtl"
      className="overflow-hidden rounded-[28px] border bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
      style={{ borderColor: palette.border }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: palette.border }}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
            style={{ background: palette.automation }}
          >
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium" style={{ color: palette.secondary }}>
              مرحله {index + 1} از {total}
            </p>
            <h3 className="mt-0.5 truncate text-sm font-bold" style={{ color: palette.text }}>
              پیام پاسخ
            </h3>
          </div>
        </div>
      <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold" style={{ borderColor: palette.border, color: palette.secondary, background: palette.muted }}>
        ${index === 0 ? "پیام شروع" : "ادامه مسیر"}
      </div>
      </header>

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b p-4 lg:border-b-0 lg:border-l" style={{ borderColor: palette.border, background: palette.muted }}>
          <div className="mb-3">
            <p className="text-xs font-bold" style={{ color: palette.text }}>نوع محتوا</p>
            <p className="mt-1 text-[10px] leading-5" style={{ color: palette.secondary }}>
              این مرحله چه چیزی برای کاربر ارسال کند؟
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
            {availableTypes.map(({ value, label, description, Icon }) => {
              const selected = message.messageType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdate({ messageType: value })}
                  className="relative flex min-h-[78px] items-center gap-3 rounded-2xl border p-3 text-right transition-all hover:-translate-y-px"
                  style={{
                    borderColor: selected ? palette.automation : palette.border,
                    background: selected ? "#F5F3FF" : palette.surface,
                    boxShadow: selected ? "0 0 0 2px rgba(124,58,237,.08)" : undefined,
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: selected ? "#EDE9FE" : palette.muted,
                      color: selected ? palette.automation : palette.secondary,
                    }}
                  >
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold" style={{ color: palette.text }}>{label}</span>
                    <span className="mt-1 block text-[10px] leading-4" style={{ color: palette.secondary }}>{description}</span>
                  </span>
                  {selected && (
                    <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: palette.automation }}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 p-5 sm:p-6">
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
            <p className="mt-4 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: "#FECACA", background: "#FEF2F2", color: palette.error }}>
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
    <section className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: palette.border, background: palette.muted }}>
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
        <div className="mt-4 rounded-xl border border-dashed bg-white px-4 py-7 text-center" style={{ borderColor: palette.border }}>
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
    ["VIDEO", "ویدیو"],
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
              style={{ borderColor: palette.border }}
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
}: {
  kind: MediaKind;
  url: string;
  uploading: boolean;
  error: string;
  onUpload: (file?: File) => void;
  onClear: () => void;
}) {
  const accept = kind === "IMAGE" ? "image/jpeg,image/png,image/webp" : kind === "VIDEO" ? "video/mp4,video/quicktime" : "audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/x-wav,audio/m4a,.mp3,.m4a,.aac,.wav";
  const labels = { IMAGE: "تصویر", VIDEO: "ویدیو", AUDIO: "وویس" } as const;

  return (
    <div className="space-y-5">
      <ComposerTitle title={labels[kind]} description={\`فایل \${labels[kind]} را انتخاب کن تا در این مرحله برای کاربر ارسال شود.\`} />

      {url ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#DCFCE7", color: palette.success }}>
                <Check size={18} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#166534" }}>فایل آماده ارسال است</p>
                <p className="mt-1 max-w-[360px] truncate text-[10px]" dir="ltr" style={{ color: palette.secondary }}>{url}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <FilePicker accept={accept} disabled={uploading} onChange={onUpload} label="جایگزین" />
              <button type="button" onClick={onClear} className="rounded-xl border bg-white px-3 py-2 text-[11px] font-bold" style={{ borderColor: palette.border, color: palette.error }}>حذف</button>
            </div>
          </div>
        </div>
      ) : (
        <FilePicker
          accept={accept}
          disabled={uploading}
          onChange={onUpload}
          label={uploading ? "در حال آپلود..." : \`انتخاب \${labels[kind]}\`}
          large
          kind={kind}
        />
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
      className={\`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition hover:bg-[#F5F3FF] \${large ? "min-h-[230px]" : "min-h-11"} \${disabled ? "pointer-events-none opacity-60" : ""}\`}
      style={{ borderColor: "#CBD5E1", background: large ? palette.muted : palette.surface }}
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
          style={{ borderColor: palette.border }}
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

  const accept = kind === "IMAGE" ? "image/*" : kind === "VIDEO" ? "video/*" : "audio/*";

  async function choose(file?: File) {
    if (!file) return;
    setUploading(true);
    setProgress(15);
    setError("");
    try {
      const uploaded = await uploadBranchMedia(file, setProgress);
      onChange(uploaded);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {url ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: "#166534" }}>فایل مقصد آماده است</p>
            <p className="mt-1 max-w-[420px] truncate text-[10px]" dir="ltr" style={{ color: palette.secondary }}>{url}</p>
          </div>
          <FilePicker accept={accept} disabled={uploading} onChange={choose} label="جایگزین" />
        </div>
      ) : (
        <FilePicker accept={accept} disabled={uploading} onChange={choose} label={uploading ? \`آپلود \${progress}٪\` : "انتخاب فایل مقصد"} />
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const rawItems = Array.isArray(existing?.items) ? existing.items : [];
    if (!rawItems.length) return;
    setItems(rawItems.map((raw: any) => ({
      id: typeof raw?.id === "string" ? raw.id : \`showcase_item_\${crypto.randomUUID()}\`,
      title: typeof raw?.title === "string" ? raw.title : "",
      description: typeof raw?.description === "string" ? raw.description : "",
      imageUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl : "",
      previewUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl : "",
    })));
  }, [showcaseId]);

  function patchItem(id: string, patch: Partial<ShowcaseItemDraft>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function chooseImage(id: string, file?: File) {
    if (!file) return;
    setError("");
    try {
      const previewUrl = URL.createObjectURL(file);
      patchItem(id, { previewUrl });
      const publicUrl = await uploadFile(file);
      patchItem(id, { imageUrl: publicUrl, previewUrl: publicUrl });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود تصویر ناموفق بود.");
    }
  }

  async function save() {
    if (!instagramAccountId) return setError("اکانت Instagram انتخاب نشده است.");
    if (!items.length) return setError("حداقل یک کارت اضافه کنید.");
    for (let i = 0; i < items.length; i += 1) {
      if (!items[i]?.title.trim()) return setError(\`عنوان کارت \${i + 1} را وارد کنید.\`);
      if (!items[i]?.imageUrl.trim()) return setError(\`تصویر کارت \${i + 1} را آپلود کنید.\`);
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId,
          title: \`ویترین \${new Date().toLocaleDateString("fa-IR")}\`,
          description: null,
          isActive: true,
        }),
      });
      const result = await readJsonResponse(response, "ساخت ویترین ناموفق بود.");
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "ساخت ویترین ناموفق بود.");
      const created = result.data ?? result;

      for (let i = 0; i < items.length; i += 1) {
        const responseItem = await fetch(\`/api/showcases/\${created.id}/items\`, {
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
        const itemResult = await readJsonResponse(responseItem, \`ساخت کارت \${i + 1} ناموفق بود.\`);
        if (!responseItem.ok || itemResult?.error) throw new Error(itemResult?.error || itemResult?.message || \`ساخت کارت \${i + 1} ناموفق بود.\`);
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
        <div className="rounded-2xl border p-4" style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#DCFCE7", color: palette.success }}><Check size={16} /></div>
            <div><p className="text-xs font-bold" style={{ color: "#166534" }}>«{existing.title}» به این مرحله متصل است.</p><p className="mt-1 text-[10px]" style={{ color: "#15803D" }}>برای مدیریت محتوای ویترین از بخش ویترین‌ها استفاده کن.</p></div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item, itemIndex) => (
              <div key={item.id} className="grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-[132px_minmax(0,1fr)_32px]" style={{ borderColor: palette.border }}>
                <label className="flex min-h-[132px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed" style={{ borderColor: "#CBD5E1", background: palette.muted }}>
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-[10px]" style={{ color: palette.secondary }}><ImagePlus size={22} />تصویر کارت {itemIndex + 1}</span>}
                  <Input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void chooseImage(item.id, file); }} />
                </label>
                <div className="space-y-3">
                  <Input value={item.title} onChange={(event) => patchItem(item.id, { title: event.target.value })} placeholder="عنوان کارت" className="w-full rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm outline-none" style={{ borderColor: palette.border }} />
                  <Textarea value={item.description} onChange={(event) => patchItem(item.id, { description: event.target.value })} rows={3} placeholder="توضیح کوتاه کارت" className="w-full resize-none rounded-xl border bg-[#FAFAFC] px-3.5 py-3 text-sm leading-6 outline-none" style={{ borderColor: palette.border }} />
                </div>
                <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25" style={{ color: palette.secondary }}><X size={15} /></button>
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
    id: \`branch_\${crypto.randomUUID()}\`,
    title: "",
    payload: \`payload_\${crypto.randomUUID()}\`,
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
