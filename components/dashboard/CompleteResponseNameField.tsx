"use client";

export default function CompleteResponseNameField({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <section className="daira-complete-reply space-y-3 rounded-2xl border p-4 sm:p-5" aria-label="نام پاسخ کامل">
    <label htmlFor="complete-automation-name" className="block text-sm font-bold text-[var(--daira-heading)]">
      نام پاسخ
    </label>
    <input id="complete-automation-name" type="text" value={value} maxLength={80}
      disabled={disabled} onChange={(event) => onChange(event.target.value)}
      placeholder="مثلاً قیمت محصولات" autoComplete="off"
      className="daira-response-library__input block min-h-12 w-full rounded-xl border px-3.5 py-3 text-base text-[var(--daira-heading)] outline-none" style={{ fontSize: "16px" }}/>
    <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">
      کلمات کلیدی، پاسخ‌ها، دکمه‌ها و تنظیمات اختیاری همراه با این نام ذخیره می‌شوند.
    </p>
  </section>;
}
