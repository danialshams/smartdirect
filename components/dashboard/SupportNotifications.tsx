"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headset, X, ArrowUpLeft } from "lucide-react";
import { supportNumber } from "./support-ui";

type Latest = { id: string; ticketId: string; subject: string; body: string; createdAt: string };
type Summary = { unreadCount: number; latestUnread: Latest | null };
type Notice = { count: number; item: Latest | null; initial: boolean };
const Context = createContext(0);
export function SupportUnreadBadge() {
  const unread = useContext(Context);
  return unread ? <span className="daira-support-nav-badge" aria-label={supportNumber(unread) + " پیام خوانده‌نشده"}>{unread > 99 ? "+۹۹" : supportNumber(unread)}</span> : null;
}

export default function SupportNotifications({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const lastId = useRef<string | null>(null);
  const booted = useRef(false);
  const initialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestInFlight = useRef(false);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  const load = useCallback(async (reason: "initial" | "poll" | "event" | "silent" = "poll") => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      const response = await fetch("/api/dashboard/tickets/summary", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const data = await response.json() as Summary;
      const unread = Math.max(0, Number(data.unreadCount) || 0);
      const latest = data.latestUnread || null;
      const original = lastId.current;
      const first = !booted.current;
      booted.current = true;
      lastId.current = latest?.id || null;
      setCount(unread);
      if (reason === "silent" || !unread) {
        if (!unread) { if (initialTimer.current) clearTimeout(initialTimer.current); setNotice(null); }
        return;
      }
      if (first && !(latest && pathRef.current.startsWith("/dashboard/tickets/" + latest.ticketId))) {
        initialTimer.current = setTimeout(() => { setNotice({ count: unread, item: latest, initial: true }); }, 500);
      } else if (latest && latest.id !== original && !pathRef.current.startsWith("/dashboard/tickets/" + latest.ticketId)) {
        setNotice({ count: unread, item: latest, initial: false });
      }
      if ((reason === "event" || (!first && latest?.id !== original)) && latest) window.dispatchEvent(new Event("support:changed"));
    } catch { /* Preserve previous unread count during network outages. */ }
    finally { requestInFlight.current = false; }
  }, []);
  useEffect(() => {
    void load("initial");
    const refresh = () => { void load("silent"); };
    window.addEventListener("support:refresh", refresh);
    const visible = () => { if (document.visibilityState === "visible") void load("poll"); };
    document.addEventListener("visibilitychange", visible);
    let realtimeConnected = false;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !realtimeConnected) void load("poll");
    }, 5000);
    let source: EventSource | null = null;
    if (typeof EventSource !== "undefined") {
      source = new EventSource("/api/dashboard/tickets/stream");
      source.onopen = () => { realtimeConnected = true; void load("silent"); };
      source.addEventListener("support", () => { void load("event"); window.dispatchEvent(new Event("support:changed")); });
      source.onerror = () => { realtimeConnected = false; source?.close(); source = null; };
    }
    return () => {
      if (initialTimer.current) clearTimeout(initialTimer.current);
      clearInterval(interval); source?.close();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("support:refresh", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const destination = notice?.item ? "/dashboard/tickets/" + encodeURIComponent(notice.item.ticketId) : "/dashboard/tickets";
  return <Context.Provider value={count}>
    {children}
    {notice && <div className="daira-support-toast-wrap" dir="rtl" role="status" aria-live="polite">
      <div className="daira-support-toast">
        <div className="daira-support-toast__icon"><Headset size={20}/></div>
        <Link href={destination} onClick={() => setNotice(null)} className="daira-support-toast__body">
          <strong>{notice.initial ? supportNumber(notice.count) + " پیام خوانده‌نشده از پشتیبانی" : "پیام جدید از پشتیبانی"}</strong>
          <span>{notice.item ? notice.item.subject : "پیام‌های پشتیبانی شما آماده مشاهده هستند."}</span>
          <small>مشاهده پیام‌ها <ArrowUpLeft size={13}/></small>
        </Link>
        <button type="button" onClick={() => setNotice(null)} className="daira-support-toast__close" aria-label="بستن اعلان"><X size={18}/></button>
      </div>
    </div>}
  </Context.Provider>;
}