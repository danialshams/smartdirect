"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Headset, MessageCircle, Plus, RefreshCw, ArrowLeft, Inbox, CheckCheck } from "lucide-react";
import { SUPPORT_STATUS, supportDate, supportNumber } from "./support-ui";

type Ticket = { id: string; subject: string; status: string; category: string; updatedAt: string; unreadCount: number; messages: { body: string; senderUserId: string }[] };
type Filter = "all" | "unread" | "active" | "closed";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "همه" }, { value: "unread", label: "خوانده‌نشده" },
  { value: "active", label: "در حال پیگیری" }, { value: "closed", label: "بسته‌شده" },
];

export default function SupportTicketsClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const load = useCallback(async (signal?: AbortSignal, initial = false) => {
    if (initial) setLoading(true);
    try {
      const response = await fetch("/api/dashboard/tickets", { cache: "no-store", credentials: "include", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "خطا در دریافت درخواست‌ها");
      if (!signal?.aborted) { setTickets(data.data || []); setUserId(data.userId || ""); setError(""); }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "ارتباط با سرور برقرار نشد.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal, true);
    const onChange = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("support:changed", onChange);
    const visibility = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); window.removeEventListener("support:changed", onChange); document.removeEventListener("visibilitychange", visibility); };
  }, [load]);
  const shown = useMemo(() => tickets.filter(ticket =>
    filter === "unread" ? ticket.unreadCount > 0 :
    filter === "active" ? !["CLOSED", "RESOLVED"].includes(ticket.status) :
    filter === "closed" ? ["CLOSED", "RESOLVED"].includes(ticket.status) : true
  ), [tickets, filter]);
  const unreadTickets = tickets.filter(ticket => ticket.unreadCount > 0).length;

  return <div className="daira-support" dir="rtl">
    <header className="daira-support__header">
      <div className="daira-support__header-title">
        <span className="daira-support__header-icon" aria-hidden="true"><Headset size={21} strokeWidth={1.9}/></span>
        <div className="daira-support__header-copy"><h1>پشتیبانی</h1><p>درخواست‌ها و گفتگوهای شما</p></div>
      </div>
      <Link href="/dashboard/tickets/new" className="daira-support__primary"><Plus size={19} strokeWidth={2.2} aria-hidden="true"/><span dir="rtl">درخواست جدید</span></Link>
    </header>
    <div role="group" aria-label="فیلتر درخواست‌ها" className="daira-support__filters">
      {filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={"daira-support__filter" + (filter === item.value ? " is-active" : "")}>
        {item.label}{item.value === "unread" && unreadTickets > 0 && <span className="daira-support__filter-count">{supportNumber(unreadTickets)}</span>}
      </button>)}
    </div>
    {loading ? <div className="daira-support__list" role="status" aria-label="در حال دریافت گفتگوها">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="daira-support__ticket is-skeleton"><span className="daira-support__avatar daira-support__skeleton"/><div className="daira-support__ticket-main"><i className="daira-support__skeleton w-65"/><i className="daira-support__skeleton w-85"/><i className="daira-support__skeleton w-45"/></div></div>)}
    </div> : error ? <div className="daira-support__empty daira-empty-state"><RefreshCw size={28}/><strong>دریافت گفتگوها ناموفق بود</strong><p>{error}</p><button className="daira-support__secondary" onClick={() => void load()}>تلاش دوباره</button></div> :
      shown.length ? <div className="daira-support__list">
        {shown.map(ticket => {
          const last = ticket.messages[0];
          const unread = ticket.unreadCount > 0;
          return <Link key={ticket.id} href={"/dashboard/tickets/" + encodeURIComponent(ticket.id)} className={"daira-support__ticket" + (unread ? " is-unread" : "")}>
            <span className="daira-support__avatar"><Headset size={22}/></span>
            <div className="daira-support__ticket-main">
              <div className="daira-support__ticket-top"><strong>{ticket.subject}</strong><time>{supportDate(ticket.updatedAt)}</time></div>
              <p>{last ? (last.senderUserId === userId ? "شما: " : "پشتیبانی: ") + last.body : "هنوز پیامی ثبت نشده است."}</p>
              <div className="daira-support__ticket-bottom"><span className={"daira-support__status daira-support__status--" + ticket.status.toLowerCase()}>{unread ? "پاسخ جدید" : SUPPORT_STATUS[ticket.status] || "در حال بررسی"}</span>
                <span className="daira-support__ticket-end">{unread ? <b className="daira-support__unread">{supportNumber(ticket.unreadCount)}</b> : <ArrowLeft size={16}/>}</span>
              </div>
            </div>
          </Link>;
        })}
      </div> :
      <div className="daira-support__empty daira-empty-state"><span className="daira-support__empty-icon">{filter === "all" ? <MessageCircle size={27}/> : filter === "unread" ? <CheckCheck size={27}/> : <Inbox size={27}/>}</span>
        <strong>{filter === "all" ? "هنوز درخواستی ثبت نکرده‌اید" : filter === "unread" ? "همه پیام‌ها خوانده شده‌اند" : "درخواستی در این بخش وجود ندارد"}</strong>
        <p>{filter === "all" ? "برای دریافت کمک، «درخواست جدید» را در بالای صفحه انتخاب کنید." : "برای مشاهده سایر گفتگوها می‌توانید فیلتر را تغییر دهید."}</p>
      </div>}
  </div>;
}