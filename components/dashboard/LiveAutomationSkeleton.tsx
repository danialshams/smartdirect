import { dairaPalette } from "@/lib/design-system/palette";

function Pulse({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-lg bg-[#E8EDF5] " + className} />;
}
function Guide({ width = "w-40" }: { width?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border px-4 py-3"
    style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border }}>
    <Pulse className="h-6 w-6 rounded-full" /><Pulse className={"h-4 " + width} />
  </div>;
}
export default function LiveAutomationSkeleton({ mode = "list" }: { mode?: "list" | "editor" }) {
  if (mode === "list") return (
    <div dir="rtl" role="status" aria-busy="true" aria-label="در حال دریافت پاسخ‌های خودکار لایو"
      className="mx-auto w-full max-w-4xl space-y-4 py-2">
      <Pulse className="h-14 w-full rounded-full" />
      <Pulse className="h-11 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[1,2,3,4].map((x) => (
          <div key={x} className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <Pulse className="h-5 w-32" /><Pulse className="h-4 w-4/5" />
            <div className="flex gap-2"><Pulse className="h-9 w-24" /><Pulse className="h-9 w-20" /></div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div dir="rtl" role="status" aria-busy="true" aria-label="در حال بارگذاری فرم پاسخ خودکار لایو"
      className="mx-auto w-full max-w-4xl space-y-5 py-2">
      <Guide width="w-48" />
      <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
        <Pulse className="h-4 w-36" /><Pulse className="h-11 w-full rounded-xl" />
        <Pulse className="h-11 w-full rounded-xl" />
      </div>
      <Guide width="w-36" />
      <div className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2"><Pulse className="h-16 w-full" /><Pulse className="h-16 w-full" /></div>
        <Pulse className="h-24 w-full rounded-xl" />
      </div>
      <Guide width="w-40" />
      <div className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
        <Pulse className="h-4 w-36" /><Pulse className="h-12 w-full rounded-xl" />
        <Pulse className="h-11 w-full rounded-xl" />
      </div>
      <Pulse className="h-12 w-full rounded-xl" />
    </div>
  );
}
