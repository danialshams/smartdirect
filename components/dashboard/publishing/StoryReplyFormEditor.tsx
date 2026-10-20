"use client";

import { useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import StoryReplyShowcaseCreator from "./StoryReplyShowcaseCreator";
import VoiceRecorder from "../VoiceRecorder";
import { createEmptyQuickReply, type MessageDraft, type QuickReplyDraft, type Showcase } from "../automation-form-utils";
import { requestStorageCleanupByPublicUrl, useStorageUploadLease } from "./useStorageUploadLease";

type FormProps = {
  message: MessageDraft;
  instagramAccountId: string;
  showcases: Showcase[];
  loadingResources: boolean;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onUploadMedia: (file?: File) => Promise<string>;
};

type BranchProps = {
  question: string;
  replies: QuickReplyDraft[];
  instagramAccountId: string;
  showcases: Showcase[];
  loadingResources: boolean;
  onChange: (patch: { question?: string; replies?: QuickReplyDraft[] }) => void;
  onUploadMedia: (file?: File) => Promise<string>;
  level: number;
};

const maxOptions = 13;
const mediaTypes = ["IMAGE", "VIDEO", "AUDIO"] as const;

export default function StoryReplyFormEditor({ message, instagramAccountId, showcases, loadingResources, onUpdate, onUploadMedia }: FormProps) {
  return (
    <StoryBranch
      question={message.text}
      replies={message.quickReplies}
      instagramAccountId={instagramAccountId}
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

function StoryBranch({ question, replies, instagramAccountId, showcases, loadingResources, onChange, onUploadMedia, level }: BranchProps) {
  const options = replies.filter((reply) => !reply.isExit);
  function updateReply(id: string, patch: Partial<QuickReplyDraft>) {
    onChange({ replies: replies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply) });
  }

  return (
    <section dir="rtl" aria-label={level ? "سؤال بعدی" : "فرم پاسخ استوری"}
      className={level === 0 ? "space-y-6" : "space-y-5 pt-4"}>
      <div className="space-y-2">
        <h3 className={level ? "text-sm font-semibold text-[#1E40AF]" : "text-base font-bold text-[#0F172A]"}>{level ? "سؤال بعدی" : "سؤال اصلی"}</h3>
        <textarea aria-label={level ? "سؤال بعدی" : "سؤال اصلی"} rows={2} maxLength={2000} value={question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder={level ? "مثلاً کدام مدل را می‌خواهی ببینی؟" : "مثلاً دوست داری دربارهٔ کدام محصول اطلاعات بگیری؟"}
          className="w-full resize-y rounded-xl border border-[#D8E0EC] bg-white px-3.5 py-3 text-base leading-7 text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB]" />
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-[#0F172A]">گزینه‌های پاسخ</h4>
        <div className="space-y-3">
          {options.map((reply, index) => (
            <StoryAnswer key={reply.id} reply={reply} index={index} level={level}
              instagramAccountId={instagramAccountId} showcases={showcases} loadingResources={loadingResources}
              onChange={(patch) => updateReply(reply.id, patch)}
              onRemove={() => onChange({ replies: replies.filter((entry) => entry.id !== reply.id) })}
              onUploadMedia={onUploadMedia} />
          ))}
        </div>
        <button type="button" disabled={replies.length >= maxOptions}
          onClick={() => onChange({ replies: [...replies, createEmptyQuickReply()] })}
          className="sd-neutral-button flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#2563EB] transition hover:border-[#93C5FD] hover:bg-[#F8FAFC] disabled:opacity-50">
          <Plus size={16} aria-hidden="true" /> افزودن گزینه
        </button>
      </div>
    </section>
  );
}

type AnswerProps = {
  reply: QuickReplyDraft;
  index: number;
  level: number;
  instagramAccountId: string;
  showcases: Showcase[];
  loadingResources: boolean;
  onChange: (patch: Partial<QuickReplyDraft>) => void;
  onRemove: () => void;
  onUploadMedia: (file?: File) => Promise<string>;
};

function StoryAnswer({ reply, index, level, instagramAccountId, showcases, loadingResources, onChange, onRemove, onUploadMedia }: AnswerProps) {
  const [showcaseMode, setShowcaseMode] = useState<"choose" | "existing" | "new">(reply.destinationShowcaseId ? "existing" : "choose");
  const [previousShowcaseId, setPreviousShowcaseId] = useState(reply.destinationShowcaseId || "");
  const [createdShowcaseId, setCreatedShowcaseId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  useStorageUploadLease([reply.destinationMediaUrl]);

  function changeDestination(value: QuickReplyDraft["destinationType"]) {
    const keepPreviousFile = reply.destinationType === value && mediaTypes.includes(value as typeof mediaTypes[number]);
    if (reply.destinationMediaUrl && !keepPreviousFile)
      void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined);
    setUploadError("");
    if (value === "SHOWCASE" && reply.destinationType !== "SHOWCASE") setShowcaseMode(reply.destinationShowcaseId ? "existing" : "choose");
    onChange({
      destinationType: value,
      destinationText: value === "TEXT" ? reply.destinationText : "",
      destinationFormId: "",
      destinationShowcaseId: value === "SHOWCASE" ? reply.destinationShowcaseId : "",
      destinationMediaUrl: keepPreviousFile ? reply.destinationMediaUrl : "",
      destinationMediaId: keepPreviousFile ? reply.destinationMediaId : "",
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

  return (
    <div className="min-w-0 rounded-xl bg-[#F8FAFC] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h5 className="text-sm font-bold text-[#0F172A]">گزینه {new Intl.NumberFormat("fa-IR").format(index + 1)}</h5>
        <button type="button" onClick={onRemove} aria-label={`حذف گزینه ${index + 1}`}
          className="sd-destructive-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#FEF2F2]">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor={`story-answer-title-${reply.id}`} className="mb-1.5 block text-xs font-semibold text-[#475569]">عنوان گزینه</label>
          <input id={`story-answer-title-${reply.id}`} value={reply.title} maxLength={20}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="مثلاً قیمت محصول"
            className="w-full min-w-0 rounded-xl border border-[#D8E0EC] bg-white px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]" />
        </div>
        <div>
          <label htmlFor={`story-answer-type-${reply.id}`} className="mb-1.5 block text-xs font-semibold text-[#475569]">مقصد پاسخ</label>
          <select id={`story-answer-type-${reply.id}`} value={reply.destinationType || ""}
            onChange={(event) => changeDestination((event.target.value || null) as QuickReplyDraft["destinationType"])}
            className="w-full min-w-0 rounded-xl border border-[#D8E0EC] bg-white px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]">
            <option value="">انتخاب مقصد پاسخ</option>
            <option value="TEXT">پیام متنی</option>
            <option value="IMAGE">عکس</option>
            <option value="VIDEO">ویدیو</option>
            <option value="AUDIO">وویس</option>
            <option value="SHOWCASE">ویترین</option>
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
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#475569]">ویترین این گزینه</p>
                <div role="group" aria-label={`روش انتخاب ویترین برای گزینه ${index + 1}`}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" aria-pressed={showcaseMode === "new"}
                    onClick={() => {
                      setShowcaseMode("new");
                      onChange({ destinationShowcaseId: createdShowcaseId });
                    }}
                    className={["sd-neutral-button min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition",
                      showcaseMode === "new" ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#D8E0EC] bg-white text-[#475569] hover:border-[#93C5FD]"].join(" ")}>
                    <span className="inline-flex items-center justify-center gap-1.5"><Plus size={15} aria-hidden="true" /> ساخت ویترین جدید</span>
                  </button>
                  <button type="button" aria-pressed={showcaseMode === "existing"}
                    onClick={() => {
                      setShowcaseMode("existing");
                      onChange({ destinationShowcaseId: previousShowcaseId });
                    }}
                    className={["sd-neutral-button min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition",
                      showcaseMode === "existing" ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#D8E0EC] bg-white text-[#475569] hover:border-[#93C5FD]"].join(" ")}>
                    استفاده از ویترین‌های قبلی
                  </button>
                </div>
              </div>
              {showcaseMode === "existing" ? (
                <div className="space-y-2">
                  <select id={`story-answer-showcase-${reply.id}`} aria-label="انتخاب ویترین قبلی" value={previousShowcaseId} disabled={loadingResources}
                    onChange={(event) => {
                      const id = event.target.value;
                      setPreviousShowcaseId(id);
                      onChange({ destinationShowcaseId: id });
                    }}
                    className="w-full min-w-0 rounded-xl border border-[#D8E0EC] bg-white px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]">
                    <option value="">{loadingResources ? "در حال دریافت..." : showcases.length ? "یک ویترین قبلی را انتخاب کن" : "هنوز ویترینی ساخته نشده"}</option>
                    {showcases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </div>
              ) : showcaseMode === "new" ? (createdShowcaseId ? (
                <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-[#ECFDF5] px-3 py-3 text-xs text-[#166534]">
                  <span className="font-semibold">ویترین جدید انتخاب شد.</span>
                  <button type="button" onClick={() => {
                    setCreatedShowcaseId("");
                    onChange({ destinationShowcaseId: "" });
                  }} className="sd-neutral-button shrink-0 font-bold text-[#1D4ED8]">
                    ساخت مجدد
                  </button>
                </div>
              ) : (
                <StoryReplyShowcaseCreator
                  instagramAccountId={instagramAccountId}
                  onUploadMedia={onUploadMedia}
                  onCreated={(id) => {
                    setCreatedShowcaseId(id);
                    onChange({ destinationShowcaseId: id });
                  }}
                />
              )) : null}
            </div>
          )}
          {reply.destinationType === "FORM" && level < 3 && (
            <div className="mt-4 border-r-2 border-[#DBEAFE] bg-white/70 py-3 pr-3 sm:pr-4">
              <StoryBranch
                question={reply.destinationQuestion} replies={reply.destinationQuickReplies}
                instagramAccountId={instagramAccountId} showcases={showcases} loadingResources={loadingResources} onUploadMedia={onUploadMedia} level={level + 1}
                onChange={(patch) => onChange({
                  ...(patch.question !== undefined ? { destinationQuestion: patch.question } : {}),
                  ...(patch.replies !== undefined ? { destinationQuickReplies: patch.replies } : {}),
                })}
              />
            </div>
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
      </div>
    </div>
  );
}
