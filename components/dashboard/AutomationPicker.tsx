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
};

export default function AutomationPicker({ items, selectedIds, loading, onToggle, title = "انتخاب پست‌ها و ریلزها", description = "محتواهایی را انتخاب کنید که این پاسخ خودکار برای آن‌ها فعال باشد.", selectedLabel = "محتوا انتخاب شده" }: Props) {
  return (
    <section className="rounded-2xl border border-[#E6ECF5] bg-white p-3 sm:p-4">
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
              const label = item.media_product_type === "STORY" ? (isVideo ? "استوری ویدیویی" : "استوری تصویری") : isVideo ? "ریلز / ویدیو" : item.media_type === "CAROUSEL_ALBUM" ? "پست اسلایدی" : "پست";
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
    </section>
  );
}
