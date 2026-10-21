"use client";

import { Check } from "lucide-react";
import { dairaPalette } from "../../../lib/design-system/palette";

export type PublishingStep = 1 | 2 | 3 | 4;
type Props = {
  step: PublishingStep;
  furthestStep: PublishingStep;
  typeLabel: string;
  summaries: [string, string, string, string];
  disabled?: boolean;
  skipDetails?: boolean;
  canNavigate: (step: PublishingStep) => boolean;
  onNavigate: (step: PublishingStep) => void;
};
const labels = ["رسانه", "جزئیات", "پاسخ خودکار", "انتشار"] as const;
const theme = dairaPalette.publishing;

export default function PublishingWizardProgress({
  step, furthestStep, typeLabel, summaries, disabled = false, skipDetails = false, canNavigate, onNavigate,
}: Props) {
  const visible = ([1, 2, 3, 4] as PublishingStep[]).filter((n) => !skipDetails || n !== 2);
  return (
    <section dir="rtl" aria-label="مراحل ساخت محتوا" className="mb-5 overflow-hidden rounded-[22px] border bg-white shadow-[0_4px_18px_rgba(22,54,110,.035)]" style={{borderColor:theme.border}}>
      <div className="border-b px-4 py-3.5 sm:px-5" style={{borderColor:theme.border,background:theme.soft}}>
        <p className="text-sm font-bold" style={{color:dairaPalette.text.heading}}>انتشار {typeLabel}</p>
        <p className="mt-1 text-[11px] leading-5" style={{color:dairaPalette.text.body}}>برای مشاهده یا ویرایش بخش‌های تکمیل‌شده، مرحلهٔ موردنظر را انتخاب کنید.</p>
      </div>
      <ol className={"grid gap-2 p-3 sm:gap-3 sm:p-4 "+(skipDetails?"grid-cols-3":"grid-cols-4")}>
        {visible.map((number,index) => {
          const current = step === number;
          const done = number < furthestStep && !current;
          const available = !disabled && canNavigate(number);
          return (
            <li key={number} className="min-w-0">
              <button type="button" onClick={() => onNavigate(number)} disabled={!available}
                aria-current={current?"step":undefined}
                aria-label={(current?"مرحله فعلی: ":done?"ویرایش مرحله تکمیل‌شده: ":"انتخاب مرحله: ")+labels[number-1]}
                className={"relative flex min-h-[77px] w-full flex-col items-center justify-center gap-2 rounded-2xl border px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F61FD] disabled:cursor-default "+
                  (current?"bg-[#EDF3FF]":done?"bg-[#EAF8EF]":"bg-white")}
                style={{borderColor:current?theme.selectedBorder:done?theme.completedBorder:theme.border,
                  boxShadow:current?"0 0 0 2px "+theme.pulseGlow:undefined}}>
                {current && <span className="pointer-events-none absolute inset-[2px] rounded-[13px] border-2 border-[#2F61FD]/35 motion-safe:animate-pulse" aria-hidden="true" />}
                <span className={"relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold "+(current?"bg-[#2F61FD] text-white motion-safe:animate-pulse":done?"bg-[#16A34A] text-white":"bg-[#E8EDF5] text-[#71819B]")}>
                  {done?<Check size={19} strokeWidth={3.2}/>:Number(index+1).toLocaleString("fa-IR")}
                </span>
                <span className={"relative truncate text-[11px] font-bold sm:text-xs "+(current?"text-[#2F61FD]":done?"text-[#15803D]":"text-[#52647F]")}>{labels[number-1]}</span>
              </button>
              {done && summaries[number-1] && <p className="mt-1 hidden truncate text-center text-[10px] text-[#5A6B87] sm:block">{summaries[number-1]}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
