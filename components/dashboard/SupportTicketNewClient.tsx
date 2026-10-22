"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Send } from "lucide-react";

export default function SupportTicketNewClient() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "ثبت درخواست ناموفق بود.");
      router.replace("/dashboard/tickets/" + encodeURIComponent(result.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت درخواست.");
      setBusy(false);
    }
  }

  return (
    <div className="daira-support daira-support--narrow" dir="rtl">
      <header className="daira-support__header">
        <div>
          <span className="daira-support__eyebrow"><LifeBuoy size={16} aria-hidden="true" /> پشتیبانی</span>
          <h1>درخواست جدید</h1>
          <p>موضوع و توضیحات درخواست را وارد کنید تا تیم پشتیبانی بررسی کند.</p>
        </div>
      </header>
      <form className="daira-support__form" onSubmit={submit}>
        <label htmlFor="support-subject">موضوع درخواست</label>
        <input id="support-subject" name="subject" autoComplete="off" maxLength={140} minLength={5} required value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثلاً مشکل در اتصال پیج" />
        <label htmlFor="support-body">توضیحات</label>
        <textarea id="support-body" name="body" rows={7} maxLength={5000} minLength={10} required value={body} onChange={e => setBody(e.target.value)} placeholder="مشکل یا سوال خود را با جزئیات توضیح دهید..." />
        <span className="daira-support__hint">پاسخ‌های پشتیبانی در همین بخش قابل پیگیری هستند.</span>
        {error ? <p className="daira-support__error" role="alert">{error}</p> : null}
        <button className="daira-support__primary daira-support__submit" type="submit" disabled={busy || subject.trim().length < 5 || body.trim().length < 10}>
          <Send size={17} aria-hidden="true" /> {busy ? "در حال ثبت..." : "ثبت درخواست"}
        </button>
      </form>
    </div>
  );
}
