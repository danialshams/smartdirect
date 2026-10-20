import type { ReactNode } from "react";
import { dairaPalette } from "../../lib/design-system/palette";

function Shape({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={"block animate-pulse rounded-md bg-[#E8EDF5] " + className} />;
}

function GuideSkeleton({ number, titleWidth }: { number: number; titleWidth: string }) {
  return (
    <div aria-hidden="true" className="mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border }}>
      <Shape className="mt-1 h-[17px] w-[17px] shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: dairaPalette.guide.icon }}>
            {new Intl.NumberFormat("fa-IR").format(number)}
          </span>
          <Shape className={"h-3 " + titleWidth} />
        </div>
        <Shape className="mt-2 h-2.5 w-3/4 max-w-[340px]" />
      </div>
    </div>
  );
}

function EditorSection({ number, titleWidth, children }: { number: number; titleWidth: string; children: ReactNode }) {
  return (
    <section>
      <GuideSkeleton number={number} titleWidth={titleWidth} />
      <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

export default function LiveAutomationSkeleton({ view = "list" }: { view?: "list" | "editor" }) {
  if (view === "list") return (
    <div dir="rtl" role="status" aria-label="در حال دریافت پاسخ‌های خودکار لایو"
      className="mx-auto w-full max-w-4xl space-y-4 py-3">
      <div aria-hidden="true" className="flex min-h-[54px] w-full animate-pulse items-center justify-center gap-2 rounded-full px-5 shadow-sm"
        style={{ background: dairaPalette.primary.main, opacity: .75 }}>
        <Shape className="h-5 w-5 rounded-full bg-white/35" />
        <Shape className="h-4 w-28 bg-white/45" />
      </div>
      <div aria-hidden="true" className="relative flex min-h-12 items-center gap-3 rounded-xl border border-[#DBE2ED] bg-white px-3">
        <Shape className="h-[18px] w-[18px] shrink-0 rounded-full" />
        <Shape className="h-3 w-52 max-w-[80%]" />
      </div>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <article key={i} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_3px_12px_rgba(24,35,60,0.025)]">
            <div className="flex items-center gap-2">
              <Shape className="h-9 w-9 shrink-0 rounded-xl bg-[#EFF6FF]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Shape className="h-3.5 w-28 max-w-full" />
                <Shape className="h-2.5 w-20 max-w-full" />
              </div>
            </div>
            <div className="min-h-12 space-y-2 pt-1">
              <Shape className="h-3 w-11/12" />
              <Shape className="h-3 w-7/12" />
            </div>
            <div className="flex gap-2">
              <Shape className="h-6 w-24 rounded-lg bg-[#F1F5F9]" />
              <Shape className="h-6 w-20 rounded-lg bg-[#F1F5F9]" />
            </div>
            <div className="flex gap-2 border-t border-[#F1F5F9] pt-3">
              <div className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#EFF6FF]"><Shape className="h-3 w-12 bg-[#DBEAFE]" /></div>
              <div className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#FECACA]"><Shape className="h-3 w-10 bg-[#FEE2E2]" /></div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  return (
    <div dir="rtl" role="status" aria-label="در حال آماده‌سازی فرم پاسخ خودکار لایو"
      className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
      <EditorSection number={1} titleWidth="w-28">
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1].map(i => <div key={i} className="flex h-11 items-center rounded-xl border border-[#D8E0EC] px-3"><Shape className="h-3 w-24" /></div>)}
        </div>
        <div className="flex items-center justify-between"><Shape className="h-3 w-32" /><Shape className="h-3 w-12" /></div>
        <div className="flex gap-2"><Shape className="h-11 min-w-0 flex-1 rounded-lg" /><Shape className="h-11 w-20 rounded-lg bg-[#DFE9FF]" /></div>
      </EditorSection>
      <EditorSection number={2} titleWidth="w-48">
        <Shape className="h-3 w-48" />
        <Shape className="h-[112px] w-full rounded-xl" />
        <Shape className="mr-auto h-2.5 w-14" />
      </EditorSection>
      <EditorSection number={3} titleWidth="w-40">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <Shape className="h-3.5 w-32" />
          <Shape className="h-[25px] w-11 rounded-full" />
        </div>
      </EditorSection>
      <EditorSection number={4} titleWidth="w-28">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <Shape className="h-3.5 w-28" />
          <Shape className="h-[25px] w-11 rounded-full" />
        </div>
      </EditorSection>
      <Shape className="h-12 w-full rounded-xl bg-[#DFE9FF]" />
    </div>
  );
}
