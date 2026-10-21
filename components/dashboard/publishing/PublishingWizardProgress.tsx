"use client";
import { Check, ChevronLeft } from "lucide-react";
import { dairaPalette } from "../../../lib/design-system/palette";
type Step = 1 | 2 | 3 | 4;
type Props = {
  step: Step;
  typeLabel: string;
  summaries: [string, string, string, string];
  disabled?: boolean;
  onBackToType: () => void;
  onNavigate: (step: Step) => void;
};
const titles = ["رسانه", "جزئیات", "پاسخ خودکار", "انتشار"] as const;
export default function PublishingWizardProgress({ step, typeLabel, summaries, disabled, onBackToType, onNavigate }: Props) {
  return <section dir="rtl" aria-label="مراحل ساخت محتوا" className="mb-5 rounded-[24px] border border-[#E8EDF5] bg-white p-3.5 shadow-[0_4px_18px_rgba(22,54,110,.035)] sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="min-w-0 text-sm font-bold" style={{color:dairaPalette.text.heading}}>انتشار {typeLabel}</p>
      <button type="button" onClick={onBackToType} disabled={disabled} className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-[#EFF6FF] px-3 text-xs font-semibold text-[#2F61FD] disabled:opacity-50">تغییر نوع <ChevronLeft size={14}/></button>
    </div>
    <ol className="grid grid-cols-4 gap-1.5 sm:gap-3">
      {titles.map((label, i) => {
        const number = (i + 1) as Step;
        const done = number < step, current = number === step;
        return <li key={label} className="min-w-0">
          <button type="button" disabled={!done || disabled} onClick={()=>onNavigate(number)}
            aria-current={current?"step":undefined}
            aria-label={done ? "ویرایش " + label : label}
            className={"flex w-full min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-center transition sm:px-3 " +
              (current ? "border-[#2F61FD] bg-[#EFF6FF]" : done ? "border-[#DBEAFE] bg-white hover:bg-[#F8FAFC]" : "border-[#E8EDF5] bg-[#F8FAFC]")}>
            <span className={"flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " + (current?"bg-[#2F61FD] text-white":done?"bg-[#DCE7FF] text-[#2F61FD]":"bg-[#E2E8F0] text-[#64748B]")}>{done?<Check size={14}/>:number.toLocaleString("fa-IR")}</span>
            <span className={"truncate text-[10px] font-bold sm:text-xs " + (current?"text-[#2F61FD]":"text-[#334155]")}>{label}</span>
          </button>
          {done ? <p className="mt-1 hidden truncate text-center text-[10px] text-[#64748B] sm:block">{summaries[i]}</p> : null}
        </li>;
      })}
    </ol>
  </section>;
}
