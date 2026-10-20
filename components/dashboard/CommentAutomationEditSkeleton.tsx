"use client";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-lg bg-[var(--daira-surface-active,#E2E8F0)] " + className} />;
}

function GuideSkeleton({ width = "w-52" }: { width?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--daira-guide-border,#E2E8F0)] bg-[var(--daira-surface-hover,#F8FAFC)] px-3.5 py-3">
      <Bar className="h-5 w-5 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2"><Bar className={"h-4 " + width} /><Bar className="h-3 w-4/5" /></div>
    </div>
  );
}

export default function CommentAutomationEditSkeleton({ kind = "comment" }: { kind?: "comment" | "story" }) {
  return (
    <div dir="rtl" role="status" aria-label={kind === "story" ? "در حال بارگذاری ویرایش پاسخ خودکار استوری" : "در حال بارگذاری ویرایش پاسخ خودکار کامنت"} aria-busy="true" className="mx-auto w-full max-w-4xl space-y-5 py-2 sm:py-4">
      <div className="space-y-2">
        <GuideSkeleton width="w-44" />
        <div className="space-y-4 rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><Bar className="h-5 w-32" /><Bar className="h-10 w-36 rounded-xl" /></div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[var(--daira-border,#E2E8F0)]">
                <Bar className="aspect-square w-full rounded-none" />
                <Bar className="mx-auto my-2 h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <GuideSkeleton />
        <div className="space-y-4 rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2"><Bar className="h-[76px] rounded-xl" /><Bar className="h-[76px] rounded-xl" /></div>
          <div className="flex flex-wrap gap-2"><Bar className="h-8 w-20 rounded-full" /><Bar className="h-8 w-24 rounded-full" /><Bar className="h-8 w-16 rounded-full" /></div>
          <Bar className="h-11 w-full rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <GuideSkeleton width="w-40" />
        <div className="space-y-3 rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-4 sm:p-5"><Bar className="h-5 w-40" /><Bar className="h-28 w-full rounded-xl" /></div>
      </div>
      <div className="space-y-2">
        <GuideSkeleton width="w-36" />
        <div className="space-y-3 rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-4 sm:p-5">
          <Bar className="h-5 w-28" />
          <div className="grid gap-2 sm:grid-cols-2"><Bar className="h-[68px] rounded-xl" /><Bar className="h-[68px] rounded-xl" /></div>
          <Bar className="h-32 w-full rounded-xl" />
        </div>
      </div>
      <div className="space-y-2"><GuideSkeleton width="w-36" /><div className="rounded-2xl border border-[var(--daira-border,#E2E8F0)] bg-white p-5"><Bar className="h-12 w-52 rounded-xl" /></div></div>
      <Bar className="h-12 w-full rounded-xl" />
    </div>
  );
}
