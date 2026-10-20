import { dairaPalette } from "../../lib/design-system/palette";

function Line({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={"block animate-pulse rounded-md bg-[#E8EDF5] " + className} />;
}
function Guide({ number, width }: { number: string; width: string }) {
  return <div className="mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3" style={{ borderColor: dairaPalette.guide.border, background: dairaPalette.guide.background }}>
    <Line className="mt-1 h-[17px] w-[17px] shrink-0 rounded-full" />
    <span className="flex flex-col gap-2">
      <span className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: dairaPalette.guide.icon }}>{number}</span><Line className={"h-3 " + width}/></span>
      <Line className="h-2.5 w-48 max-w-full"/>
    </span>
  </div>;
}
export default function SmartReminderSkeleton({ view = "list" }: { view?: "list" | "editor" }) {
  if (view === "list") return (
    <div dir="rtl" role="status" aria-label="در حال دریافت یادآوری‌ها" className="mx-auto w-full max-w-4xl space-y-4 py-3">
      <div aria-hidden="true" className="flex min-h-[54px] animate-pulse items-center justify-center gap-2 rounded-full" style={{ background: dairaPalette.primary.main, opacity: .75 }}><Line className="h-5 w-5 rounded-full bg-white/35"/><Line className="h-4 w-28 bg-white/45"/></div>
      <div aria-hidden="true" className="flex h-12 items-center gap-3 rounded-xl border border-[#DBE2ED] bg-white px-3"><Line className="h-4 w-4 rounded-full"/><Line className="h-3 w-40"/></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => <article key={i} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <div className="flex items-center gap-2"><Line className="h-9 w-9 rounded-xl bg-[#EFF6FF]"/><div className="flex-1 space-y-2"><Line className="h-3.5 w-32"/><Line className="h-2.5 w-20"/></div><Line className="h-5 w-9 rounded-full"/></div>
          <Line className="h-3 w-11/12"/><Line className="h-3 w-8/12"/><div className="flex gap-2"><Line className="h-6 w-24 rounded-lg"/><Line className="h-6 w-20 rounded-lg"/></div>
          <div className="flex gap-2 border-t border-[#F1F5F9] pt-3"><Line className="h-10 flex-1 rounded-xl bg-[#EFF6FF]"/><Line className="h-10 flex-1 rounded-xl bg-[#FFF1F2]"/></div>
        </article>)}
      </div>
    </div>
  );
  return (
    <div dir="rtl" role="status" aria-label="در حال آماده‌سازی فرم یادآوری هوشمند" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
      <section><Guide number="۱" width="w-32"/><div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5"><Line className="h-3 w-36"/><Line className="h-12 w-full rounded-xl"/></div></section>
      <section><Guide number="۲" width="w-40"/><div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5"><Line className="h-3 w-32"/><div className="grid grid-cols-3 gap-2">{[1,2,3].map(i=><Line key={i} className="h-12 w-full rounded-xl"/>)}</div><Line className="h-12 w-full rounded-xl"/></div></section>
      <section><Guide number="۳" width="w-48"/><div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5"><Line className="h-3 w-32"/><Line className="h-28 w-full rounded-xl"/><Line className="mr-auto h-2.5 w-12"/></div></section>
      <section><Guide number="۴" width="w-32"/><div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5"><Line className="h-3 w-36"/><Line className="h-6 w-11 rounded-full"/></div></section>
      <Line className="h-12 w-full rounded-xl bg-[#DBEAFE]"/>
    </div>
  );
}
