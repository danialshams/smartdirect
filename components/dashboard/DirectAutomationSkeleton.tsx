"use client";

import AutoRepliesSkeleton from "./AutoRepliesSkeleton";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-lg bg-[var(--daira-surface-active,#E2E8F0)] " + className} />;
}
function GuideSkeleton({ width }: { width: string }) {
  return (
    <div className="daira-skeleton-glass mb-3 flex items-center gap-3 rounded-xl border border-[var(--daira-guide-border,#E2E8F0)] bg-[var(--daira-surface-hover,#F8FAFC)] px-3.5 py-3">
      <Bar className="h-5 w-5 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2"><Bar className={"h-4 " + width} /><Bar className="h-3 w-4/5" /></div>
    </div>
  );
}

export default function DirectAutomationSkeleton({ view = "list" }: { view?: "list" | "editor" }) {
  // Story and comment lists use this exact same button / search / row skeleton.
  if (view === "list") return <AutoRepliesSkeleton includeCreateButton />;

  return (
    <div dir="rtl" role="status" aria-busy="true" aria-label="در حال بارگذاری پاسخ خودکار دایرکت"
      className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
      <span className="sr-only">در حال بارگذاری فرم پاسخ خودکار دایرکت...</span>
      <section>
        <GuideSkeleton width="w-44" />
        <div className="daira-skeleton-glass space-y-3 rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <Bar className="h-8 w-20 rounded-full" /><Bar className="h-8 w-24 rounded-full" />
            <Bar className="h-8 w-16 rounded-full" />
          </div>
          <div className="flex gap-2"><Bar className="h-12 min-w-0 flex-1 rounded-xl" /><Bar className="h-12 w-20 rounded-xl" /></div>
          <Bar className="h-3 w-64 max-w-full" />
        </div>
      </section>
      <section>
        <GuideSkeleton width="w-40" />
        <div className="daira-skeleton-glass space-y-4 rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-4 sm:p-5">
          <Bar className="h-4 w-40" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) =>
              <div key={index} className="daira-skeleton-glass space-y-3 rounded-xl border border-[var(--daira-border,#E2E8F0)] p-3">
                <Bar className="mx-auto h-9 w-9 rounded-xl" />
                <Bar className="mx-auto h-3 w-14" />
              </div>)}
          </div>
          <Bar className="h-28 w-full rounded-xl" />
          <Bar className="h-11 w-full rounded-xl" />
        </div>
      </section>
    </div>
  );
}
