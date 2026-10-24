"use client";

import { readPublicCommentReplies } from "@/lib/automation/comment-reply-variants";
import type { MessageDraft, QuickReplyDraft } from "./automation-form-utils";

export type PreviewAsset = {
  id: string; title: string;
  items?: unknown[]; fields?: unknown[];
};
type PreviewMessage = Pick<MessageDraft,
  "messageType" | "text" | "mediaUrl" | "showcaseId" | "formId" | "quickReplies">;
const names: Record<MessageDraft["messageType"], string> = {
  TEXT: "متن", IMAGE: "تصویر", VIDEO: "ویدیو", AUDIO: "وویس",
  FORM: "فرم", SHOWCASE: "ویترین",
};
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;
const string = (value: unknown) => typeof value === "string" ? value : "";

function MediaContent({ type, url }: { type: string; url: string }) {
  if (!url) return <p className="text-xs text-[var(--daira-text-secondary)]">فایل رسانه برای پیش‌نمایش موجود نیست.</p>;
  if (type === "IMAGE") return <img src={url} alt="تصویر پاسخ" loading="lazy" className="max-h-64 w-full rounded-xl object-contain" />;
  if (type === "VIDEO") return <video src={url} controls preload="none" className="max-h-64 w-full rounded-xl" />;
  if (type === "AUDIO") return <audio src={url} controls preload="none" className="w-full" />;
  return null;
}
function AssetContent({ kind, id, assets }: { kind: "FORM" | "SHOWCASE"; id: string; assets: PreviewAsset[] }) {
  const asset = assets.find(item => item.id === id);
  if (!asset) return <p className="text-xs text-[var(--daira-text-secondary)]">
    {kind === "FORM" ? "جزئیات فرم ذخیره‌شده در دسترس نیست." : "جزئیات ویترین ذخیره‌شده در دسترس نیست."}
  </p>;
  const rows = kind === "SHOWCASE" ? asset.items || [] : asset.fields || [];
  return <div className="space-y-2">
    <p className="text-xs font-bold text-[var(--daira-heading)]">{asset.title}</p>
    {rows.length ? rows.map((raw, index) => {
      const item = object(raw);
      if (!item) return null;
      const image = string(item.imageUrl || item.image_url);
      return <div key={string(item.id) || index} className="daira-response-library__preview-branch flex items-center gap-3 rounded-xl p-3">
        {image && <img src={image} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold text-[var(--daira-heading)]">{string(item.title || item.label || item.question) || "گزینه " + new Intl.NumberFormat("fa-IR").format(index + 1)}</p>
          {Boolean(string(item.description || item.value || item.text)) &&
            <p className="whitespace-pre-wrap break-words text-xs leading-6 text-[var(--daira-text-secondary)]">{string(item.description || item.value || item.text)}</p>}
        </div>
      </div>;
    }) : <p className="text-xs text-[var(--daira-text-secondary)]">گزینه‌ای برای نمایش ثبت نشده است.</p>}
  </div>;
}
function QuickReplyTree({ replies, depth, showcases, forms }: {
  replies: QuickReplyDraft[]; depth: number; showcases: PreviewAsset[]; forms: PreviewAsset[];
}) {
  if (depth > 12) return <p className="text-xs text-[var(--daira-text-secondary)]">ادامه مراحل فرم طولانی است.</p>;
  return <div className="space-y-2 border-r-2 border-[var(--daira-border)] pr-3">
    {replies.map((reply, index) => <div key={reply.id || index} className="daira-response-library__preview-branch space-y-2 rounded-xl p-3">
      <p className="text-xs font-bold text-[var(--daira-heading)]">{reply.title || "گزینه " + new Intl.NumberFormat("fa-IR").format(index + 1)}</p>
      {(reply.destinationType === "TEXT" || reply.destinationType === "FORM") &&
        <p className="whitespace-pre-wrap break-words text-xs leading-6 text-[var(--daira-text)]">{reply.destinationType === "FORM" ? reply.destinationQuestion : reply.destinationText}</p>}
      {["IMAGE","VIDEO","AUDIO"].includes(reply.destinationType || "") &&
        <MediaContent type={reply.destinationType || ""} url={reply.destinationMediaUrl || ""} />}
      {reply.destinationType === "SHOWCASE" &&
        <AssetContent kind="SHOWCASE" id={reply.destinationShowcaseId} assets={showcases}/>}
      {reply.destinationType === "FORM" && reply.destinationFormId &&
        <AssetContent kind="FORM" id={reply.destinationFormId} assets={forms}/>}
      {reply.destinationType === "FORM" && reply.destinationQuickReplies.length > 0 &&
        <QuickReplyTree replies={reply.destinationQuickReplies} depth={depth + 1} showcases={showcases} forms={forms}/>}
    </div>)}
  </div>;
}
export default function ResponseTemplateDetails({ messages, showcases = [], forms = [], commentReplyText, keyword }: {
  messages: PreviewMessage[];
  showcases?: PreviewAsset[];
  forms?: PreviewAsset[];
  commentReplyText?: string | null;
  keyword?: string | null;
}) {
  const publicReplies = readPublicCommentReplies(commentReplyText);
  return <div dir="rtl" className="space-y-3 text-right text-[var(--daira-text)]">
    {keyword !== undefined &&
      <p className="text-xs text-[var(--daira-text-secondary)]">کلمات کلیدی: {keyword || "تمام کامنت‌ها"}</p>}
    {publicReplies.map((reply, index) =>
      <div key={index} className="daira-response-library__preview-branch rounded-xl p-3">
        <p className="mb-1 text-xs font-bold text-[var(--daira-heading)]">پاسخ زیر کامنت {new Intl.NumberFormat("fa-IR").format(index + 1)}</p>
        <p className="whitespace-pre-wrap break-words text-xs leading-6">{reply}</p>
      </div>)}
    {messages.map((message, index) => <div key={index} className="daira-response-library__preview-branch space-y-3 rounded-xl p-3">
      <p className="text-xs font-bold text-[var(--daira-text-secondary)]">نوع پاسخ — {names[message.messageType]}</p>
      {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--daira-heading)]">{message.text}</p>}
      {["IMAGE", "VIDEO", "AUDIO"].includes(message.messageType) &&
        <MediaContent type={message.messageType} url={message.mediaUrl}/>}
      {message.messageType === "SHOWCASE" &&
        <AssetContent kind="SHOWCASE" id={message.showcaseId} assets={showcases}/>}
      {message.messageType === "FORM" && message.formId &&
        <AssetContent kind="FORM" id={message.formId} assets={forms}/>}
      {message.messageType === "FORM" && message.quickReplies.length > 0 &&
        <QuickReplyTree replies={message.quickReplies} depth={0} showcases={showcases} forms={forms}/>}
    </div>)}
  </div>;
}
