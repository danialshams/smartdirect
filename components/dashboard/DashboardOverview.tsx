"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bot, Camera, CheckCircle2, Clock3, LayoutGrid, MessageCircle } from "lucide-react";
import { useDashboardAccountSelection } from "./DashboardAccountContext";
import DashboardHomeSkeleton from "./DashboardHomeSkeleton";
import { getDashboardHomeSnapshot, setDashboardHomeSnapshot, type DashboardHomeCounts } from "@/src/lib/dashboard/home-summary-cache";

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

const quickTools: Tool[] = [
  { key: "inbox", title: "صندوق دایرکت", description: "مدیریت گفتگوها و پاسخ به پیام‌های مشتریان", image: "/dashboard-art/inbox.webp", href: "/dashboard/inbox" },
  { key: "publishing", title: "انتشار محتوا", description: "ساخت، زمان‌بندی و پیگیری انتشار محتوا", image: "/dashboard-art/publishing.webp", href: "/dashboard/publishing" },
  { key: "insights", title: "آنالیز پیج", description: "بررسی روند بازدید، تعامل و عملکرد پیج", image: "/dashboard-art/insights.webp", href: "/dashboard/insights" },
];

const automationTools: Tool[] = [
  { key: "comment", title: "پاسخ به کامنت", description: "پاسخ خودکار به کامنت‌ها", image: "/dashboard-art/comment-reply.webp", href: "/dashboard/comment-automation" },
  { key: "story", title: "پاسخ به استوری", description: "پاسخ خودکار به ریپلای استوری", image: "/dashboard-art/story-reply.webp", href: "/dashboard/story-automation" },
  { key: "direct", title: "پاسخ خودکار دایرکت", description: "واکنش به کلمات کلیدی دایرکت", image: "/dashboard-art/direct-automation.webp", href: "/dashboard/direct-automation" },
  { key: "share-mention", title: "پاسخ به اشتراک‌گذاری و منشن", description: "پاسخ خودکار به منشن و اشتراک‌گذاری", image: "/dashboard-art/share-mention.webp", href: "/dashboard/share-mention" },
  { key: "live", title: "پاسخ به لایو", description: "ارسال پاسخ هنگام لایو", image: "/dashboard-art/live-reply.webp", href: "/dashboard/live-automation" },
  { key: "menu", title: "منوی دایرکت", description: "دسترسی سریع مخاطبان به گزینه‌ها", image: "/dashboard-art/direct-menu.webp", href: "/dashboard/persistent-menu" },
  { key: "icebreaker", title: "پیام شروع گفتگو", description: "خوش‌آمدگویی و شروع گفتگو", image: "/dashboard-art/icebreakers.webp", href: "/dashboard/ice-breaker" },
  { key: "reminders", title: "یادآوری هوشمند", description: "پیگیری هوشمند گفتگوها", image: "/dashboard-art/smart-reminders.webp", href: "/dashboard/reminders" },
];

function formatNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

