"use client";

function Placeholder({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-lg bg-[#E5EBF4] " + className} />;
}
export default function LiveAutomationSkeleton({ variant = "list" }: { variant?: "list" | "editor" }) {
  if (variant === "editor") return (
    <div dir="rtl" role="status" aria-label="در حال بارگذاری فرم پاسخ خودکار لایو" aria-busy="true" className="mx-auto w-full max-w-4xl space-y-5">
      {["کلمات کلیدی","نوع پاسخ","اولین دایرکت","شرط فالو","پاسخ بعدی"].map((title,i) => (
        <section key={title} className="space-y-2">
          <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3"><Placeholder className="h-4 w-40" /></div>
          <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
            <Placeholder className="h-4 w-28" />
            {i === 1 ? <div className="grid grid-cols-2 gap-3"><Placeholder className="h-20 w-full" /><Placeholder className="h-20 w-full" /></div> : <Placeholder className={i===2?"h-28 w-full":"h-12 w-full"} />}
          </div>
        </section>
      ))}
      <Placeholder className="h-12 w-full" />
    </div>
  );
  return (
    <div dir="rtl" role="status" aria-label="در حال بارگذاری پاسخ‌های خودکار لایو" aria-busy="true" className="mx-auto w-full max-w-4xl space-y-4">
      <Placeholder className="h-[54px] w-full rounded-full" />
      {[0,1,2,3].map((index) => (
        <div key={index} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><Placeholder className="h-5 w-36" /><Placeholder className="h-7 w-20" /></div>
          <Placeholder className="mt-3 h-4 w-3/4" />
          <div className="mt-4 flex gap-3"><Placeholder className="h-10 w-24" /><Placeholder className="h-10 w-24" /></div>
        </div>
      ))}
    </div>
  );
}
