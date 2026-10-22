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
      
    </DashboardTheme>
    </DashboardBackNavigationProvider>
    </DashboardAccountProvider>
  );
}
