"use client";

import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, Ellipsis, Headset, ImagePlus, RefreshCw, Send, X, ZoomIn } from "lucide-react";
import { SUPPORT_STATUS, supportAttachmentUrl, supportDate } from "./support-ui";

type Attachment = { id: string; fileName: string; mimeType: string };
type Message = { id: string; body: string; createdAt: string; senderUserId: string; sender: { name: string | null; role: string }; attachments: Attachment[] };
type Ticket = { id: string; subject: string; category: string; status: string; createdAt: string; updatedAt: string; messages: Message[] };
type TicketResponse = { data: Ticket; userId: string; message?: string };

export default function SupportTicketDetailClient({ id }: { id: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reply, setReply] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image); setPreview(url);
    return () => { URL.revokeObjectURL(url); setPreview(""); };
  }, [image]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id), { cache: "no-store", credentials: "include", signal });
    const data = await response.json() as TicketResponse;
    if (!response.ok) throw new Error(data.message || "دریافت گفتگو ناموفق بود.");
    if (signal?.aborted) return;
    setTicket(data.data); setUserId(data.userId);
    if (document.visibilityState === "visible" && data.data.messages.some(message => message.senderUserId !== data.userId)) {
      const seen = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id) + "/read", { method: "PATCH" });
      if (seen.ok) {
        const result = await seen.json();
        if (result.updated > 0) window.dispatchEvent(new Event("support:refresh"));
      }
    }
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal).catch(err => { if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "خطا در دریافت درخواست"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const onEvent = () => { if (document.visibilityState === "visible") void load().catch(() => undefined); };
    window.addEventListener("support:changed", onEvent);
    document.addEventListener("visibilitychange", onEvent);
    return () => { controller.abort(); window.removeEventListener("support:changed", onEvent); document.removeEventListener("visibilitychange", onEvent); };
  }, [load]);
  useEffect(() => { if (!loading) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [ticket?.messages.length, loading]);

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!reply.trim() || busy) return;
    setBusy(true); setError("");
    const form = new FormData(); form.set("body", reply.trim()); if (image) form.set("image", image);
    try {
      const response = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id) + "/messages", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ارسال پیام ناموفق بود.");
      setReply(""); setImage(null); await load();
      window.dispatchEvent(new Event("support:refresh"));
    } catch (err) { setError(err instanceof Error ? err.message : "ارسال پیام ناموفق بود."); }
    finally { setBusy(false); }
  }
  async function toggleClosed() {
    if (!ticket || busy) return;
    setBusy(true); setError(""); setMenu(false);
    const closed = ["CLOSED", "RESOLVED"].includes(ticket.status);
    try {
      const response = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: closed ? "OPEN" : "CLOSED" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تغییر وضعیت ناموفق بود.");
      await load(); window.dispatchEvent(new Event("support:changed"));
    } catch (err) { setError(err instanceof Error ? err.message : "تغییر وضعیت ناموفق بود."); }
    finally { setBusy(false); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
  }
  if (loading) return <div className="daira-support daira-support--narrow" dir="rtl" role="status"><div className="daira-support__chat-skeleton"><div className="daira-support__skeleton w-45"/><div className="daira-support__skeleton w-85"/><div className="daira-support__skeleton w-65"/></div></div>;
  if (!ticket) return <div className="daira-support daira-support--narrow" dir="rtl"><div className="daira-support__empty"><Headset size={28}/><strong>درخواست در دسترس نیست</strong><p>{loadError || "درخواست پیدا نشد."}</p></div></div>;
  const closed = ["CLOSED", "RESOLVED"].includes(ticket.status);
  return <div className="daira-support daira-support--narrow daira-support--chat" dir="rtl">
    <header className="daira-support__chat-header">
      <span className="daira-support__avatar"><Headset size={22}/></span>
      <div className="daira-support__chat-heading"><h1>{ticket.subject}</h1><span className={"daira-support__status daira-support__status--" + ticket.status.toLowerCase()}>{SUPPORT_STATUS[ticket.status] || "در حال بررسی"}</span><time>{supportDate(ticket.createdAt, true)}</time></div>
      <div className="daira-support__menu-wrap">
        <button className="daira-support__icon-button" type="button" aria-label="گزینه‌های درخواست" aria-expanded={menu} onClick={() => setMenu(value => !value)}><Ellipsis size={22}/></button>
        {menu && <div className="daira-support__menu"><button type="button" onClick={() => void toggleClosed()} disabled={busy}>{closed ? <RefreshCw size={17}/> : <CheckCheck size={17}/>} {closed ? "باز کردن دوباره" : "بستن درخواست"}</button></div>}
      </div>
    </header>
    <section className="daira-support__thread" aria-label="گفتگو با پشتیبانی">
      {ticket.messages.map(message => {
        const mine = message.senderUserId === userId;
        return <div key={message.id} className={"daira-support__message" + (mine ? " is-mine" : "")}>
          {!mine && <strong className="daira-support__sender">پشتیبانی دایرا</strong>}
          <p>{message.body}</p>
          {message.attachments.map(file => <a className="daira-support__attachment" key={file.id} href={supportAttachmentUrl(file.id)} target="_blank" rel="noopener noreferrer" title="بازکردن تصویر در اندازه اصلی">
            <img src={supportAttachmentUrl(file.id)} alt={file.fileName} loading="lazy"/>
            <span><ZoomIn size={13}/> مشاهده تصویر</span>
          </a>)}
          <time dateTime={message.createdAt}>{supportDate(message.createdAt, true)}</time>
        </div>;
      })}
      <div ref={endRef}/>
    </section>
    {closed ? <div className="daira-support__closed-note">این درخواست بسته شده است. برای ارسال پیام، از منوی بالای صفحه آن را دوباره باز کنید.</div> :
      <form onSubmit={event => void send(event)} className="daira-support__composer">
        {image && <div className="daira-support__composer-preview">{preview && <img src={preview} alt="تصویر پیوست"/>}<span>{image.name}</span><button type="button" onClick={() => setImage(null)} aria-label="حذف تصویر"><X size={17}/></button></div>}
        <div className="daira-support__composer-row">
          <label htmlFor="support-reply-image" className="daira-support__attach-btn" title="افزودن تصویر"><ImagePlus size={21}/></label>
          <input id="support-reply-image" className="daira-support__file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
            const file = event.target.files?.[0] || null;
            if (file && file.size > 2 * 1024 * 1024) { setError("تصویر باید کمتر از ۲ مگابایت باشد."); event.target.value = ""; return; }
            setImage(file); setError("");
          }}/>
          <textarea id="support-reply" rows={1} aria-label="متن پیام" maxLength={5000} value={reply} onChange={event => setReply(event.target.value)} onKeyDown={onKeyDown} placeholder="پیام خود را بنویسید..." required/>
          <button type="submit" className="daira-support__send" aria-label="ارسال پیام" disabled={busy || !reply.trim()}><Send size={20}/></button>
        </div>
      </form>}
    {error && <p className="daira-support__error" role="alert">{error}</p>}
  </div>;

}
