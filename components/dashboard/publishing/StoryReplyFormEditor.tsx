"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, ImagePlus, Plus, Trash2 } from "lucide-react";
import VoiceRecorder from "../VoiceRecorder";
import { createEmptyQuickReply, type MessageDraft, type QuickReplyDraft, type Showcase } from "../automation-form-utils";
import { requestStorageCleanupByPublicUrl, useStorageUploadLease } from "./useStorageUploadLease";

type FormProps = {
  message: MessageDraft;
  showcases: Showcase[];
  loadingResources: boolean;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onUploadMedia: (file?: File) => Promise<string>;
};

type BranchProps = {
  question: string;
  replies: QuickReplyDraft[];
  showcases: Showcase[];
  loadingResources: boolean;
  onChange: (patch: { question?: string; replies?: QuickReplyDraft[] }) => void;
  onUploadMedia: (file?: File) => Promise<string>;
  level: number;
};

const maxOptions = 13;
const mediaTypes = ["IMAGE", "VIDEO", "AUDIO"] as const;
const answerLabels: Record<string, string> = {
  TEXT: "پیام متنی", IMAGE: "عکس", VIDEO: "ویدیو",
  AUDIO: "وویس", SHOWCASE: "ویترین", FORM: "سؤال بعدی",
};

function completeBranch(question: string, replies: QuickReplyDraft[], depth = 0): boolean {
  if (!question.trim() || depth > 3) return false;
  const options = replies.filter((reply) => !reply.isExit);
  return options.length >= 2 && options.every((reply) => completeOption(reply, depth));
}

function completeOption(reply: QuickReplyDraft, depth: number): boolean {
  if (!reply.title.trim()) return false;
  switch (reply.destinationType) {
    case "TEXT": return Boolean(reply.destinationText.trim());
    case "SHOWCASE": return Boolean(reply.destinationShowcaseId);
    case "IMAGE":
    case "VIDEO":
    case "AUDIO": return Boolean(reply.destinationMediaUrl || reply.destinationMediaId);
    case "FORM": return completeBranch(reply.destinationQuestion, reply.destinationQuickReplies, depth + 1);
    default: return false;
  }
}

export default function StoryReplyFormEditor({ message, showcases, loadingResources, onUpdate, onUploadMedia }: FormProps) {
  return (
    <StoryBranch
      question={message.text}
      replies={message.quickReplies}
      showcases={showcases}
      loadingResources={loadingResources}
      onChange={(patch) => onUpdate({
        ...(patch.question !== undefined ? { text: patch.question } : {}),
        ...(patch.replies !== undefined ? { quickReplies: patch.replies } : {}),
      })}
      onUploadMedia={onUploadMedia}
      level={0}
    />
  );
}

function StoryBranch({ question, replies, showcases, loadingResources, onChange, onUploadMedia, level }: BranchProps) {
  const options = replies.filter((reply) => !reply.isExit);
  const ready = options.filter((reply) => completeOption(reply, level)).length;
  function updateReply(id: string, patch: Partial<QuickReplyDraft>) {
    onChange({ replies: replies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply) });
  }

  return (
    <section dir="rtl" aria-label={level ? "سؤال بعدی" : "فرم پاسخ استوری"}
      className={["space-y-4 rounded-2xl border p-3.5 sm:p-5", level ? "border-[#D8E3F2] bg-white" : "border-[#E2E8F0] bg-[#FBFCFE]"].join(" ")}>
      <div>
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8]">
            {new Intl.NumberFormat("fa-IR").format(level + 1)}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#0F172A]">{level ? "سؤال بعدی" : "سؤال اصلی"}</h3>
            <p className="mt-1 text-xs leading-6 text-[#64748B]">
              {level ? "بعد از انتخاب گزینهٔ قبلی، این سؤال نمایش داده می‌شود." : "متنی بنویس که کاربر در دایرکت ببیند و یکی از گزینه‌ها را انتخاب کند."}
            </p>
          </div>
        </div>
        <label className="mb-1.5 mt-3 block text-xs font-bold text-[#334155]">متن سؤال <span className="text-[#DC2626]">*</span></label>
        <textarea rows={3} maxLength={2000} value={question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="مثلاً دوست داری دربارهٔ کدام محصول اطلاعات بگیری؟"
          className="w-full resize-y rounded-xl border border-[#D8E0EC] bg-white px-3.5 py-3 text-base leading-7 text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB]" />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#0F172A]">گزینه‌های پاسخ</p>
            <p className="mt-1 text-[11px] leading-5 text-[#64748B]">حداقل ۲ گزینه؛ مقصد هر گزینه را مشخص کن.</p>
          </div>
          <span aria-live="polite" className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-semibold text-[#1D4ED8]">
            {new Intl.NumberFormat("fa-IR").format(ready)} از {new Intl.NumberFormat("fa-IR").format(options.length)} کامل
          </span>
        </div>
        {options.map((reply, index) => (
          <StoryAnswer key={reply.id} reply={reply} index={index} level={level}
            showcases={showcases} loadingResources={loadingResources}
            onChange={(patch) => updateReply(reply.id, patch)}
            onRemove={() => onChange({ replies: replies.filter((entry) => entry.id !== reply.id) })}
            onUploadMedia={onUploadMedia} />
        ))}
        <button type="button" disabled={replies.length >= maxOptions}
          onClick={() => onChange({ replies: [...replies, createEmptyQuickReply()] })}
          className="sd-neutral-button flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#B5C4DA] bg-white px-3 text-xs font-bold text-[#2563EB] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={16} aria-hidden="true" /> افزودن گزینه
          <span className="text-[11px] font-normal text-[#64748B]">(حداکثر {new Intl.NumberFormat("fa-IR").format(maxOptions)})</span>
        </button>
      </div>
      {options.length < 2 && <p role="status" className="text-xs text-[#B45309]">برای فعال شدن دکمهٔ ساخت، حداقل دو گزینه لازم است.</p>}
    </section>
  );
}

