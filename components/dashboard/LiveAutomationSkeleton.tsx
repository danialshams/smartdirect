import { dairaPalette } from "../../lib/design-system/palette";

function Shape({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-lg bg-[#E8EDF5] " + className} />;
}
function Section({ titleWidth = "w-40", children }: { titleWidth?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border px-3.5 py-3" style={{ borderColor: dairaPalette.guide.border, background: dairaPalette.guide.background }}>
        <Shape className="h-6 w-6 rounded-full" /><Shape className={"h-4 " + titleWidth} />
      </div>
      <div className="space-y-3 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
        {children}
      </div>
    </section>
  );
}
export default function LiveAutomationSkeleton({ view = "list" }: { view?: "list" | "editor" }) {
  if (view === "list") return (
    <div dir="rtl" role="status" aria-label="در حال دریافت پاسخ‌های خودکار لایو" className="mx-auto w-full max-w-4xl space-y-5 py-3">
      <Shape className="h-14 w-full rounded-full" />
      <Shape className="h-12 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-4 rounded-2xl border bg-white p-4" style={{ borderColor: dairaPalette.border }}>
            <div className="flex items-center justify-between"><Shape className="h-5 w-28" /><Shape className="h-8 w-8" /></div>
            <Shape className="h-4 w-full" /><Shape className="h-4 w-4/5" />
            <div className="flex gap-2"><Shape className="h-9 w-24" /><Shape className="h-9 w-24" /></div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div dir="rtl" role="status" aria-label="در حال آماده‌سازی فرم پاسخ خودکار لایو" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
      <Section titleWidth="w-32">
        <Shape className="h-4 w-28" /><div className="flex gap-2"><Shape className="h-9 w-20 rounded-full" /><Shape className="h-9 w-24 rounded-full" /></div><Shape className="h-12 w-full" />
      </Section>
      <Section titleWidth="w-48">
        <Shape className="h-4 w-52" /><Shape className="h-28 w-full rounded-xl" />
      </Section>
      <Section titleWidth="w-40">
        <div className="grid grid-cols-2 gap-2"><Shape className="h-16 w-full rounded-xl" /><Shape className="h-16 w-full rounded-xl" /></div>
        <Shape className="h-12 w-full" />
      </Section>
      <Section titleWidth="w-32">
        <Shape className="h-5 w-44" /><Shape className="h-12 w-full" />
      </Section>
      <Shape className="h-12 w-full rounded-xl" />
    </div>
  );
}
