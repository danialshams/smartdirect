"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CircleUserRound, LifeBuoy } from "lucide-react";
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
  { title: "پشتیبانی", href: "/dashboard/tickets", icon: LifeBuoy },
];

export default function DashboardShell({ user, instagramAccounts, children }: DashboardShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard";
  const isAutomationCreateFlow =
    pathname === "/dashboard/comment-automation/new" ||
    pathname === "/dashboard/story-automation/new";

  const initialAccountId = instagramAccounts.find((account) => account.isConnected)?.id ?? null;

  return (
    <DashboardAccountProvider accountId={initialAccountId}>
    <DashboardBackNavigationProvider>
    <DashboardTheme>
      <div dir="rtl" className="daira-app-shell">
        <DashboardHeader instagramAccounts={instagramAccounts} showBackButton={isAutomationCreateFlow} />
        <main className={`daira-app-main${isHome ? " daira-app-main--home" : ""}${isAutomationCreateFlow ? " daira-app-main--flow-actions" : ""}`}>
          <div className="daira-app-content">
            {isHome ? (
              <DashboardOverview user={user} instagramAccounts={instagramAccounts} />
            ) : (
              children
            )}
          </div>
        </main>

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
      </div>
      <style jsx global>{`
         .daira-app-shell { display:flex;flex-direction:column;min-height:100dvh;background:#F4F7FC;color:#18233C; }
        .daira-app-main { flex:1 0 auto;min-height:0;box-sizing:border-box;padding:clamp(12px,2vw,28px) clamp(10px,2vw,24px) 128px; }
        .daira-app-content { width:100%;max-width:1240px;margin:0 auto; }
        .daira-bottom-nav-backdrop { position:fixed;left:0;right:0;bottom:0;height:100px;z-index:1490;background:#F4F7FC;pointer-events:none; }
        .daira-bottom-nav { position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:1500;flex:0 0 auto;margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;min-height:84px;padding:8px 18px;border:1px solid rgba(226,232,240,.9);border-radius:23px;background:#FFFFFF;box-shadow:0 8px 32px rgba(22,54,110,.12);box-sizing:border-box; }
        .daira-bottom-nav__item { display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#7183A8;text-decoration:none; }
        .daira-bottom-nav__icon { width:48px;height:43px;display:grid;place-items:center;border-radius:17px;transition:background .18s,color .18s,transform .18s; }
        .daira-bottom-nav__label { max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;line-height:1.4;text-align:center; }
        .daira-bottom-nav__item.is-active { color:#2F61FD; }
        .daira-bottom-nav__item.is-active .daira-bottom-nav__icon { background:linear-gradient(145deg,#3B82F6,#2F61FD);color:white;box-shadow:0 7px 18px rgba(47,97,253,.22);transform:translateY(-2px); }
        .daira-bottom-nav__item:focus-visible { outline:3px solid rgba(47,97,253,.3);outline-offset:2px;border-radius:12px; }
        @media(min-width:900px) { .daira-app-main { padding-bottom:128px; } .daira-bottom-nav { left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));border-radius:23px;padding-left:24px;padding-right:24px; } }
        @media(max-width:480px) { .daira-bottom-nav-backdrop { height:88px; } .daira-app-main { padding:8px 7px calc(100px + env(safe-area-inset-bottom, 0px)); } .daira-bottom-nav { left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom, 0px));min-height:76px;grid-template-columns:repeat(3,minmax(0,1fr));padding-left:10px;padding-right:10px;border-radius:14px; } .daira-bottom-nav__icon { width:44px;height:39px;border-radius:15px; } .daira-bottom-nav__label { font-size:10px; } }
        @media(prefers-reduced-motion:reduce) { .daira-bottom-nav__icon { transition:none; } }
        .daira-app-main--flow-actions { padding-bottom:calc(190px + env(safe-area-inset-bottom, 0px)); }
        .daira-flow-action-dock { position:fixed;left:12px;right:12px;bottom:calc(104px + env(safe-area-inset-bottom, 0px));z-index:1495;pointer-events:none; }
        .daira-flow-action-dock__inner { display:flex;align-items:stretch;gap:10px;width:min(100%,840px);margin:0 auto;padding:10px;border:1px solid rgba(226,232,240,.96);border-radius:18px;background:rgba(244,247,252,.97);box-shadow:0 8px 26px rgba(22,54,110,.13);backdrop-filter:blur(12px);pointer-events:auto; }
        .daira-flow-action-dock__button { display:flex;flex:1 1 0;min-width:0;min-height:48px;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:1px solid transparent;border-radius:12px;font-family:"Vazirmatn",Arial,sans-serif;font-size:13px;font-weight:750;line-height:1.4;text-align:center;white-space:nowrap;cursor:pointer;transition:background .16s,color .16s,border-color .16s; }
        .daira-flow-action-dock__button--primary { background:var(--daira-primary);border-color:var(--daira-primary);color:#FFFFFF; }
        .daira-flow-action-dock__button--primary:hover:not(:disabled) { background:var(--daira-primary-hover);border-color:var(--daira-primary-hover); }
        .daira-flow-action-dock__button--secondary { background:var(--daira-outline-hover-bg);border-color:var(--daira-outline);color:var(--daira-primary); }
        .daira-flow-action-dock__button--secondary:hover:not(:disabled) { background:var(--daira-outline-active-bg); }
        .daira-flow-action-dock__button:disabled { background:var(--daira-disabled-bg);border-color:var(--daira-disabled-bg);color:var(--daira-disabled-text);cursor:not-allowed; }
        @media(max-width:480px) {
          .daira-app-main--flow-actions { padding-bottom:calc(182px + env(safe-area-inset-bottom, 0px)); }
          .daira-flow-action-dock { left:8px;right:8px;bottom:calc(92px + env(safe-area-inset-bottom, 0px)); }
          .daira-flow-action-dock__inner { gap:8px;padding:8px;border-radius:15px; }
          .daira-flow-action-dock__button { min-height:46px;padding:9px 8px;font-size:11px; }
        }
        @media(prefers-reduced-motion:reduce) { .daira-flow-action-dock__button { transition:none; } }
      `}</style>
    </DashboardTheme>
    </DashboardBackNavigationProvider>
    </DashboardAccountProvider>
  );
}
