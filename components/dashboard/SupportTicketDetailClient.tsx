"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCheck, LifeBuoy, MessageCircle, RefreshCw, Send } from "lucide-react";

type Message = {
  id: string; body: string; createdAt: string; senderUserId: string;
  sender: { name: string; role: string };
};
type Ticket = { id: string; subject: string; status: string; createdAt: string; updatedAt: string; messages: Message[] };
type ResponseData = { data: Ticket; userId: string };

const dateFa = (date: string) => new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const statusLabel: Record<string, string> = { OPEN: "باز", IN_PROGRESS: "در حال بررسی", WAITING_USER: "منتظر پاسخ شما", RESOLVED: "حل‌شده", CLOSED: "بسته‌شده" };

export default function SupportTicketDetailClient({ id }: { id: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reply, setReply] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id), { cache: "no-store", signal });
    const result = await response.json() as ResponseData & { message?: string };
    if (!response.ok) throw new Error(result.message || "دریافت درخواست ناموفق بود.");
    if (signal?.aborted) return;
    setTicket(result.data);
    setUserId(result.userId);
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void load(controller.signal).catch(e => {
      if (!controller.signal.aborted) setLoadError(e instanceof Error ? e.message : "خطا در دریافت درخواست");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id) + "/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ثبت پاسخ ناموفق بود.");
      setReply("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در ثبت پاسخ."); }
    finally { setBusy(false); }
  }

  async function toggleClosed() {
    if (!ticket || busy) return;
    const isClosed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";
    setBusy(true);setError("");
    try {
      const response = await fetch("/api/dashboard/tickets/" + encodeURIComponent(id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isClosed ? "OPEN" : "CLOSED" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تغییر وضعیت ناموفق بود.");
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : "خطا در تغییر وضعیت."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="daira-support daira-support--narrow" dir="rtl" role="status" aria-label="در حال دریافت درخواست"><div className="daira-support__skeleton-card"><div className="daira-support__skeleton-line" /><div className="daira-support__skeleton-line short" /></div></div>;
  if (!ticket) return <div className="daira-support daira-support--narrow" dir="rtl"><div className="daira-support__empty" role="alert"><strong>درخواست در دسترس نیست</strong><p>{loadError || "این درخواست پیدا نشد."}</p></div></div>;

  const isClosed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";

  return (
    <div className="daira-support daira-support--narrow" dir="rtl">
      <header className="daira-support__header">
        <div>
          <span className="daira-support__eyebrow"><LifeBuoy size={16} aria-hidden="true" /> پشتیبانی</span>
          <h1>{ticket.subject}</h1>
          <p>{dateFa(ticket.createdAt)} · <span className={"daira-support__status daira-support__status--" + ticket.status.toLowerCase()}>{statusLabel[ticket.status] ?? ticket.status}</span></p>
        </div>
        <button type="button" className="daira-support__secondary" disabled={busy} onClick={() => void toggleClosed()}>
          {isClosed ? <RefreshCw size={16} aria-hidden="true" /> : <CheckCheck size={16} aria-hidden="true" />}
          {isClosed ? "باز کردن دوباره" : "بستن درخواست"}
        </button>
      </header>

      <section className="daira-support__thread" aria-label="گفت‌وگو با پشتیبانی">
        {ticket.messages.map(message => {
          const mine = message.senderUserId === userId;
          return (
            <div key={message.id} className={"daira-support__message" + (mine ? " is-mine" : "")}>
              <div className="daira-support__message-head">
                {mine ? "شما" : "پشتیبانی"}
                <time dateTime={message.createdAt}>{dateFa(message.createdAt)}</time>
              </div>
              <p>{message.body}</p>
            </div>
          );
        })}
        {!ticket.messages.length ? <div className="daira-support__empty"><MessageCircle size={25} /><p>هنوز پیامی ثبت نشده است.</p></div> : null}
      </section>

      {isClosed ? <div className="daira-support__closed-note">این درخواست بسته شده است. برای ارسال پاسخ، ابتدا آن را دوباره باز کنید.</div> : (
        <form className="daira-support__reply" onSubmit={send}>
          <label htmlFor="support-reply">پاسخ شما</label>
          <textarea id="support-reply" rows={4} maxLength={5000} value={reply} onChange={e => setReply(e.target.value)} placeholder="پیام خود را بنویسید..." required />
          <button className="daira-support__primary" type="submit" disabled={busy || !reply.trim()}><Send size={16} /> {busy ? "در حال ارسال..." : "ارسال پاسخ"}</button>
        </form>
      )}
      {error ? <p className="daira-support__error" role="alert">{error}</p> : null}
    </div>
  );
}
