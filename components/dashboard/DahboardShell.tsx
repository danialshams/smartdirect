"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CircleUserRound, Headset, ChevronRight } from "lucide-react";
import DashboardTheme from "./DashboardTheme";
import { getDashboardBottomPageTitle } from "./dashboard-bottom-nav-labels";
import DashboardOverview from "./DashboardOverview";
import DashboardHeader from "./DashboardHeader";
import { DashboardAccountProvider } from "./DashboardAccountContext";
import { DashboardBackNavigationProvider } from "./DashboardBackNavigationContext";
import SupportNotifications, { SupportUnreadBadge } from "./SupportNotifications";

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
  { title: "پشتیبانی", href: "/dashboard/tickets", icon: Headset },
];

export default function DashboardShell({ user, instagramAccounts, children }: DashboardShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard";
  const currentPageTitle = getDashboardBottomPageTitle(pathname);
  const isAutomationCreateFlow = [
    "/dashboard/comment-automation/new",
    "/dashboard/story-automation/new",
    "/dashboard/direct-automation/new",
  ].some((route) => pathname === route || pathname.startsWith(route + "/"));

  const initialAccountId = instagramAccounts.find((account) => account.isConnected)?.id ?? null;

  return (
    <DashboardAccountProvider accountId={initialAccountId} accountIds={instagramAccounts.filter((account) => account.isConnected).map((account) => account.id)} accounts={instagramAccounts}>
    <DashboardBackNavigationProvider>
    <DashboardTheme>
    <SupportNotifications>
      <div dir="rtl" className={`daira-app-shell${isAutomationCreateFlow ? " daira-app-shell--automation-flow" : ""}`}>
        <div className="daira-header-backdrop daira-header-backdrop--liquid" aria-hidden="true" />
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

        <div className="daira-bottom-nav-backdrop daira-bottom-nav-backdrop--liquid" aria-hidden="true" />
        <div className="daira-liquid-corner-guard daira-liquid-corner-guard--nav" aria-hidden="true" />
        <nav className={`daira-bottom-nav daira-bottom-nav--liquid${isHome ? "" : " daira-bottom-nav--contextual"}`} aria-label="ناوبری اصلی">
          {bottomItems.map(({ title, href, icon: Icon }) => {
            if (href === "/dashboard") {
              return (
                <div key={href} className="daira-bottom-nav__center">
                  <Link
                    href="/dashboard"
                    aria-current={isHome ? "page" : undefined}
                    aria-hidden={!isHome}
                    tabIndex={isHome ? 0 : -1}
                    className={`daira-bottom-nav__item daira-bottom-nav__center-home${isHome ? " is-active" : ""}`}
                  >
                    <span className="daira-bottom-nav__icon"><Home size={25} strokeWidth={isHome ? 2.2 : 1.8} /></span>
                    <span className="daira-bottom-nav__label">خانه</span>
                  </Link>
                  <div dir="ltr" className="daira-bottom-nav__breadcrumb" role="group" aria-label="مسیر صفحه" aria-hidden={isHome}>
                    <Link href="/dashboard" className="daira-bottom-nav__home-link" aria-label="خانه" tabIndex={isHome ? -1 : 0}>
                      <Home size={19} strokeWidth={1.9} aria-hidden="true" />
                      <span>خانه</span>
                    </Link>
                    <ChevronRight size={15} className="daira-bottom-nav__separator" aria-hidden="true" />
                    <span
                      key={pathname}
                      className="daira-bottom-nav__current-page"
                      aria-current={isHome ? undefined : "page"}
                      title={currentPageTitle}
                    >
                      {currentPageTitle}
                    </span>
                  </div>
                </div>
              );
            }
            const active = href === "/dashboard" ? isHome : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`daira-bottom-nav__item${active ? " is-active" : ""}`}>
                <span className="daira-bottom-nav__icon" style={{ position: "relative" }}><Icon size={25} strokeWidth={active ? 2.2 : 1.8} />{href === "/dashboard/tickets" && <SupportUnreadBadge />}</span>
                <span className="daira-bottom-nav__label">{title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      
    </SupportNotifications>
    </DashboardTheme>
    </DashboardBackNavigationProvider>
    </DashboardAccountProvider>
  );
}
