"use client";

import { Check, Image as ImageIcon, Video } from "lucide-react";

export type AutomationMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  thumbnail_url?: string | null;
  media_url?: string | null;
  timestamp?: string;
};

type Props = {
  items: AutomationMediaItem[];
  selectedIds: string[];
  loading: boolean;
  onToggle: (id: string) => void;
  title?: string;
  description?: string;
  selectedLabel?: string;
};

export default function AutomationPicker({ items, selectedIds, loading, onToggle, title = "انتخاب پست‌ها و ریلزها", description = "محتواهایی را انتخاب کنید که این پاسخ خودکار برای آن‌ها فعال باشد.", selectedLabel = "محتوا انتخاب شده" }: Props) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-sm font-bold text-[#2F61FD]">۱</span>
        <div>
          <h2 className="text-sm font-bold text-[#18233C]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">{description}</p>
        </div>
      </div>
      <p className="mb-3 text-xs leading-5 text-[#5A6B87]">{selectedLabel === "استوری انتخاب شده" ? "یک استوری انتخاب کنید؛ انتخاب استوری قبلی با انتخاب مورد جدید جایگزین می‌شود." : "یک یا چند محتوا را انتخاب کنید. برای پیمایش فهرست، داخل کادر محتوا اسکرول کنید."}</p>
      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-[#E2E8F0]" />)}
        </div>
      ) : items.length ? (
        <div className="max-h-[340px] overflow-y-auto overscroll-contain rounded-lg pr-1">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => {
              const selected = selectedIds.includes(item.id);
              const image = item.thumbnail_url || item.media_url;
              const isVideo = item.media_product_type === "REELS" || item.media_type === "VIDEO";
              const label = isVideo ? "ریلز / ویدیو" : item.media_type === "CAROUSEL_ALBUM" ? "پست اسلایدی" : "پست";
              return (
                <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={"group relative overflow-hidden rounded-lg border-2 text-right transition focus:outline-none focus:ring-2 focus:ring-[#2F61FD] " + (selected ? "border-[#2F61FD] ring-2 ring-[#2F61FD]/15" : "border-transparent hover:border-[#CBD5E1]")} aria-pressed={selected}>
                  {image ? <img src={image} alt={item.caption || ""} className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.02]" loading="lazy" /> : <div className="flex aspect-square items-center justify-center bg-[#F1F5F9] text-[#94A3B8]">{isVideo ? <Video size={22} /> : <ImageIcon size={22} />}</div>}
                  <span className={"absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full " + (selected ? "bg-[#2F61FD] text-white" : "bg-white/90 text-transparent")}><Check size={13} /></span>
                  <span className="block truncate bg-white px-1.5 py-1 text-[10px] text-[#5A6B87]">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-[#F8FAFC] p-3 text-xs leading-5 text-[#5A6B87]">محتوایی دریافت نشد. اتصال اینستاگرام و دسترسی رسانه‌ها را بررسی کنید.</p>
      )}
      <p className="mt-3 text-xs font-medium text-[#5A6B87]">{selectedIds.length} {selectedLabel}</p>
    </section>
  );
}
