"use client";

import { Plus, Trash2 } from "lucide-react";
import { MAX_PUBLIC_COMMENT_REPLIES, MIN_PUBLIC_COMMENT_REPLIES, publicCommentReplyKey } from "@/lib/automation/comment-reply-variants";

export default function CommentReplyVariantsField({
  values, onChange, disabled = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-[var(--daira-heading)]">پاسخ‌های زیر کامنت</span>
        <span className="text-xs font-medium text-[var(--daira-text-secondary)]">
          {new Intl.NumberFormat("fa-IR").format(values.length)} از {new Intl.NumberFormat("fa-IR").format(MAX_PUBLIC_COMMENT_REPLIES)}
        </span>
      </div>
      {values.map((text, index) => (
        <div key={index} className="space-y-2 py-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`public-comment-variant-${index}`} className="text-xs font-bold text-[var(--daira-heading)]">
              پاسخ {new Intl.NumberFormat("fa-IR").format(index + 1)}
            </label>
            {values.length > MIN_PUBLIC_COMMENT_REPLIES && (
              <button type="button" disabled={disabled} onClick={() => onChange(values.filter((_, i) => i !== index))}
                aria-label={`حذف پاسخ ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
                className="sd-destructive-button inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3 text-xs font-semibold text-[var(--daira-error-text)] disabled:opacity-50">
                <span>حذف</span><Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          <textarea id={`public-comment-variant-${index}`} rows={2} maxLength={2000}
            value={text} disabled={disabled}
            onChange={(event) => onChange(values.map((item, i) => i === index ? event.target.value : item))}
            placeholder={`متن پاسخ شماره ${new Intl.NumberFormat("fa-IR").format(index + 1)} را وارد کنید...`}
            className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-white px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none placeholder:text-xs focus:border-[var(--daira-primary)] focus:ring-2 focus:ring-[var(--daira-primary)]/10 disabled:opacity-60"
            style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }} />
          {text.trim() && values.some((other, otherIndex) => otherIndex !== index && other.trim() && publicCommentReplyKey(other) === publicCommentReplyKey(text)) && (
            <p role="alert" className="text-xs text-[var(--daira-error-text)]">این پاسخ با پاسخ دیگری یکسان است.</p>
          )}
        </div>
      ))}
      {values.length < MAX_PUBLIC_COMMENT_REPLIES && (
        <button type="button" disabled={disabled} onClick={() => onChange([...values, ""])}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--daira-outline)] bg-[var(--daira-outline-hover-bg)] px-4 text-xs font-semibold text-[var(--daira-primary)] disabled:opacity-50">
          <span>افزودن پاسخ</span><Plus size={16} aria-hidden="true"/>
        </button>
      )}
    </div>
  );
}
