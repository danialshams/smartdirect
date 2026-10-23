"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Images, Image as ImageIcon, RefreshCw, Video, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";

export type ContentMediaItem = {
  id: string;
  caption?: string | null;
  media_type?: string;
  media_product_type?: string;
  thumbnail_url?: string | null;
  media_url?: string | null;
  timestamp?: string | null;
};

type ContentFilter = "ALL" | "POST" | "REELS" | "IMAGE" | "VIDEO";

export function contentKind(item: ContentMediaItem): "POST" | "REELS" | "CAROUSEL" | "STORY" {
  if (item.media_product_type === "STORY") return "STORY";
  if (item.media_product_type === "REELS") return "REELS";
  if (item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  return "POST";
}

export function contentLabel(item: ContentMediaItem): string {
  const kind = contentKind(item);
  if (kind === "STORY") return item.media_type === "VIDEO" ? "استوری ویدیویی" : "استوری تصویری";
  return kind === "REELS" ? "ریلز" : kind === "CAROUSEL" ? "پست اسلایدی" : "پست";
}

export function sortContentNewestFirst<T extends ContentMediaItem>(items: T[]): T[] {
  // Missing dates are kept in their API order, after the dated items.
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aTime = Date.parse(a.item.timestamp || "") || 0;
      const bTime = Date.parse(b.item.timestamp || "") || 0;
      return bTime - aTime || a.index - b.index;
    })
    .map(({ item }) => item);
}