export default function DashboardOverview({ user, instagramAccounts }: DashboardOverviewProps) {
  const { accountId, isReady } = useDashboardAccountSelection();
  const activeAccount = instagramAccounts.find((account) => account.id === accountId && account.isConnected)
    ?? instagramAccounts.find((account) => account.isConnected);
  const activeAccountId = activeAccount?.id ?? null;
  const [avatarFailedFor, setAvatarFailedFor] = useState<string | null>(null);
  // Account and user-scoped snapshots survive route unmounts within this tab.
  // A revisit shows existing counters immediately, then revalidates in the
  // background. The API remains authoritative and uses no-store.
  const summaryKey = activeAccountId ? user.email + ":" + activeAccountId : null;
  const [summaryState, setSummaryState] = useState<{ key: string | null; value: DashboardHomeCounts | null }>(() => {
    const cached = summaryKey ? getDashboardHomeSnapshot(summaryKey) : null;
    return { key: summaryKey, value: cached?.value ?? null };
  });
  const [summaryStatus, setSummaryStatus] = useState<"loading" | "ready" | "unavailable">(() =>
    summaryKey && getDashboardHomeSnapshot(summaryKey) ? "ready" : "loading"
  );
  const summary = summaryState.key === summaryKey ? summaryState.value : null;
  const visibleSummaryStatus = summaryState.key === summaryKey ? summaryStatus : "loading";

  useEffect(() => {
    if (!activeAccountId || !summaryKey) {
      setSummaryState({ key: null, value: null });
      setSummaryStatus("unavailable");
      return;
    }
    const scopedKey = summaryKey;
    const cached = getDashboardHomeSnapshot(scopedKey);
    setSummaryState({ key: scopedKey, value: cached?.value ?? null });
    setSummaryStatus(cached ? "ready" : "loading");
    // Do not re-request a just-fetched home summary on quick back-navigation.
    // Other visits revalidate without hiding cached counters or artwork.
    if (cached && Date.now() - cached.fetchedAt < 10_000) return;
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const response = await fetch(
          "/api/dashboard/home-summary?accountId=" + encodeURIComponent(activeAccountId!),
          { cache: "no-store", credentials: "include", signal: controller.signal },
        );
        if (!response.ok) {
          if (!controller.signal.aborted && !cached) setSummaryStatus("unavailable");
          return;
        }
        const result: { success?: boolean; data?: DashboardHomeCounts } = await response.json();
        if (controller.signal.aborted) return;
        if (result.success && result.data) {
          setDashboardHomeSnapshot(scopedKey, result.data);
          setSummaryState({ key: scopedKey, value: result.data });
          setSummaryStatus("ready");
        } else if (!cached) {
          setSummaryStatus("unavailable");
        }
      } catch {
        if (!controller.signal.aborted && !cached) setSummaryStatus("unavailable");
      }
    }

    void loadSummary();
    return () => controller.abort();
  }, [activeAccountId, summaryKey]);

  if (!isReady) return <DashboardHomeSkeleton />;

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
        <button
          type="button"
          className="daira-home__account-panel"
          aria-label={"مدیریت پیج فعال اینستاگرام، @" + activeAccount.igUsername}
          onClick={() => window.dispatchEvent(new Event("daira:open-account-manager"))}
        >
          <span className="daira-home__account-avatar">
            {avatarFailedFor !== activeAccount.id ? (
              <Image
                src={"/api/instagram/media-proxy?accountId=" + encodeURIComponent(activeAccount.id)}
                alt=""
                width={50}
                height={50}
                unoptimized
                onError={() => setAvatarFailedFor(activeAccount.id)}
              />
            ) : <Camera size={24} strokeWidth={1.8} aria-hidden="true" />}
          </span>
          <span className="daira-home__account-details">
            <span className="daira-home__account-label">پیج فعال اینستاگرام</span>
            <strong dir="ltr">{"@" + activeAccount.igUsername}</strong>
          </span>
          <span className="daira-home__account-connected"><CheckCircle2 size={14} aria-hidden="true" />متصل</span>
        </button>
      </div>

      <section className="daira-home__section" aria-labelledby="daira-automation-title">
        <div className="daira-home__section-heading daira-home__section-heading--automation">
          <span className="daira-home__section-icon" aria-hidden="true"><Bot size={20} strokeWidth={2} /></span>
          <span className="daira-home__section-title">
            <h2 id="daira-automation-title">پاسخ‌های هوشمند</h2>
          </span>
          {summary ? (
            <span className={"daira-home__automation-count" + (summary.activeAutomations === 0 ? " is-empty" : "")} aria-live="polite">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{formatNumber(summary.activeAutomations)} پاسخ خودکار فعال</span>
            </span>
          ) : visibleSummaryStatus === "loading" ? (
            <span className="daira-home__skeleton-block daira-home__automation-count-skeleton" aria-hidden="true" />
          ) : null}
        </div>
        <div className="daira-home__tool-grid daira-home__tool-grid--automation">
          {automationTools.map((tool) => (
            <Link className="daira-home__tool-card" href={tool.href} key={tool.key}>
              <span className="daira-home__tool-art">
                <Image src={tool.image} alt="" width={180} height={180} sizes="(max-width: 680px) 88px, 90px" />
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
          <span className="daira-home__section-icon" aria-hidden="true"><LayoutGrid size={20} strokeWidth={2} /></span>
          <span className="daira-home__section-title">
            <h2 id="daira-quick-title">مدیریت پیج</h2>
          </span>
        </div>
        <div className="daira-home__quick-grid">
          {quickTools.map((tool) => {
            const status = quickStatus(tool.key);
            return (
              <Link key={tool.key} className={"daira-home__quick-card daira-home__quick-card--" + tool.key + (status || (visibleSummaryStatus === "loading" && tool.key !== "insights") ? " daira-home__quick-card--status" : "")} href={tool.href}>
                <span className="daira-home__quick-art">
                  <Image src={tool.image} alt="" width={192} height={192} sizes="(max-width: 680px) 114px, (max-width: 1000px) 128px, 144px" />
                </span>
                <span className="daira-home__quick-copy">
                  <strong>{tool.title}</strong>
                  <span className="daira-home__quick-desc">{tool.description}</span>
                </span>
                {status ? (
                  <span className={"daira-home__status daira-home__status--" + status.tone} aria-live="polite">
                    {status.tone === "attention" ? <MessageCircle size={13} aria-hidden="true" /> : status.tone === "queue" ? <Clock3 size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                    <span>{status.text}</span>
                  </span>
                ) : visibleSummaryStatus === "loading" && tool.key !== "insights" ? (
                  <span className="daira-home__skeleton-block daira-home__status-skeleton" aria-hidden="true" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>



    </div>
  );
}
