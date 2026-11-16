"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";

type ConnectResponse = {
  success?: boolean;
  authorizationUrl?: string;
  error?: string;
};

/**
 * The official Instagram Business Login is launched from the browser with
 * JavaScript instead of a server 302, avoiding mobile Universal Link handoff
 * that can open an incomplete Instagram-native OAuth session.
 *
 * The authorization URL is generated server-side only for the authenticated
 * owner and contains a signed, one-time state. No tokens are handled here.
 */
export default function ReconnectInstagramPage() {
  const [message, setMessage] = useState("در حال آماده‌سازی ورود امن به اینستاگرام...");
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);

  useEffect(() => {
    const reconnectAccountId = new URLSearchParams(window.location.search).get("reconnect");
    if (!reconnectAccountId) {
      setMessage("پیج موردنظر برای اتصال مجدد مشخص نشده است. از بخش مدیریت اکانت‌ها دوباره شروع کن.");
      return;
    }

    const controller = new AbortController();

    async function start() {
      try {
        const endpoint = "/api/instagram/connect?format=json&reconnect=" + encodeURIComponent(reconnectAccountId!);
        const response = await fetch(endpoint, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as ConnectResponse;
        if (!response.ok || !result.authorizationUrl) {
          throw new Error(result.error || "آماده‌سازی اتصال مجدد ناموفق بود.");
        }

        // Never redirect a browser to an unexpected host from an API response.
        const destination = new URL(result.authorizationUrl);
        if (destination.protocol !== "https:" ||
            destination.hostname !== "www.instagram.com" ||
            destination.pathname !== "/oauth/authorize") {
          throw new Error("آدرس ورود اینستاگرام معتبر نیست.");
        }

        if (controller.signal.aborted) return;
        setAuthorizationUrl(destination.toString());
        setMessage("در حال انتقال به صفحه ورود رسمی اینستاگرام...");
        window.location.replace(destination.toString());
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage(error instanceof Error ? error.message : "شروع اتصال مجدد ناموفق بود.");
      }
    }

    void start();
    return () => controller.abort();
  }, []);

  return (
    <section dir="rtl" className="mx-auto flex min-h-[55vh] w-full max-w-lg items-center justify-center px-4 py-12">
      <div className="w-full rounded-3xl border border-[var(--daira-border)] bg-[var(--daira-surface)] p-7 text-center shadow-sm sm:p-10">
        <span aria-hidden="true" className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]">
          <RefreshCw size={26} strokeWidth={1.8} />
        </span>
        <h1 className="text-lg font-bold text-[var(--daira-heading)]">اتصال مجدد همان پیج</h1>
        <p role="status" className="mt-3 text-sm leading-8 text-[var(--daira-text)]">{message}</p>
        <p className="mt-3 text-xs leading-7 text-[var(--daira-text)]">
          برای انتخاب حساب درست، ورود تازه به اینستاگرام انجام می‌شود. پاسخ‌های خودکار و اطلاعات قبلی دایرا حذف نمی‌شوند.
        </p>
        {authorizationUrl ? (
          <a href={authorizationUrl} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 py-3 text-sm font-bold text-white">
            باز کردن صفحه ورود در مرورگر <ExternalLink size={16} />
          </a>
        ) : null}
        <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm text-[var(--daira-primary)]">
          <ArrowRight size={16} /> بازگشت به داشبورد
        </Link>
      </div>
    </section>
  );
}
