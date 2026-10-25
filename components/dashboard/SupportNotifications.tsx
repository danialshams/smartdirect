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
// Scoped to the authenticated dashboard user; never use Instagram account
// selection as a cache key for private support conversations.
const SupportOwnerContext = createContext<string | null>(null);
export function useSupportOwnerKey() { return useContext(SupportOwnerContext); }
export function SupportUnreadBadge() {
  const unread = useContext(Context);
  return unread ? <span className="daira-support-nav-badge" aria-label={supportNumber(unread) + " پیام خوانده‌نشده"}>{unread > 99 ? "+۹۹" : supportNumber(unread)}</span> : null;
}

export default function SupportNotifications({ children, userEmail }: { children: ReactNode; userEmail: string }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const lastId = useRef<string | null>(null);
  const booted = useRef(false);
  const initialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestInFlight = useRef(false);
  const pendingRealtimeRefresh = useRef(false);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  const load = useCallback(async (reason: "initial" | "poll" | "event" | "silent" = "poll") => {
    if (requestInFlight.current) {
      // Coalesce support events while the summary request is in flight.
      // Do not lose an SSE update when realtime polling is suppressed.
      if (reason === "event") pendingRealtimeRefresh.current = true;
      return;
    }
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
      // The EventSource handler broadcasts each change once, even when there
      // is no unread item. Do not broadcast it again after the summary fetch.
      if (reason !== "event" && !first && latest && latest.id !== original) window.dispatchEvent(new Event("support:changed"));
    } catch { /* Preserve previous unread count during network outages. */ }
    finally {
      requestInFlight.current = false;
      if (pendingRealtimeRefresh.current) {
        pendingRealtimeRefresh.current = false;
        void load("event");
      }
    }
  }, []);
  useEffect(() => {
    void load("initial");
    const refresh = () => { void load("silent"); };
    window.addEventListener("support:refresh", refresh);
    let realtimeConnected = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = 5000;
    let disposed = false;
    const connectRealtime = () => {
      if (disposed || source || document.visibilityState !== "visible" || typeof EventSource === "undefined") return;
      const connection = new EventSource("/api/dashboard/tickets/stream");
      source = connection;
      connection.onopen = () => {
        if (disposed || source !== connection) return;
        realtimeConnected = true;
        reconnectDelayMs = 5000;
        void load("silent");
      };
      connection.addEventListener("support", () => {
        if (disposed || source !== connection) return;
        window.dispatchEvent(new Event("support:changed"));
        void load("event");
      });
      connection.onerror = () => {
        if (disposed || source !== connection) return;
        realtimeConnected = false;
        connection.close();
        source = null;
        // Keep polling while disconnected, then retry SSE with bounded
        // backoff so a transient stream failure does not cause permanent
        // five-second polling for the entire dashboard session.
        const delay = reconnectDelayMs;
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectRealtime();
        }, delay);
      };
    };
    const visible = () => {
      if (document.visibilityState !== "visible") return;
      void load("poll");
      if (!source) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        connectRealtime();
      }
    };
    document.addEventListener("visibilitychange", visible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !realtimeConnected) void load("poll");
    }, 5000);
    connectRealtime();
    return () => {
      disposed = true;
      if (initialTimer.current) clearTimeout(initialTimer.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(interval);
      source?.close();
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
  return <SupportOwnerContext.Provider value={userEmail}><Context.Provider value={count}>
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
  </Context.Provider></SupportOwnerContext.Provider>;
}