type Props = {
  items: ContentMediaItem[];
  selectedIds: string[];
  loading?: boolean;
  mode?: "feed" | "story";
  maxSelected?: number;
  occupiedIds?: ReadonlySet<string>;
  error?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

const number = (value: number) => value.toLocaleString("fa-IR");

export default function ContentSelectionDialog({
  items, selectedIds, loading = false, mode = "feed", maxSelected,
  occupiedIds, error, onRefresh, refreshing = false, onToggle, onConfirm, onClose,
}: Props) {
  const [filter, setFilter] = useState<ContentFilter>("ALL");
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const dialogRef = useRef<HTMLElement>(null);
  const sorted = useMemo(() => sortContentNewestFirst(items), [items]);
  const filters: Array<{ value: ContentFilter; label: string }> = mode === "story"
    ? [{ value: "ALL", label: "همه" }, { value: "IMAGE", label: "عکس" }, { value: "VIDEO", label: "ویدیو" }]
    : [{ value: "ALL", label: "همه" }, { value: "POST", label: "پست" }, { value: "REELS", label: "ریلز" }];
  const filtered = sorted.filter((item) => {
    if (filter === "ALL") return true;
    if (mode === "story") return item.media_type === filter;
    const isReel = contentKind(item) === "REELS";
    return filter === "REELS" ? isReel : !isReel;
  });
  const listedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const missingIds = selectedIds.filter((id) => !listedIds.has(id));

  useEffect(() => {
    const previous = document.body.style.overflow;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
      focused?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-[#101A32]/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} dir="rtl" role="dialog" aria-modal="true" aria-labelledby="content-dialog-title" aria-describedby="content-dialog-hint"
        className="flex max-h-[92dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-t-[28px] border border-[#E3EAF5] bg-white shadow-[0_24px_80px_rgba(15,23,42,.20)] sm:max-h-[86dvh] sm:rounded-[28px]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E8EDF5] px-4 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 id="content-dialog-title" className="text-base font-extrabold text-[#18233C]">انتخاب محتوا</h2>
            <p id="content-dialog-hint" className="mt-1 text-xs leading-5 text-[#64748B]">{mode === "story" ? "استوری موردنظر را انتخاب کنید." : "از جدیدترین محتواهای منتشرشده انتخاب کنید."}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="بستن انتخاب محتوا"
            className="sd-neutral-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E6ECF5] bg-[#F8FAFD] text-[#475569] transition hover:bg-[#EDF3FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <X size={19} />
          </button>
        </header>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#EDF1F7] px-4 py-3 sm:px-6">
          <div role="group" aria-label="فیلتر محتوا" className="flex min-w-0 gap-1.5 rounded-2xl bg-[#F1F5FB] p-1">
            {filters.map((option) => (
              <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}
                className={"sd-neutral-button min-h-9 rounded-xl px-3.5 text-xs font-bold transition sm:px-5 " + (filter === option.value ? "bg-white text-[#2158DE] shadow-[0_2px_9px_rgba(30,65,120,.10)]" : "text-[#64748B] hover:text-[#1E293B]")}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-bold text-[#2563EB]">
              {number(selectedIds.length)} {maxSelected ? "از " + number(maxSelected) : ""} انتخاب‌شده
            </span>
            {onRefresh && (
              <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="به‌روزرسانی محتوا" title="به‌روزرسانی محتوا"
                className="sd-neutral-button flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#F1F5FB] disabled:opacity-50">
                <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {missingIds.length > 0 && !loading && (
            <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs leading-6 text-[#64748B]">
              پیش‌نمایش {number(missingIds.length)} محتوای قبلی در دسترس نیست، اما انتخاب آن حفظ شده است.
              <div className="mt-2 flex flex-wrap gap-2">
                {missingIds.map((id) => (
                  <button key={id} type="button" onClick={() => onToggle(id)} className="sd-neutral-button inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#DDE6F3] bg-white px-3 text-xs text-[#475569]">
                    <span dir="ltr">…{id.slice(-8)}</span><X size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3" aria-label="در حال دریافت محتوا" role="status">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-[#E9EEF7]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#DCE5F2] bg-[#F8FAFC] px-4 text-center text-xs leading-6 text-[#64748B]">
              {error || (items.length ? "محتوایی در این دسته وجود ندارد." : "هنوز محتوایی برای انتخاب دریافت نشده است.")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {filtered.map((item) => {
                const selected = selectedIds.includes(item.id);
                const locked = Boolean(occupiedIds?.has(item.id));
                const full = !selected && maxSelected !== undefined && selectedIds.length >= maxSelected;
                const isVideo = item.media_type === "VIDEO" || contentKind(item) === "REELS";
                const preview = item.thumbnail_url || (!isVideo ? item.media_url : null);
                return (
                  <button key={item.id} type="button" disabled={locked || full} onClick={() => onToggle(item.id)} aria-pressed={selected}
                    aria-label={contentLabel(item) + (locked ? "، قبلاً انتخاب شده" : selected ? "، انتخاب‌شده" : "")}
                    className={"sd-content-card group relative block aspect-square min-w-0 overflow-hidden rounded-2xl border-2 bg-[#F0F3F9] text-right transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 " + (locked ? "cursor-not-allowed opacity-60" : "hover:shadow-md")}
                    style={{ borderColor: selected ? dairaPalette.primary.main : "#E7ECF5" }}>
                    {preview ? <img src={preview} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" /> :
                      <span className="flex h-full w-full items-center justify-center text-[#94A3B8]">{isVideo ? <Video size={25} /> : <ImageIcon size={25} />}</span>}
                    <span className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow-sm">
                      {contentKind(item) === "CAROUSEL" && <Images size={12} />}{contentLabel(item)}
                    </span>
                    {locked ? <span className="absolute inset-x-1 top-2 rounded-lg bg-white/95 px-1 py-1 text-center text-[10px] font-bold text-[#334155]">قبلاً انتخاب‌شده</span> :
                      <span className={"absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm " + (selected ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-white bg-black/25 text-transparent")}>
                        <Check size={14} strokeWidth={3} />
                      </span>}
                  </button>
                );
              })}
            </div>
          )}
          {error && filtered.length > 0 && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
        </div>
        <footer className="flex shrink-0 items-center gap-2 border-t border-[#E8EDF5] bg-white px-4 py-3.5 sm:px-6">
          <button type="button" onClick={onConfirm} disabled={loading}
            className="min-h-12 flex-1 rounded-xl bg-[#2F61FD] px-4 text-sm font-extrabold text-white transition hover:bg-[#2154E9] disabled:cursor-not-allowed disabled:opacity-50">تأیید انتخاب</button>
          <button type="button" onClick={onClose} className="sd-neutral-button min-h-12 rounded-xl border border-[#E0E7F2] bg-white px-5 text-sm font-bold text-[#475569] transition hover:bg-[#F7F9FC]">انصراف</button>
        </footer>
      </section>
    </div>
  );
}
