"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Bot, Camera, CheckCircle2, Clock3, LayoutGrid, MessageCircle, Zap } from "lucide-react";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardOverviewProps = {
  user: { name: string; email: string; role: string; createdAt: Date };
  instagramAccounts: InstagramAccount[];
};

type Tool = {
  title: string;
  description: string;
  image: string;
  href: string;
  key: string;
};

type HomeSummary = {
  unreadConversations: number;
  pendingPublishing: number;
  activeAutomations: number;
};

const quickTools: Tool[] = [
  { key: "inbox", title: "صندوق دایرکت", description: "مدیریت گفتگوها و پاسخ به پیام‌های مشتریان", image: "/photos/06-inbox.webp", href: "/dashboard/inbox" },
  { key: "publishing", title: "انتشار محتوا", description: "ساخت، زمان‌بندی و پیگیری انتشار محتوا", image: "/photos/05-publishing.webp", href: "/dashboard/publishing" },
  { key: "insights", title: "آنالیز پیج", description: "بررسی روند بازدید، تعامل و عملکرد پیج", image: "/photos/10-insights.webp", href: "/dashboard/insights" },
];

const automationTools: Tool[] = [
  { key: "comment", title: "پاسخ به کامنت", description: "پاسخ خودکار به کامنت‌ها", image: "/photos/01-comment.webp", href: "/dashboard/comment-automation" },
  { key: "story", title: "پاسخ به استوری", description: "پاسخ خودکار به ریپلای استوری", image: "/photos/02-story.webp", href: "/dashboard/story-automation" },
  { key: "direct", title: "پاسخ خودکار دایرکت", description: "واکنش به کلمات کلیدی دایرکت", image: "/photos/08-direct-auto.webp", href: "/dashboard/direct-automation" },
  { key: "live", title: "پاسخ به لایو", description: "ارسال پاسخ هنگام لایو", image: "/photos/03-live.webp", href: "/dashboard/live-automation" },
];

const extraTools: Tool[] = [
  { key: "menu", title: "منوی دایرکت", description: "دسترسی سریع مخاطبان به گزینه‌ها", image: "/photos/07-direct-menu.webp", href: "/dashboard/persistent-menu" },
  { key: "icebreaker", title: "پیام شروع گفتگو", description: "خوش‌آمدگویی و شروع گفتگو", image: "/photos/09-icebreaker.webp", href: "/dashboard/ice-breaker" },
  { key: "reminders", title: "یادآوری هوشمند", description: "پیگیری هوشمند گفتگوها", image: "/photos/04-reminder.webp", href: "/dashboard/reminders" },
];

function formatNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

