"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Instagram, Link2, MessageCircle, Sparkles } from "lucide-react";

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
  { key: "insights", title: "تحلیل پیج", description: "بررسی روند بازدید، تعامل و عملکرد پیج", image: "/photos/10-insights.webp", href: "/dashboard/insights" },
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

  useEffect(() => {
    if (!activeAccountId) return;
    const controller = new AbortController();
    setSummary(null);

    async function loadSummary() {
      try {
        const response = await fetch(
          "/api/dashboard/home-summary?accountId=" + encodeURIComponent(activeAccountId!),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) return;
        const result: { success?: boolean; data?: HomeSummary } = await response.json();
        if (result.success && result.data && !controller.signal.aborted) {
          setSummary(result.data);
        }
      } catch {
        // The tools stay available if summary metrics cannot be loaded.
      }
    }

    void loadSummary();
    return () => controller.abort();
  }, [activeAccountId]);

  if (!activeAccount) {
    return (
      <div className="daira-home" dir="rtl">
        <section className="daira-home__onboarding" aria-labelledby="daira-connect-title">
          <span className="daira-home__onboarding-icon"><Instagram size={27} strokeWidth={1.8} /></span>
          <h1 id="daira-connect-title">پیج اینستاگرامت رو به دایرا وصل کن</h1>
          <p>بعد از اتصال پیج، ابزارهای پاسخ‌گویی خودکار، دایرکت، انتشار محتوا و تحلیل پیج از همین صفحه در دسترست قرار می‌گیرند.</p>
          <Link href="/api/instagram/connect" className="daira-home__connect-link">
            اتصال پیج اینستاگرام
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </section>
        <style jsx global>{homeStyles}</style>
      </div>
    );
  }

  const unread = summary?.unreadConversations;
  const publishing = summary?.pendingPublishing;

  const quickStatus = (key: string) => {
    if (key === "inbox" && unread !== undefined) {
      return unread > 0 ? formatNumber(unread) + " گفت‌وگوی خوانده‌نشده" : "همه گفتگوها خوانده شده‌اند";
    }
    if (key === "publishing" && publishing !== undefined) {
      return publishing > 0 ? formatNumber(publishing) + " محتوا در صف انتشار" : "صف انتشار خالی است";
    }
    return null;
  };

  return (
    <div className="daira-home" dir="rtl">
      <div className="daira-home__topline">
        <div>
          <h1>ابزارهای شما</h1>
          <p>دسترسی سریع به مدیریت پیج و پیام‌ها</p>
        </div>
        <div className="daira-home__account" aria-label="پیج اینستاگرام متصل">
          <span className="daira-home__account-dot" aria-hidden="true" />
          <span dir="ltr">{"@" + activeAccount.igUsername}</span>
        </div>
      </div>

      <section className="daira-home__section" aria-labelledby="daira-quick-title">
        <div className="daira-home__section-heading">
          <h2 id="daira-quick-title">دسترسی سریع</h2>
          <span>کارهای روزمره</span>
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
                  {status ? <span className="daira-home__status" aria-live="polite">{status}</span> : null}
                </span>
                <ArrowUpLeft className="daira-home__card-arrow" size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="daira-home__section" aria-labelledby="daira-automation-title">
        <div className="daira-home__section-heading">
          <h2 id="daira-automation-title">پاسخ‌گویی خودکار</h2>
          {summary ? (
            <span className="daira-home__automation-count">
              {formatNumber(summary.activeAutomations)} اتوماسیون فعال
            </span>
          ) : <span>مدیریت پاسخ‌ها</span>}
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

      <section className="daira-home__section" aria-labelledby="daira-extra-title">
        <div className="daira-home__section-heading">
          <h2 id="daira-extra-title">ابزارهای تکمیلی</h2>
          <span>امکانات بیشتر</span>
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

      <style jsx global>{homeStyles}</style>
    </div>
  );
}

