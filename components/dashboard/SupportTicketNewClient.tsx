"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Send, SquarePen, X } from "lucide-react";
import { SUPPORT_CATEGORY_OPTIONS } from "./support-ui";

export default function SupportTicketNewClient() {
  const router = useRouter();
  const [category, setCategory] = useState("GENERAL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => { URL.revokeObjectURL(url); setPreview(""); };
  }, [image]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || subject.trim().length < 5 || body.trim().length < 10) return;
    setBusy(true); setError("");
    const form = new FormData();
    form.set("category", category); form.set("subject", subject.trim()); form.set("body", body.trim());
    if (image) form.set("image", image);
    try {
      const response = await fetch("/api/dashboard/tickets", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ثبت درخواست ناموفق بود.");
      window.dispatchEvent(new Event("support:changed"));
      router.replace("/dashboard/tickets/" + encodeURIComponent(data.id));
    } catch (err) { setError(err instanceof Error ? err.message : "ثبت درخواست ناموفق بود."); }
    finally { setBusy(false); }
  }
  return <div className="daira-support daira-support--narrow" dir="rtl">
    <header className="daira-support__header daira-support__header--plain">
      <div className="daira-support__header-title">
        <span className="daira-support__header-icon" aria-hidden="true"><SquarePen size={21} strokeWidth={1.9}/></span>
        <div className="daira-support__header-copy"><h1>درخواست جدید</h1><p>مشکل یا سؤال خود را برای تیم پشتیبانی ارسال کنید.</p></div>
      </div>
    </header>
    <form onSubmit={submit} className="daira-support__form">
      <label htmlFor="support-category">دسته‌بندی درخواست</label>
      <select id="support-category" value={category} onChange={event => setCategory(event.target.value)} disabled={busy}>
        {SUPPORT_CATEGORY_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <label htmlFor="support-subject">موضوع درخواست</label>
      <input id="support-subject" autoComplete="off" minLength={5} maxLength={140} value={subject} onChange={event => setSubject(event.target.value)} placeholder="مثلاً مشکل در اتصال پیج" required />
      <label htmlFor="support-body">توضیحات</label>
      <textarea id="support-body" rows={6} minLength={10} maxLength={5000} value={body} onChange={event => setBody(event.target.value)} placeholder="مشکل را با جزئیات توضیح دهید تا بتوانیم سریع‌تر بررسی کنیم..." required />
      <div className="daira-support__upload-title">تصویر یا اسکرین‌شات <span>(اختیاری، حداکثر ۲ مگابایت)</span></div>
      {image ? <div className="daira-support__upload-preview">
        {preview && <img src={preview} alt="پیش‌نمایش تصویر انتخاب‌شده" />}
        <span>{image.name}</span>
        <button type="button" disabled={busy} onClick={() => setImage(null)} aria-label="حذف تصویر"><X size={18}/></button>
      </div> : <label htmlFor="support-image" className="daira-support__upload">انتخاب تصویر <ImagePlus size={21} aria-hidden="true"/></label>}
      <input id="support-image" className="daira-support__file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const file = event.target.files?.[0] || null;
        if (file && file.size > 2 * 1024 * 1024) { setError("حجم تصویر باید کمتر از ۲ مگابایت باشد."); event.target.value = ""; return; }
        setError(""); setImage(file);
      }}/>
      <p className="daira-support__hint">پاسخ تیم پشتیبانی در همین بخش نمایش داده می‌شود و اعلان دریافت می‌کنید.</p>
      {error && <p className="daira-support__error" role="alert">{error}</p>}
      <button type="submit" className="daira-support__primary daira-support__submit" disabled={busy || subject.trim().length < 5 || body.trim().length < 10}>
        {busy ? "در حال ثبت درخواست..." : "ثبت درخواست"}<Send size={17} aria-hidden="true"/>
      </button>
    </form>
  </div>;
}