"use client";

import type { ReactNode } from "react";

type DashboardPageLayoutProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardPageLayout({
  title,
  description,
  actions,
  children,
  className = "",
}: DashboardPageLayoutProps) {
  return (
    <div className={["dashboard-page-layout", className].filter(Boolean).join(" ")}>
      <header className="dashboard-page-header">
        <div className="dashboard-page-header__copy">
          <h1>{title}</h1>
          {description ? <p className="dashboard-page-description">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="dashboard-page-layout__sections">{children}</div>
    </div>
  );
}

type DashboardPageSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardPageSection({
  title,
  description,
  actions,
  children,
  className = "",
}: DashboardPageSectionProps) {
  return (
    <section className={["dashboard-page-section", className].filter(Boolean).join(" ")}>
      {title || description || actions ? (
        <header className="dashboard-page-section__header">
          <div className="min-w-0">
            {title ? <h2 className="dashboard-page-section__title">{title}</h2> : null}
            {description ? <p className="dashboard-page-description">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
