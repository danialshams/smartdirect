"use client";

import { ChevronDown, CircleCheck, ImagePlus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

export type StoryShowcaseSlide = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  previewUrl: string;
  price: string;
  originalPrice: string;
  linkUrl: string;
  buttonText: string;
  isActive: boolean;
};

type Props = {
  slides: StoryShowcaseSlide[];
  completed: number;
  maxSlides: number;
  uploadProgress: Record<string, number>;
  uploading: Record<string, boolean>;
  retryFiles: Record<string, File | null>;
  disabled?: boolean;
  onPatch: (id: string, patch: Partial<StoryShowcaseSlide>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onUpload: (id: string, file?: File) => void;
};

export default function StoryShowcaseSlidesEditor({
  slides, completed, maxSlides, uploading, retryFiles, uploadProgress, disabled,
  onPatch, onRemove, onAdd, onUpload,
}: Props) {
  return (
    <div dir="rtl" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[var(--daira-heading)]">اسلایدهای ویترین</h4>
        <span aria-live="polite" className="rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-bold text-[var(--daira-primary-hover)]">
          {new Intl.NumberFormat("fa-IR").format(completed)} از {new Intl.NumberFormat("fa-IR").format(slides.length)} کامل
        </span>
      </div>
      <div className="space-y-4">
        {slides.map((slide, index) => (
          <StoryShowcaseCard
            key={slide.id}
            index={index}
            slide={slide}
            canRemove={slides.length > 1}
            busy={Boolean(uploading[slide.id])}
            retryFile={retryFiles[slide.id]}
            progress={uploadProgress[slide.id] ?? 0}
            disabled={disabled}
            onPatch={(patch) => onPatch(slide.id, patch)}
            onRemove={() => onRemove(slide.id)}
            onUpload={(file) => onUpload(slide.id, file)}
          />
        ))}
      </div>
      {slides.length < maxSlides && (
        <button type="button" disabled={disabled || Object.values(uploading).some(Boolean)}
          onClick={onAdd}
          className="sd-neutral-button flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#B9C8DA] bg-white px-3 text-sm font-bold text-[var(--daira-primary)] transition hover:bg-[var(--daira-surface-hover)] disabled:cursor-not-allowed disabled:opacity-45">
          <Plus size={17} aria-hidden="true" /> افزودن اسلاید
          <span className="text-[11px] font-normal text-[var(--daira-text-secondary)]">حداکثر {new Intl.NumberFormat("fa-IR").format(maxSlides)} اسلاید</span>
        </button>
      )}
      <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">
        ترتیب اسلایدها از بالا به پایین است. ویترین همراه با پاسخ خودکار ذخیره می‌شود.
      </p>
    </div>
  );
}

function StoryShowcaseCard({
  slide, index, canRemove, busy, retryFile, progress, disabled, onPatch, onRemove, onUpload,
}: {
  slide: StoryShowcaseSlide;
  index: number;
  canRemove: boolean;
  busy: boolean;
  retryFile?: File | null;
  progress: number;
  disabled?: boolean;
  onPatch: (patch: Partial<StoryShowcaseSlide>) => void;
  onRemove: () => void;
  onUpload: (file?: File) => void;
}) {
  const [showExtras, setShowExtras] = useState(false);
  const complete = Boolean(slide.imageUrl.trim() && slide.title.trim() && slide.description.trim());
  const i = new Intl.NumberFormat("fa-IR").format(index + 1);
  return (
    <section aria-label={`اسلاید ${i}`} className="overflow-hidden rounded-2xl border border-[var(--daira-border)] bg-white shadow-[0_2px_12px_rgba(15,23,42,.035)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[var(--daira-neutral-bg)] px-2.5 py-1 text-xs font-bold text-[var(--daira-text-secondary)]">اسلاید {i}</span>
          {complete && <CircleCheck size={17} aria-label="کامل شده" className="text-[var(--daira-publishing-completed)]" />}
        </div>
        {canRemove && (
          <button type="button" aria-label={`حذف اسلاید ${i}`} onClick={onRemove} disabled={disabled || busy}
            className="sd-destructive-button flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--daira-error-text)] hover:bg-[var(--daira-error-background)] disabled:opacity-40">
            <Trash2 size={15} aria-hidden="true" /> حذف
          </button>
        )}
      </div>

      {/* Instagram-style vertical card: full-width image first, then title and description. */}
      <label aria-label={`انتخاب تصویر اسلاید ${i}`} className={["relative flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center overflow-hidden border-y border-[var(--daira-border)] bg-[var(--daira-surface-hover)] transition hover:bg-[var(--daira-outline-hover-bg)]", disabled || busy ? "pointer-events-none opacity-60" : ""].join(" ")}>
        {slide.previewUrl ? (
          <img src={slide.previewUrl} alt={`تصویر اسلاید ${i}`} className="h-full w-full object-contain" />
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[var(--daira-primary)] shadow-sm">
              <ImagePlus size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="mt-3 text-xs font-bold text-[var(--daira-primary)]">انتخاب تصویر اسلاید</span>
          </>
        )}
        {slide.previewUrl && !busy && <span className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[var(--daira-primary-hover)] shadow-sm">تغییر عکس</span>}
        <input type="file" accept="image/*" className="hidden" disabled={disabled || busy}
          onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; onUpload(file); }} />
      </label>
      {busy && (
        <div aria-live="polite" className="space-y-1.5 px-4 py-2">
          <p className="text-xs font-semibold text-[var(--daira-primary)]">در حال آپلود تصویر — {new Intl.NumberFormat("fa-IR").format(progress)}٪</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--daira-border)]">
            <div className="h-full rounded-full bg-[var(--daira-primary)] transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {!busy && retryFile && !slide.previewUrl && (
        <button type="button" onClick={() => onUpload(retryFile)}
          className="sd-neutral-button mx-4 mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--daira-error-text)]">
          <RotateCcw size={14} aria-hidden="true" /> تلاش دوباره برای آپلود
        </button>
      )}

      <div className="space-y-3 p-4">
        <div>
          <label htmlFor={`story-showcase-title-${slide.id}`} className="mb-1.5 block text-xs font-bold text-[var(--daira-input-label)]">
            عنوان <span className="text-[var(--daira-error-text)]">*</span>
          </label>
          <input id={`story-showcase-title-${slide.id}`} value={slide.title} maxLength={100}
            onChange={(event) => onPatch({ title: event.target.value })}
            placeholder="مثلاً کیف مدل جدید"
            className="w-full rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)] focus:bg-white" />
        </div>
        <div>
          <label htmlFor={`story-showcase-desc-${slide.id}`} className="mb-1.5 block text-xs font-bold text-[var(--daira-input-label)]">
            توضیحات <span className="text-[var(--daira-error-text)]">*</span>
          </label>
          <textarea id={`story-showcase-desc-${slide.id}`} value={slide.description} rows={3} maxLength={1000}
            onChange={(event) => onPatch({ description: event.target.value })}
            placeholder="توضیحات این اسلاید را بنویس..."
            className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 py-3 text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)] focus:bg-white" />
        </div>
        <button type="button" aria-expanded={showExtras} onClick={() => setShowExtras((value) => !value)}
          className="sd-neutral-button flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-[var(--daira-border)] bg-white px-3 text-xs font-bold text-[var(--daira-text-secondary)]">
          <span>جزئیات تکمیلی (قیمت و لینک)</span>
          <ChevronDown size={16} className={["transition-transform", showExtras ? "rotate-180" : ""].join(" ")} />
        </button>
        {showExtras && (
          <div className="space-y-3 rounded-xl bg-[var(--daira-surface-hover)] p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`story-price-${slide.id}`} className="mb-1.5 block text-[11px] font-bold text-[var(--daira-input-label)]">قیمت</label>
                <input id={`story-price-${slide.id}`} type="number" min="0" step="any" dir="ltr" value={slide.price}
                  onChange={(event) => onPatch({ price: event.target.value })}
                  className="w-full min-w-0 rounded-lg border border-[var(--daira-border)] bg-white px-2.5 py-2.5 text-base outline-none" />
              </div>
              <div>
                <label htmlFor={`story-old-price-${slide.id}`} className="mb-1.5 block text-[11px] font-bold text-[var(--daira-input-label)]">قیمت قبل</label>
                <input id={`story-old-price-${slide.id}`} type="number" min="0" step="any" dir="ltr" value={slide.originalPrice}
                  onChange={(event) => onPatch({ originalPrice: event.target.value })}
                  className="w-full min-w-0 rounded-lg border border-[var(--daira-border)] bg-white px-2.5 py-2.5 text-base outline-none" />
              </div>
            </div>
            <div>
              <label htmlFor={`story-slide-link-${slide.id}`} className="mb-1.5 block text-[11px] font-bold text-[var(--daira-input-label)]">لینک</label>
              <input id={`story-slide-link-${slide.id}`} type="url" dir="ltr" value={slide.linkUrl}
                onChange={(event) => onPatch({ linkUrl: event.target.value })}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-[var(--daira-border)] bg-white px-2.5 py-2.5 text-base outline-none" />
            </div>
            <div>
              <label htmlFor={`story-slide-button-${slide.id}`} className="mb-1.5 block text-[11px] font-bold text-[var(--daira-input-label)]">متن دکمه</label>
              <input id={`story-slide-button-${slide.id}`} value={slide.buttonText}
                onChange={(event) => onPatch({ buttonText: event.target.value })}
                placeholder="مشاهده محصول"
                className="w-full rounded-lg border border-[var(--daira-border)] bg-white px-2.5 py-2.5 text-base outline-none" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--daira-text-secondary)]">
              <input type="checkbox" checked={slide.isActive} onChange={(event) => onPatch({ isActive: event.target.checked })} className="accent-[var(--daira-primary)]" />
              نمایش این اسلاید
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