const homeStyles = \`
  .daira-home { width:100%;max-width:1120px;min-height:100%;margin:0 auto;padding:clamp(8px,1.8vw,20px) clamp(4px,1.1vw,14px) 28px;color:var(--daira-heading);font-family:inherit; }
  .daira-home__topline { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 20px; }
  .daira-home__topline h1 { margin:0;color:var(--daira-heading);font-size:clamp(18px,2vw,23px);font-weight:850;line-height:1.6; }
  .daira-home__topline p { margin:2px 0 0;font-size:12px;color:var(--daira-text);line-height:1.7; }
  .daira-home__account { max-width:100%;display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid #DBE7FA;border-radius:999px;background:var(--daira-surface);color:var(--daira-heading);font-size:12px;font-weight:700; }
  .daira-home__account span[dir=ltr] { min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .daira-home__account-dot { width:8px;height:8px;flex-shrink:0;border-radius:50%;background:var(--daira-success); }
  .daira-home__section { margin:0 0 26px; }
  .daira-home__section-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 12px; }
  .daira-home__section-heading h2 { margin:0;font-size:clamp(15px,1.5vw,17px);font-weight:850;line-height:1.5; }
  .daira-home__section-heading > span { color:var(--daira-text);font-size:11px;font-weight:550;text-align:left; }
  .daira-home__automation-count { color:var(--daira-primary)!important; }
  .daira-home__quick-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px; }
  .daira-home__quick-card,.daira-home__tool-card { position:relative;display:flex;align-items:center;min-width:0;background:var(--daira-surface);color:var(--daira-heading);text-decoration:none;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,background .18s ease; }
  .daira-home__quick-card { gap:7px;min-height:148px;padding:15px 13px;border:1px solid #EAF0FA;border-radius:20px;box-shadow:0 4px 18px rgba(24,35,60,.035); }
  .daira-home__quick-card--inbox { background:linear-gradient(125deg,#EFF5FF,#FFFFFF 78%);border-color:#DCE8FF; }
  .daira-home__quick-art { display:grid;place-items:center;flex:0 0 37%;min-width:0;max-width:118px; }
  .daira-home__quick-art img,.daira-home__tool-art img { display:block;width:100%;height:auto;object-fit:contain; }
  .daira-home__quick-copy { display:flex;flex:1;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;padding-left:12px; }
  .daira-home__quick-copy strong { font-size:clamp(13px,1.45vw,16px);font-weight:850;line-height:1.6; }
  .daira-home__quick-desc { font-size:11.5px;color:var(--daira-text);line-height:1.75; }
  .daira-home__status { font-size:10.5px;font-weight:700;line-height:1.6;color:var(--daira-primary); }
  .daira-home__card-arrow { position:absolute;left:10px;top:10px;color:#98A8C3;opacity:.75; }
  .daira-home__tool-grid { display:grid;gap:12px; }
  .daira-home__tool-grid--automation { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .daira-home__tool-grid--extra { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .daira-home__tool-card { gap:9px;min-height:105px;padding:10px 12px;border:1px solid #EAF0FA;border-radius:17px;box-shadow:0 3px 14px rgba(24,35,60,.025); }
  .daira-home__tool-art { flex:0 0 66px;max-width:66px;display:grid;place-items:center; }
  .daira-home__tool-copy { flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px; }
  .daira-home__tool-copy strong { font-size:12.5px;line-height:1.6;font-weight:800; }
  .daira-home__tool-copy > span { color:var(--daira-text);font-size:10.5px;line-height:1.6; }
  .daira-home__quick-card:hover,.daira-home__tool-card:hover { transform:translateY(-2px);box-shadow:0 9px 25px rgba(24,35,60,.075);background-color:#F9FBFF; }
  .daira-home__quick-card:focus-visible,.daira-home__tool-card:focus-visible,.daira-home__connect-link:focus-visible { outline:2px solid var(--daira-primary);outline-offset:3px; }
  .daira-home__onboarding { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:320px;padding:38px 24px;text-align:center;border-radius:24px;border:1px solid #DEE8FA;background:linear-gradient(135deg,#EEF5FF,#FFFFFF); }
  .daira-home__onboarding-icon { display:grid;place-items:center;width:60px;height:60px;margin-bottom:14px;color:var(--daira-primary);background:#E0EAFF;border-radius:19px; }
  .daira-home__onboarding h1 { margin:0;font-size:clamp(17px,2vw,22px);font-weight:850;line-height:1.7; }
  .daira-home__onboarding p { max-width:480px;margin:9px 0 22px;color:var(--daira-text);font-size:13px;line-height:1.95; }
  .daira-home__connect-link { display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:10px 19px;border-radius:13px;background:var(--daira-primary);color:#FFF;text-decoration:none;font-size:13px;font-weight:800; }
  .daira-home__connect-link:hover { background:var(--daira-primary-hover); }
  @media(max-width:1050px) {
    .daira-home__quick-grid { gap:10px; }
    .daira-home__quick-card { padding:12px 10px; }
    .daira-home__quick-art { flex-basis:35%; }
    .daira-home__tool-grid--automation { grid-template-columns:repeat(2,minmax(0,1fr)); }
  }
  @media(max-width:680px) {
    .daira-home { padding:7px 5px 20px; }
    .daira-home__topline { gap:8px;margin-bottom:17px; }
    .daira-home__topline h1 { font-size:18px; }
    .daira-home__topline p { font-size:11.5px; }
    .daira-home__account { max-width:100%;padding:6px 10px;font-size:11px; }
    .daira-home__section { margin-bottom:24px; }
    .daira-home__section-heading { margin-bottom:10px; }
    .daira-home__quick-grid { grid-template-columns:repeat(2,minmax(0,1fr));gap:9px; }
    .daira-home__quick-card { flex-direction:column;justify-content:center;gap:5px;min-height:155px;padding:12px 9px 11px;border-radius:17px;text-align:center; }
    .daira-home__quick-art { flex:0 0 auto;width:72px;max-width:72px; }
    .daira-home__quick-copy { flex:0 0 auto;align-items:center;padding:0;gap:3px; }
    .daira-home__quick-copy strong { font-size:13px; }
    .daira-home__quick-desc { font-size:11px;line-height:1.55; }
    .daira-home__card-arrow { left:8px;top:8px;width:15px;height:15px; }
    .daira-home__quick-card--inbox { grid-column:1 / -1;flex-direction:row;justify-content:flex-start;text-align:right;min-height:112px;padding:12px 13px;gap:11px; }
    .daira-home__quick-card--inbox .daira-home__quick-art { width:92px;max-width:92px; }
    .daira-home__quick-card--inbox .daira-home__quick-copy { align-items:flex-start; }
    .daira-home__quick-card--inbox .daira-home__quick-copy strong { font-size:15px; }
    .daira-home__tool-grid { gap:9px; }
    .daira-home__tool-grid--extra { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .daira-home__tool-grid--extra .daira-home__tool-card:last-child { grid-column:1 / -1; }
    .daira-home__tool-card { flex-direction:column;justify-content:center;gap:4px;min-height:118px;padding:9px 7px;border-radius:15px;text-align:center; }
    .daira-home__tool-art { flex-basis:auto;width:62px;max-width:62px; }
    .daira-home__tool-copy { align-items:center;gap:3px; }
    .daira-home__tool-copy strong { font-size:12.5px;line-height:1.6; }
    .daira-home__tool-copy > span { font-size:11px;line-height:1.6; }
    .daira-home__tool-grid--extra .daira-home__tool-card:last-child { flex-direction:row;gap:12px;min-height:94px;text-align:right; }
    .daira-home__tool-grid--extra .daira-home__tool-card:last-child .daira-home__tool-copy { align-items:flex-start; }
    .daira-home__onboarding { min-height:290px;padding:30px 18px; }
  }
  @media(max-width:370px) {
    .daira-home__quick-card { min-height:165px; }
    .daira-home__quick-card--inbox { min-height:112px; }
    .daira-home__tool-copy strong { font-size:12px; }
    .daira-home__quick-desc { font-size:10.5px; }
  }
  @media(prefers-reduced-motion:reduce) { .daira-home__quick-card,.daira-home__tool-card { transition:none; } .daira-home__quick-card:hover,.daira-home__tool-card:hover { transform:none; } }
\`;
