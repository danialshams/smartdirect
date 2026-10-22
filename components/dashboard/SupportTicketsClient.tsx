"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, MessageCircle, Plus, RefreshCw } from "lucide-react";

type TicketSummary = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: { body: string; senderUserId: string; createdAt: string }[];
};
type Filter = "all" | "open" | "reply" | "closed";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "open", label: "در حال بررسی" },
  { value: "reply", label: "پاسخ پشتیبانی" },
  { value: "closed", label: "بسته‌شده" },
];
const statusLabels: Record<string, string> = {
  OPEN: "باز",
  IN_PROGRESS: "در حال بررسی",
  WAITING_USER: "منتظر پاسخ شما",
  RESOLVED: "حل‌شده",
  CLOSED: "بسته‌شده",
};
const dateFa = (date: string) => new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

export default function SupportTicketsClient() {
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/dashboard/tickets", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "دریافت درخواست‌های پشتیبانی ناموفق بود.");
        if (!controller.signal.aborted) setItems(Array.isArray(result.data) ? result.data : []);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "خطا در ارتباط با سرور.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);

  const shown = items.filter((item) => {
    if (filter === "open") return item.status === "OPEN" || item.status === "IN_PROGRESS";
    if (filter === "reply") return item.status === "WAITING_USER";
    if (filter === "closed") return item.status === "CLOSED" || item.status === "RESOLVED";
    return true;
  });

  return (
    <div className="daira-support" dir="rtl">
      <header className="daira-support__header">
        <div>
          <span className="daira-support__eyebrow"><LifeBuoy size={16} aria-hidden="true" /> مرکز راهنمایی</span>
          <h1>پشتیبانی</h1>
          <p>درخواست‌ها و پاسخ‌های پشتیبانی را از همین‌جا پیگیری کنید.</p>
        </div>
        <Link href="/dashboard/tickets/new" className="daira-support__primary"><Plus size={17} aria-hidden="true" /> درخواست جدید</Link>
      </header>

      <div className="daira-support__filters" role="group" aria-label="فیلتر درخواست‌های پشتیبانی">
        {filters.map(({ value, label }) => (
          <button key={value} type="button" className={"daira-support__filter" + (filter === value ? " is-active" : "")} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="daira-support__list" role="status" aria-label="در حال دریافت درخواست‌ها">
          {Array.from({ length: 3 }, (_, i) => <div className="daira-support__skeleton-card" key={i}><div className="daira-support__skeleton-line" /><div className="daira-support__skeleton-line short" /></div>)}
        </div>
      ) : error ? (
        <div className="daira-support__empty" role="alert">
          <p>{error}</p><button type="button" className="daira-support__secondary" onClick={() => setRefresh(x => x + 1)}><RefreshCw size={16} /> تلاش مجدد</button>
        </div>
      ) : shown.length ? (
        <div className="daira-support__list">
          {shown.map(item => (
            <Link href={"/dashboard/tickets/" + encodeURIComponent(item.id)} className="daira-support__ticket" key={item.id}>
              <div className="daira-support__ticket-top">
                <strong>{item.subject}</strong>
                <span className={"daira-support__status daira-support__status--" + item.status.toLowerCase()}>{statusLabels[item.status] ?? item.status}</span>
              </div>
              <p>{item.messages[0]?.body ?? "بدون پیام"}</p>
              <div className="daira-support__ticket-bottom">
                <span><MessageCircle size={14} aria-hidden="true" /> {dateFa(item.updatedAt)}</span>
                <ArrowLeft size={17} aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="daira-support__empty">
          <span className="daira-support__empty-icon"><LifeBuoy size={26} strokeWidth={1.7} /></span>
          <strong>{filter === "all" ? "هنوز درخواستی ثبت نکرده‌اید" : "درخواستی در این دسته وجود ندارد"}</strong>
          <p>{filter === "all" ? "برای دریافت راهنمایی، اولین درخواست پشتیبانی خود را ثبت کنید." : "برای دیدن بقیه درخواست‌ها فیلتر را تغییر دهید."}</p>
          {filter === "all" ? <Link className="daira-support__secondary" href="/dashboard/tickets/new">ثبت درخواست</Link> : null}
        </div>
      )}
    </div>
  );
}