export default function DashboardOverview({ instagramAccounts }: DashboardOverviewProps) {
  const activeAccount = instagramAccounts.find((account) => account.isConnected);
  const activeAccountId = activeAccount?.id ?? null;
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!activeAccountId) return;
    const controller = new AbortController();
    setSummary(null);
    setSummaryStatus("loading");

    async function loadSummary() {
      try {
        const response = await fetch(
          "/api/dashboard/home-summary?accountId=" + encodeURIComponent(activeAccountId!),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) return;
        const result: { success?: boolean; data?: HomeSummary } = await response.json();
        if (controller.signal.aborted) return;
        if (result.success && result.data) {
          setSummary(result.data);
          setSummaryStatus("ready");
        } else {
          setSummaryStatus("unavailable");
        }
      } catch {
        if (!controller.signal.aborted) setSummaryStatus("unavailable");
      }
    }

    void loadSummary();
    return () => controller.abort();
  }, [activeAccountId]);

  if (!activeAccount) {
    return (
      <div className="daira-home" dir="rtl">
        <section className="daira-home__onboarding" aria-labelledby="daira-connect-title">
          <span className="daira-home__onboarding-icon"><Camera size={27} strokeWidth={1.8} /></span>
          <h1 id="daira-connect-title">پیج اینستاگرامت رو به دایرا وصل کن</h1>
          <p>بعد از اتصال پیج، ابزارهای پاسخ‌گویی خودکار، دایرکت، انتشار محتوا و آنالیز پیج از همین صفحه در دسترست قرار می‌گیرند.</p>
          <Link href="/api/instagram/connect" className="daira-home__connect-link">
            اتصال پیج اینستاگرام
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </section>

      </div>
    );
  }

  const unread = summary?.unreadConversations;
  const publishing = summary?.pendingPublishing;

  const quickStatus = (key: string): { text: string; tone: "attention" | "queue" | "neutral" } | null => {
    if (key === "inbox" && unread !== undefined) {
      return unread > 0
        ? { text: formatNumber(unread) + " گفت‌وگوی خوانده‌نشده", tone: "attention" }
        : { text: "همه گفتگوها خوانده شده‌اند", tone: "neutral" };
    }
    if (key === "publishing" && publishing !== undefined) {
      return publishing > 0
        ? { text: formatNumber(publishing) + " محتوا در صف انتشار", tone: "queue" }
        : { text: "صف انتشار خالی است", tone: "neutral" };
    }
    return null;
  };

  return (
    <div className="daira-home" dir="rtl">
      <div className="daira-home__account-bar">
        <div className="daira-home__account" aria-label="پیج اینستاگرام متصل">
          <span className="daira-home__account-dot" aria-hidden="true" />
          <span dir="ltr">{"@" + activeAccount.igUsername}</span>
        </div>
      </div>

      <section className="daira-home__section" aria-labelledby="daira-automation-title">
        <div className="daira-home__section-heading">
          <span className="daira-home__section-icon" aria-hidden="true"><Bot size={18} strokeWidth={2} /></span>
          <h2 id="daira-automation-title">پاسخ‌های هوشمند</h2>
          <span className="daira-home__section-rule" aria-hidden="true" />
          {summary ? (
            <span className={"daira-home__automation-count" + (summary.activeAutomations === 0 ? " is-empty" : "")} aria-live="polite">
              <CheckCircle2 size={14} aria-hidden="true" />
              تعداد پاسخ هوشمند فعال: {formatNumber(summary.activeAutomations)}
            </span>
          ) : summaryStatus === "loading" ? (
            <span className="daira-home__skeleton-block daira-home__automation-count-skeleton" aria-hidden="true" />
          ) : null}
        </div>
        <div className="daira-home__tool-grid daira-home__tool-grid--automation">
          {automationTools.map((tool) => (
            <Link className="daira-home__tool-card" href={tool.href} key={tool.key}>
              <span className="daira-home__tool-art">
                <Image src={tool.image} alt="" width={120} height={120} sizes="(max-width: 680px) 60px, 72px" />
              </span>
              <span className="daira-home__tool-copy">
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="daira-home__section" aria-labelledby="daira-quick-title">
        <div className="daira-home__section-heading">
          <span className="daira-home__section-icon" aria-hidden="true"><Zap size={18} strokeWidth={2} /></span>
          <h2 id="daira-quick-title">دسترسی سریع</h2>
          <span className="daira-home__section-rule" aria-hidden="true" />
        </div>
        <div className="daira-home__quick-grid">
          {quickTools.map((tool) => {
            const status = quickStatus(tool.key);
            return (
              <Link key={tool.key} className={"daira-home__quick-card daira-home__quick-card--" + tool.key} href={tool.href}>
                <span className="daira-home__quick-art">
                  <Image src={tool.image} alt="" width={144} height={144} sizes="(max-width: 680px) 94px, (max-width: 1000px) 104px, 126px" />
                </span>
                <span className="daira-home__quick-copy">
                  <strong>{tool.title}</strong>
                  <span className="daira-home__quick-desc">{tool.description}</span>
                  {status ? (
                    <span className={"daira-home__status daira-home__status--" + status.tone} aria-live="polite">
                      {status.tone === "attention" ? <MessageCircle size={13} aria-hidden="true" /> : status.tone === "queue" ? <Clock3 size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                      {status.text}
                    </span>
                  ) : summaryStatus === "loading" && tool.key !== "insights" ? (
                    <span className="daira-home__skeleton-block daira-home__status-skeleton" aria-hidden="true" />
                  ) : null}
                </span>
                <ArrowUpLeft className="daira-home__card-arrow" size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="daira-home__section" aria-labelledby="daira-extra-title">
        <div className="daira-home__section-heading">
          <span className="daira-home__section-icon" aria-hidden="true"><LayoutGrid size={18} strokeWidth={2} /></span>
          <h2 id="daira-extra-title">ابزارهای تکمیلی</h2>
          <span className="daira-home__section-rule" aria-hidden="true" />
        </div>
        <div className="daira-home__tool-grid daira-home__tool-grid--extra">
          {extraTools.map((tool) => (
            <Link className="daira-home__tool-card" href={tool.href} key={tool.key}>
              <span className="daira-home__tool-art">
                <Image src={tool.image} alt="" width={120} height={120} sizes="(max-width: 680px) 60px, 72px" />
              </span>
              <span className="daira-home__tool-copy">
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
