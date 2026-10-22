"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CircleUserRound, Inbox } from "lucide-react";
import DashboardTheme from "./DashboardTheme";
import DashboardOverview from "./DashboardOverview";
import DashboardHeader from "./DashboardHeader";
import { DashboardAccountProvider } from "./DashboardAccountContext";
import { DashboardBackNavigationProvider } from "./DashboardBackNavigationContext";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardShellProps = {
  user: { name: string; email: string; role: string; createdAt: Date };
  instagramAccounts: InstagramAccount[];
  children?: ReactNode;
};

const bottomItems = [
  { title: "پروفایل", href: "/dashboard/profile", icon: CircleUserRound },
  { title: "خانه", href: "/dashboard", icon: Home },
  { title: "دایرکت", href: "/dashboard/inbox", icon: Inbox },
];

export default function DashboardShell({ user, instagramAccounts, children }: DashboardShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard";
  const isAutomationCreateFlow = [
    "/dashboard/comment-automation/new",
    "/dashboard/story-automation/new",
    "/dashboard/direct-automation/new",
  ].some((route) => pathname === route || pathname.startsWith(route + "/"));

  const initialAccountId = instagramAccounts.find((account) => account.isConnected)?.id ?? null;

  return (
    <DashboardAccountProvider accountId={initialAccountId}>
    <DashboardBackNavigationProvider>
    <DashboardTheme>
      <div dir="rtl" className={`daira-app-shell${isAutomationCreateFlow ? " daira-app-shell--automation-flow" : ""}`}>
        <div className="daira-header-backdrop" aria-hidden="true" />
        <DashboardHeader instagramAccounts={instagramAccounts} showBackButton={!isHome} />
        <main className={`daira-app-main${isHome ? " daira-app-main--home" : ""}${isAutomationCreateFlow ? " daira-app-main--flow-actions" : ""}`}>
          <div className="daira-app-content">
            {isHome ? (
              <DashboardOverview user={user} instagramAccounts={instagramAccounts} />
            ) : (
              children
            )}
          </div>
        </main>

        {!isAutomationCreateFlow && (
          <>
        <div className="daira-bottom-nav-backdrop" aria-hidden="true" />
        <nav className="daira-bottom-nav" aria-label="ناوبری اصلی">
          {bottomItems.map(({ title, href, icon: Icon }) => {
            const active = href === "/dashboard" ? isHome : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`daira-bottom-nav__item${active ? " is-active" : ""}`}>
                <span className="daira-bottom-nav__icon"><Icon size={25} strokeWidth={active ? 2.2 : 1.8} /></span>
                <span className="daira-bottom-nav__label">{title}</span>
              </Link>
            );
          })}
        </nav>
          </>
        )}
      </div>
      <style jsx global>{`
         .daira-app-shell { display:flex;flex-direction:column;min-height:100dvh;background:var(--daira-page-bg);color:var(--daira-heading); }
        .daira-header-backdrop { position:fixed;top:0;left:0;right:0;height:98px;z-index:1550;background:var(--daira-page-bg);pointer-events:none; }
        @media(max-width:900px) { .daira-header-backdrop { height:82px; } }
        @media(max-width:480px) { .daira-header-backdrop { height:78px; } }
        .daira-app-main { flex:1 0 auto;min-height:0;box-sizing:border-box;padding:calc(102px + max(8px, env(safe-area-inset-top, 0px))) clamp(10px,2vw,24px) 128px; }
        .daira-app-content { width:100%;max-width:1240px;margin:0 auto; }
        .daira-bottom-nav-backdrop { position:fixed;left:0;right:0;bottom:0;height:100px;z-index:1490;background:var(--daira-page-bg);pointer-events:none; }
        .daira-bottom-nav { position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:1500;flex:0 0 auto;margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;min-height:84px;padding:8px 18px;border:1px solid rgba(226,232,240,.9);border-radius:23px;background:var(--daira-surface);box-shadow:0 8px 32px rgba(22,54,110,.12);box-sizing:border-box; }
        .daira-bottom-nav__item { display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--daira-text);text-decoration:none; }
        .daira-bottom-nav__icon { width:48px;height:43px;display:grid;place-items:center;border-radius:17px;transition:background .18s,color .18s,transform .18s; }
        .daira-bottom-nav__label { max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;line-height:1.4;text-align:center; }
        .daira-bottom-nav__item.is-active { color:var(--daira-primary); }
        .daira-bottom-nav__item.is-active .daira-bottom-nav__icon { background:linear-gradient(145deg,var(--daira-primary),var(--daira-primary-hover));color:var(--daira-surface);box-shadow:0 7px 18px rgba(47,97,253,.22);transform:translateY(-2px); }
        .daira-bottom-nav__item:focus-visible { outline:3px solid rgba(47,97,253,.3);outline-offset:2px;border-radius:12px; }
        @media(max-width:900px) { .daira-app-main { padding-top:calc(82px + max(8px, env(safe-area-inset-top, 0px))); } }
        @media(min-width:900px) { .daira-app-main { padding-bottom:128px; } .daira-bottom-nav { left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));border-radius:23px;padding-left:24px;padding-right:24px; } }
        @media(max-width:480px) { .daira-bottom-nav-backdrop { height:88px; } .daira-app-main { padding:calc(74px + max(8px, env(safe-area-inset-top, 0px))) 7px calc(100px + env(safe-area-inset-bottom, 0px)); } .daira-bottom-nav { left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom, 0px));min-height:76px;grid-template-columns:repeat(3,minmax(0,1fr));padding-left:10px;padding-right:10px;border-radius:14px; } .daira-bottom-nav__icon { width:44px;height:39px;border-radius:15px; } .daira-bottom-nav__label { font-size:10px; } }
        @media(prefers-reduced-motion:reduce) { .daira-bottom-nav__icon { transition:none; } }
        .daira-app-main--flow-actions { padding-bottom:calc(32px + env(safe-area-inset-bottom, 0px)); }
        .daira-flow-action-dock { position:static;left:auto;right:auto;bottom:auto;z-index:auto;margin:16px 0 0;pointer-events:auto; }
        .daira-flow-action-dock__inner { display:flex;align-items:stretch;gap:12px;width:min(100%,896px);margin:0 auto;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;backdrop-filter:none;box-sizing:border-box;pointer-events:auto; }
        .daira-flow-action-dock__button { display:flex;flex:1 1 0;min-width:0;min-height:48px;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:1px solid transparent;border-radius:12px;font-family:"Vazirmatn",Arial,sans-serif;font-size:13px;font-weight:750;line-height:1.4;text-align:center;white-space:nowrap;cursor:pointer;transition:background .16s,color .16s,border-color .16s; }
        .daira-flow-action-dock__button--primary { background:var(--daira-primary);border-color:var(--daira-primary);color:var(--daira-surface); }
        .daira-flow-action-dock__button--primary:hover:not(:disabled) { background:var(--daira-primary-hover);border-color:var(--daira-primary-hover); }
        .daira-flow-action-dock__button--secondary { background:var(--daira-primary-hover);border-color:var(--daira-primary-hover);color:var(--daira-surface); }
        .daira-flow-action-dock__button--secondary:hover:not(:disabled) { background:var(--daira-primary-active);border-color:var(--daira-primary-active); }
        .daira-flow-action-dock__button:disabled { background:var(--daira-disabled-bg);border-color:var(--daira-disabled-bg);color:var(--daira-disabled-text);cursor:not-allowed; }
        .daira-form-switch { appearance:none;position:relative;display:inline-block;flex:0 0 auto;width:44px;height:25px;margin:0;border:1px solid #CBD5E1;border-radius:999px;background:#CBD5E1;cursor:pointer;transition:background .18s,border-color .18s; }
        .daira-form-switch::after { content:"";position:absolute;top:2px;right:2px;width:19px;height:19px;border-radius:50%;background:#FFFFFF;box-shadow:0 1px 3px rgba(24,35,60,.18);transition:transform .18s; }
        .daira-form-switch:checked { border-color:var(--daira-primary);background:var(--daira-primary); }
        .daira-form-switch:checked::after { transform:translateX(-19px); }
        .daira-form-switch:focus-visible { outline:0;box-shadow:0 0 0 3px rgba(47,97,253,.22); }
        .daira-form-switch:disabled { opacity:.55;cursor:not-allowed; }
        .daira-automation-step--current { position:relative;isolation:isolate; }
        .daira-automation-step--current::after { content:"";position:absolute;inset:-5px;border:2px solid var(--daira-primary);border-radius:50%;pointer-events:none;animation:dairaAutomationStepPulse 1.8s ease-out infinite; }
        @keyframes dairaAutomationStepPulse { 0% { transform:scale(.96);opacity:.72; } 70%,100% { transform:scale(1.16);opacity:0; } }
        @media(prefers-reduced-motion:reduce) { .daira-automation-step--current::after { animation:none;opacity:.35;inset:-3px; } }
        @media(max-width:480px) {
          .daira-app-main--flow-actions { padding-bottom:calc(28px + env(safe-area-inset-bottom, 0px)); }
          .daira-flow-action-dock { margin-top:12px; }
          .daira-flow-action-dock__inner { gap:8px;padding:0;border-radius:0; }
          .daira-flow-action-dock__button { min-height:44px;padding:8px;font-size:12px; }
        }
        @media(prefers-reduced-motion:reduce) { .daira-flow-action-dock__button { transition:none; } }
      `}</style>
    </DashboardTheme>
    </DashboardBackNavigationProvider>
    </DashboardAccountProvider>
  );
}