type AnswerProps = {
  reply: QuickReplyDraft;
  index: number;
  level: number;
  showcases: Showcase[];
  loadingResources: boolean;
  onChange: (patch: Partial<QuickReplyDraft>) => void;
  onRemove: () => void;
  onUploadMedia: (file?: File) => Promise<string>;
};

function StoryAnswer({ reply, index, level, showcases, loadingResources, onChange, onRemove, onUploadMedia }: AnswerProps) {
  const [expanded, setExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const complete = completeOption(reply, level);
  useStorageUploadLease([reply.destinationMediaUrl]);

  function changeDestination(value: QuickReplyDraft["destinationType"]) {
    if (reply.destinationMediaUrl && !mediaTypes.includes(value as typeof mediaTypes[number]))
      void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined);
    setUploadError("");
    onChange({
      destinationType: value,
      destinationText: value === "TEXT" ? reply.destinationText : "",
      destinationFormId: "",
      destinationShowcaseId: value === "SHOWCASE" ? reply.destinationShowcaseId : "",
      destinationMediaUrl: mediaTypes.includes(value as typeof mediaTypes[number]) ? reply.destinationMediaUrl : "",
      destinationMediaId: mediaTypes.includes(value as typeof mediaTypes[number]) ? reply.destinationMediaId : "",
      destinationQuestion: value === "FORM" ? reply.destinationQuestion : "",
      destinationQuickReplies: value === "FORM"
        ? (reply.destinationQuickReplies.length ? reply.destinationQuickReplies : [createEmptyQuickReply(), createEmptyQuickReply()])
        : [],
    });
  }

  async function upload(file?: File) {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await onUploadMedia(file);
      if (!url) throw new Error("آپلود فایل ناموفق بود.");
      if (reply.destinationMediaUrl && reply.destinationMediaUrl !== url)
        void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined);
      onChange({ destinationMediaUrl: url, destinationMediaId: "" });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "آپلود فایل ناموفق بود.");
    } finally { setUploading(false); }
  }

  const title = reply.title.trim() || "عنوان گزینه";
  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex min-h-12 items-center gap-2 px-3 py-2">
        <span className="shrink-0 rounded-lg bg-[#F1F5F9] px-2 py-1 text-[11px] font-bold text-[#475569]">
          {new Intl.NumberFormat("fa-IR").format(index + 1)}
        </span>
        <button type="button" aria-expanded={expanded} aria-label={`تنظیم گزینه ${index + 1}`}
          onClick={() => setExpanded((value) => !value)}
          className="sd-neutral-button flex min-w-0 flex-1 items-center gap-2 text-right">
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#0F172A]">{title}</span>
          <span className={["shrink-0 text-[10px] font-medium", complete ? "text-[#15803D]" : "text-[#D97706]"].join(" ")}>
            {complete ? "آماده" : "ناقص"}
          </span>
          <ChevronDown size={16} aria-hidden="true" className={["shrink-0 text-[#94A3B8] transition-transform", expanded ? "rotate-180" : ""].join(" ")} />
        </button>
        <button type="button" onClick={onRemove} aria-label={`حذف گزینه ${index + 1}`}
          className="sd-destructive-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#FEF2F2]">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-[#F1F5F9] px-3 py-3">
          <div>
            <label htmlFor={`story-answer-title-${reply.id}`} className="mb-1.5 block text-xs font-bold text-[#334155]">متن گزینه <span className="text-[#DC2626]">*</span></label>
            <input id={`story-answer-title-${reply.id}`} value={reply.title} maxLength={20}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="مثلاً قیمت محصول"
              className="w-full min-w-0 rounded-xl border border-[#D8E0EC] bg-[#F8FAFC] px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]" />
          </div>
          <div>
            <label htmlFor={`story-answer-type-${reply.id}`} className="mb-1.5 block text-xs font-bold text-[#334155]">بعد از انتخاب، چه چیزی ارسال شود؟ <span className="text-[#DC2626]">*</span></label>
            <select id={`story-answer-type-${reply.id}`} value={reply.destinationType || ""}
              onChange={(event) => changeDestination((event.target.value || null) as QuickReplyDraft["destinationType"])}
              className="w-full min-w-0 rounded-xl border border-[#D8E0EC] bg-[#F8FAFC] px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]">
              <option value="">انتخاب مقصد پاسخ</option>
              <option value="TEXT">پیام متنی</option>
              <option value="IMAGE">عکس</option>
              <option value="VIDEO">ویدیو</option>
              <option value="AUDIO">وویس</option>
              <option value="SHOWCASE">ویترین آماده</option>
              {level < 3 && <option value="FORM">سؤال بعدی</option>}
            </select>
          </div>
          {reply.destinationType === "TEXT" && (
            <textarea aria-label={`متن پاسخ گزینه ${index + 1}`} value={reply.destinationText}
              onChange={(event) => onChange({ destinationText: event.target.value })}
              rows={3} maxLength={2000} placeholder="متنی که بعد از انتخاب این گزینه ارسال می‌شود..."
              className="w-full resize-y rounded-xl border border-[#D8E0EC] bg-white px-3 py-3 text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB]" />
          )}
          {reply.destinationType === "SHOWCASE" && (
            <div className="space-y-1.5">
              <label htmlFor={`story-answer-showcase-${reply.id}`} className="block text-xs font-bold text-[#334155]">انتخاب ویترین</label>
              <select id={`story-answer-showcase-${reply.id}`} value={reply.destinationShowcaseId} disabled={loadingResources}
                onChange={(event) => onChange({ destinationShowcaseId: event.target.value })}
                className="w-full min-w-0 rounded-xl border border-[#D8E0EC] bg-white px-3 py-3 text-base text-[#0F172A] outline-none">
                <option value="">{loadingResources ? "در حال دریافت..." : showcases.length ? "یک ویترین انتخاب کن" : "هنوز ویترینی ساخته نشده"}</option>
                {showcases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
          )}
          {reply.destinationType === "FORM" && level < 3 && (
            <StoryBranch
              question={reply.destinationQuestion} replies={reply.destinationQuickReplies}
              showcases={showcases} loadingResources={loadingResources} onUploadMedia={onUploadMedia} level={level + 1}
              onChange={(patch) => onChange({
                ...(patch.question !== undefined ? { destinationQuestion: patch.question } : {}),
                ...(patch.replies !== undefined ? { destinationQuickReplies: patch.replies } : {}),
              })}
            />
          )}
          {mediaTypes.includes(reply.destinationType as typeof mediaTypes[number]) && (
            <div className="space-y-2">
              <label className={["flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 text-xs font-bold text-[#2563EB]", uploading ? "opacity-55" : "hover:border-[#2563EB]"].join(" ")}>
                <ImagePlus size={17} aria-hidden="true" />
                {uploading ? "در حال آپلود..." : reply.destinationMediaUrl ? "جایگزینی فایل" : "انتخاب فایل از دستگاه"}
                <input className="hidden" type="file" disabled={uploading}
                  accept={reply.destinationType === "IMAGE" ? "image/*" : reply.destinationType === "VIDEO" ? "video/*" : "audio/*"}
                  onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void upload(file); }} />
              </label>
              {reply.destinationType === "AUDIO" && <VoiceRecorder disabled={uploading} onRecorded={(file) => upload(file)} />}
              {reply.destinationMediaUrl && (
                <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
                  {reply.destinationType === "IMAGE" ? <img src={reply.destinationMediaUrl} alt="پیش‌نمایش فایل" className="h-36 w-full object-contain" /> :
                    reply.destinationType === "VIDEO" ? <video src={reply.destinationMediaUrl} controls className="max-h-48 w-full" /> :
                    <audio src={reply.destinationMediaUrl} controls className="w-full p-2" />}
                  <button type="button" onClick={() => { void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined); onChange({ destinationMediaUrl: "", destinationMediaId: "" }); }}
                    className="sd-destructive-button w-full border-t border-[#E2E8F0] px-3 py-2 text-xs font-bold text-[#DC2626]">حذف فایل</button>
                </div>
              )}
              {uploadError && <p role="alert" className="text-xs text-[#B91C1C]">{uploadError}</p>}
            </div>
          )}
          {complete && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D]"><CircleCheck size={15} aria-hidden="true" /> این گزینه آماده است.</p>}
        </div>
      )}
    </div>
  );
}
