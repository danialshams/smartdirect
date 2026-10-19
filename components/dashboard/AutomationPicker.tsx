"use client";

import { useMemo, useState } from "react";
import { Check, Image as ImageIcon, Video } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";

export type AutomationMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  thumbnail_url?: string | null;
  media_url?: string | null;
  timestamp?: string;
};

type ContentFilter = "ALL" | "POST" | "REELS";

type Props = {
  items: AutomationMediaItem[];
  selectedIds: string[];
  loading: boolean;
  onToggle: (id: string) => void;
  showContentFilters?: boolean;
};

const contentFilters: Array<{ value: ContentFilter; label: string }> = [
  { value: "ALL", label: "همه" },
  { value: "POST", label: "پست" },
  { value: "REELS", label: "ریلز" },
];

export default function AutomationPicker({
  items,
  selectedIds,
  loading,
  onToggle,
  showContentFilters = false,
}: Props) {
  const [contentFilter, setContentFilter] = useState<ContentFilter>("ALL");

  const filteredItems = useMemo(() => {
    if (!showContentFilters || contentFilter === "ALL") return items;
    return items.filter((item) => {
      const isReel = item.media_product_type?.toUpperCase() === "REELS";
      return contentFilter === "REELS" ? isReel : !isReel;
    });
  }, [contentFilter, items, showContentFilters]);

  return (
    <div className="space-y-3">
      {showContentFilters && (
        <div className="flex justify-center gap-3 py-1" role="group" aria-label="فیلتر نوع محتوا">
          {contentFilters.map((filter) => {
            const active = contentFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setContentFilter(filter.value)}
                aria-pressed={active}
                className="flex min-h-10 min-w-[76px] items-center justify-center rounded-full border px-5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--daira-primary)]/30"
                style={{
                  borderColor: active ? dairaPalette.primary.main : dairaPalette.border,
                  background: active ? dairaPalette.primary.main : dairaPalette.background.surface,
                  color: active ? dairaPalette.background.surface : dairaPalette.text.body,
                  boxShadow: active ? "0 2px 7px rgba(47,97,253,0.16)" : "none",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      )}

      <section
        className="rounded-2xl border p-3 sm:p-4"
        style={{
          borderColor: dairaPalette.border,
          background: dairaPalette.background.surface,
          boxShadow: "0 1px 2px rgba(24,35,60,0.025)",
        }}
      >
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="در حال دریافت محتوا">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-lg"
                style={{ background: dairaPalette.background.surfaceActive }}
              />
            ))}
          </div>
        ) : filteredItems.length ? (
          <div className="max-h-[340px] overflow-y-auto overscroll-contain rounded-lg pr-1">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filteredItems.map((item) => {
                const selected = selectedIds.includes(item.id);
                const image = item.thumbnail_url || item.media_url;
                const isVideo = item.media_product_type === "REELS" || item.media_type === "VIDEO";
                const label = item.media_product_type === "STORY"
                  ? (isVideo ? "استوری ویدیویی" : "استوری تصویری")
                  : isVideo
                    ? "ریلز / ویدیو"
                    : item.media_type === "CAROUSEL_ALBUM"
                      ? "پست اسلایدی"
                      : "پست";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-pressed={selected}
                    className="group relative overflow-hidden rounded-xl border-2 text-right transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)]"
                    style={{
                      borderColor: selected ? dairaPalette.primary.main : "transparent",
                      boxShadow: selected ? `0 0 0 1px ${dairaPalette.primary.main}26` : undefined,
                    }}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={item.caption || ""}
                        className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex aspect-square items-center justify-center"
                        style={{
                          background: dairaPalette.background.surfaceActive,
                          color: dairaPalette.text.muted,
                        }}
                      >
                        {isVideo ? <Video size={22} /> : <ImageIcon size={22} />}
                      </div>
                    )}
                    <span
                      className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: selected ? dairaPalette.primary.main : dairaPalette.background.surface,
                        color: selected ? dairaPalette.background.surface : "transparent",
                      }}
                    >
                      <Check size={13} />
                    </span>
                    <span
                      className="block truncate px-1.5 py-1 text-[10px]"
                      style={{
                        background: dairaPalette.background.surface,
                        color: dairaPalette.text.body,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p
            className="rounded-xl p-3 text-xs leading-5"
            style={{
              background: dairaPalette.background.surfaceHover,
              color: dairaPalette.text.body,
            }}
          >
            {items.length && showContentFilters && contentFilter !== "ALL"
              ? "با این فیلتر محتوایی پیدا نشد."
              : "محتوایی دریافت نشد. اتصال اینستاگرام و دسترسی رسانه‌ها را بررسی کنید."}
          </p>
        )}
      </section>
    </div>
  );
}
