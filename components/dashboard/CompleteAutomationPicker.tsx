"use client";

import { useState } from "react";
import { Check, CheckCircle2, Eye, Pencil, X } from "lucide-react";
import { normalizeMessages } from "./automation-form-utils";
import type { FormItem, Showcase } from "./automation-form-utils";
import ResponseTemplateDetails from "./ResponseTemplateDetails";

export type CompleteAutomation = {
  id: string;
  title?: string | null;
  triggerType?: string;
  keyword?: string | null;
  keywordMatchMode?: string | null;
  commentReplyText?: string | null;
  requireFollow?: boolean;
  followGateText?: string | null;
  followGateButtonText?: string | null;
  likeStoryReply?: boolean;
  sendDm?: boolean;
  isActive?: boolean;
  messages?: unknown;
  initialText?: string;
  followupEnabled?: boolean;
  followupKeyword?: string;
};

type Props<T extends CompleteAutomation> = {
  items: T[];
  selected: T | null;
  onSelect: (item: T) => void;
  onChange: () => void;
  showcases?: Showcase[];
  forms?: FormItem[];
  kind: "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD" | "LIVE";
  disabled?: boolean;
  onEdit?: (item: T) => void;
};

/** A complete rule (not a lone DM message) is the unit of reuse. */
export default function CompleteAutomationPicker<T extends CompleteAutomation>({
  items, selected, onSelect, onChange, showcases = [], forms = [],
  kind, disabled = false, onEdit,
}: Props<T>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const label = (item: T) => item.title?.trim() || "پاسخ بدون نام";
  const renderDetail = (item: T) => {
    const messages = normalizeMessages(item.messages || []);
    const displayedMessages = kind === "LIVE" && item.initialText
      ? [{ ...messages[0], messageType: "TEXT" as const, text: item.initialText,
        mediaUrl: "", showcaseId: "", formId: "", quickReplies: [] }, ...messages].filter(
        (entry): entry is typeof messages[number] => Boolean(entry && entry.messageType))
      : messages;
    return <div className="space-y-3">
      <div className="daira-response-library__preview-branch space-y-2 rounded-xl p-3 text-xs leading-6 text-[var(--daira-text)]">
        <p><strong className="text-[var(--daira-heading)]">روش فعال‌سازی:</strong>{" "}
          {item.keywordMatchMode === "CONTAINS_ANY" && !item.keyword ? "هر کامنت / ریپلای" : item.keyword || "بدون کلمات کلیدی"}</p>
        {kind === "LIVE" && item.followupEnabled &&
          <p><strong>ادامه گفتگو:</strong> {item.followupKeyword || "تنظیم شده"}</p>}
        {item.requireFollow && <p><strong>شرط فالو:</strong> فعال
          {item.followGateText && <span className="mt-1 block whitespace-pre-wrap">{item.followGateText}</span>}</p>}
        {kind === "STORY_REPLY_KEYWORD" &&
          <p><strong>لایک خودکار ریپلای:</strong> {item.likeStoryReply ? "فعال" : "غیرفعال"}</p>}
        {kind === "COMMENT_KEYWORD" &&
          <p><strong>ارسال دایرکت:</strong> {item.sendDm === false ? "غیرفعال" : "فعال"}</p>}
      </div>
      <ResponseTemplateDetails
        messages={displayedMessages}
        showcases={showcases}
        forms={forms}
        commentReplyText={kind === "COMMENT_KEYWORD" ? item.commentReplyText : undefined}
      />
    </div>;
  };

  if (selected) return <section className="daira-complete-reply rounded-2xl border p-4 sm:p-5" aria-label="پاسخ انتخاب‌شده">
    <div className="flex items-start gap-3">
      <span className="daira-complete-reply__check flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><CheckCircle2 size={21} aria-hidden="true"/></span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-bold text-[var(--daira-success-text)]">پاسخ انتخاب شد</p>
        <h3 className="break-words text-sm font-bold text-[var(--daira-heading)]">{label(selected)}</h3>
        <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">همه تنظیمات این پاسخ، شامل شرایط فعال‌سازی و پیام‌ها، حفظ می‌شود. نیازی به تکمیل مجدد فرم نیست.</p>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={() => { setExpandedId(null); onChange(); }}
        className="daira-response-library__action min-h-11 flex-1 rounded-xl border px-3 text-xs font-bold">تغییر پاسخ</button>
      <button type="button" aria-expanded={expandedId === selected.id}
        onClick={() => setExpandedId((current) => current === selected.id ? null : selected.id)}
        className="daira-response-library__eye flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold">
        {expandedId === selected.id ? <X size={17}/> : <Eye size={17}/>}
        <span>{expandedId === selected.id ? "بستن جزئیات" : "مشاهده جزئیات"}</span>
      </button>
    </div>
    <div aria-hidden={expandedId !== selected.id} inert={expandedId !== selected.id}
      className={"daira-response-library__expander grid " + (expandedId === selected.id ? "is-expanded" : "")}>
      <div className="min-h-0 overflow-hidden">
        <div className="mt-3 border-t border-[var(--daira-glass-rim)] pt-3">{renderDetail(selected)}</div>
      </div>
    </div>
  </section>;

  return <section className="daira-complete-reply rounded-2xl border p-3 sm:p-5" aria-label="پاسخ‌های کامل قبلی">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-[var(--daira-heading)]">پاسخ‌های کامل قبلی</h3>
      <span className="daira-response-library__count rounded-full px-3 py-1.5 text-xs text-[var(--daira-text-secondary)]">{new Intl.NumberFormat("fa-IR").format(items.length)} پاسخ</span>
    </div>
    <div className="space-y-3">
      {items.map((item) => {
        const expanded = expandedId === item.id;
        return <article key={item.id} className="daira-response-library__item overflow-hidden rounded-xl border">
          <div className="flex min-h-[72px] items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-bold leading-6 text-[var(--daira-heading)]">{label(item)}</h4>
              <p className="text-[11px] text-[var(--daira-text-secondary)]">
                {kind === "LIVE" ? "پاسخ لایو" : kind === "COMMENT_KEYWORD" ? "پاسخ کامنت" : "پاسخ استوری"}
              </p>
            </div>
            <button type="button" aria-expanded={expanded} aria-controls={"complete-preview-" + item.id}
              onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
              aria-label={(expanded ? "بستن جزئیات " : "مشاهده ") + label(item)}
              className="daira-response-library__eye flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              {expanded ? <X size={18}/> : <Eye size={18}/>}
            </button>
          </div>
          <div id={"complete-preview-" + item.id} aria-hidden={!expanded} inert={!expanded}
            className={"daira-response-library__expander grid " + (expanded ? "is-expanded" : "")}>
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-3 border-t border-[var(--daira-glass-rim)] p-3">
                {renderDetail(item)}
                {onEdit && <button type="button" onClick={() => onEdit(item)}
                  className="daira-response-library__action flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold">
                  <Pencil size={15}/> ویرایش پاسخ اصلی
                </button>}
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--daira-glass-rim)] p-3">
            <button type="button" disabled={disabled} onClick={() => { setExpandedId(null); onSelect(item); }}
              className="daira-complete-reply__select flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-50">
              <Check size={17}/> انتخاب پاسخ
            </button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
