"use client";

import { BookOpen, Plus } from "lucide-react";

type Mode = "new" | "existing";

/** Canonical Daira response-mode switcher used by live, story, comment and nested editors. */
export default function ResponseModeSwitcher({ value, onChange, disabled = false, existingAvailable = true, loading = false }: {
  value: Mode; onChange: (next: Mode) => void; disabled?: boolean;
  existingAvailable?: boolean; loading?: boolean;
}) {
  return <div className="grid grid-cols-2 gap-2 sm:gap-3" role="group" aria-label="روش ساخت پاسخ">
    {([
      { key: "new", label: "ساخت پاسخ جدید", Icon: Plus },
      { key: "existing", label: "استفاده از پاسخ قبلی", Icon: BookOpen },
    ] as const).map(({ key, label, Icon }) => (
      <button key={key} type="button" disabled={disabled || (key === "existing" && (loading || !existingAvailable))}
        aria-pressed={value === key}
        aria-label={key === "existing" && !loading && !existingAvailable ? "استفاده از پاسخ قبلی؛ پاسخ سازگاری وجود ندارد" : label}
        title={key === "existing" && !loading && !existingAvailable ? "هنوز پاسخ کامل سازگار ذخیره نشده است" : undefined}
        onClick={() => onChange(key)}
        className={"daira-response-library__mode flex min-h-[60px] min-w-0 items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-[10px] font-bold sm:min-h-[68px] sm:gap-2.5 sm:px-3 sm:text-xs " + (value === key ? "is-selected" : "")}>
        <span className="whitespace-nowrap text-center text-[var(--daira-heading)]">{label}</span>
        <span className="daira-response-library__mode-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 sm:rounded-xl">
          <Icon size={15} className="sm:h-[17px] sm:w-[17px]" aria-hidden="true" />
        </span>
      </button>
    ))}
  </div>;
}
