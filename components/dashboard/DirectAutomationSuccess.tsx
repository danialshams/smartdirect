"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { dairaPalette } from "../../lib/design-system/palette";

// Keep the confirmation animation and button identical to the story/comment editor.
const successOrbits = [
  { angle: 0, size: 7, duration: 3.4, delay: 0.2, pulse: 1.7, pulseDelay: 0.4 },
  { angle: 42, size: 5, duration: 4.8, delay: 1.1, pulse: 2.1, pulseDelay: 0.1 },
  { angle: 86, size: 8, duration: 3.1, delay: 2.0, pulse: 1.6, pulseDelay: 0.8 },
  { angle: 131, size: 5, duration: 5.2, delay: 0.7, pulse: 2.3, pulseDelay: 1.2 },
  { angle: 177, size: 6, duration: 3.8, delay: 1.6, pulse: 1.8, pulseDelay: 0.5 },
  { angle: 223, size: 8, duration: 4.5, delay: 2.5, pulse: 2.0, pulseDelay: 1.4 },
  { angle: 268, size: 5, duration: 3.3, delay: 0.9, pulse: 1.9, pulseDelay: 0.7 },
  { angle: 314, size: 7, duration: 5.0, delay: 1.9, pulse: 2.2, pulseDelay: 0.2 },
];

const css = [
  ".sd-success-ring { stroke-dasharray:183;stroke-dashoffset:183;animation:sd-success-ring-draw 850ms cubic-bezier(.22,.7,.22,1) 100ms forwards; }",
  ".sd-success-path { stroke-dasharray:48;stroke-dashoffset:48;animation:sd-success-path-draw 650ms cubic-bezier(.22,.7,.22,1) 780ms forwards; }",
  ".sd-success-orbit { position:absolute;inset:0;transform-origin:center; }",
  ".sd-success-orbit-spin { position:absolute;inset:0;transform-origin:center;animation-name:sd-success-orbit;animation-timing-function:linear;animation-duration:var(--sd-orbit-duration,3.5s);animation-delay:var(--sd-orbit-delay,0s);animation-iteration-count:infinite; }",
  ".sd-success-orbit-spin.sd-success-orbit-reverse { animation-name:sd-success-orbit-reverse; }",
  ".sd-success-dot { position:absolute;top:5px;left:50%;border-radius:9999px;animation:sd-success-dot-pulse var(--sd-pulse-duration,1.8s) ease-in-out var(--sd-pulse-delay,0s) infinite; }",
  "@keyframes sd-success-ring-draw { to { stroke-dashoffset:0; } }",
  "@keyframes sd-success-path-draw { to { stroke-dashoffset:0; } }",
  "@keyframes sd-success-orbit { to { transform:rotate(360deg); } }",
  "@keyframes sd-success-orbit-reverse { to { transform:rotate(-360deg); } }",
  "@keyframes sd-success-dot-pulse { 0%,100% {opacity:.2;} 50% {opacity:.95;} }",
  "@media (prefers-reduced-motion:reduce) { .sd-success-ring,.sd-success-path,.sd-success-orbit-spin,.sd-success-dot { animation-duration:1ms !important;animation-delay:0ms !important; } }",
].join("\n");

export default function DirectAutomationSuccess({ isEditing }: { isEditing: boolean }) {
  const router = useRouter();
  return (
    <div dir="rtl" className="flex min-h-[65vh] w-full flex-col items-center justify-center px-4 py-12 text-center">
      <style>{css}</style>
      <div className="relative mb-4 flex h-32 w-32 items-center justify-center" role="img" aria-label="عملیات با موفقیت انجام شد">
        {successOrbits.map((orbit, index) => (
          <span key={index} className="sd-success-orbit" style={{ transform: "rotate(" + orbit.angle + "deg)" }} aria-hidden="true">
            <span className={"sd-success-orbit-spin " + (index % 2 ? "sd-success-orbit-reverse" : "")}
              style={{
                "--sd-orbit-duration": orbit.duration + "s",
                "--sd-orbit-delay": "-" + orbit.delay + "s",
                "--sd-pulse-duration": orbit.pulse + "s",
                "--sd-pulse-delay": "-" + orbit.pulseDelay + "s",
              } as CSSProperties}>
              <span className="sd-success-dot" style={{
                width: orbit.size + "px", height: orbit.size + "px",
                marginLeft: -orbit.size / 2 + "px", backgroundColor: dairaPalette.status.success,
              }} />
            </span>
          </span>
        ))}
        <svg viewBox="0 0 84 84" className="relative z-10 h-24 w-24 overflow-visible" fill="none" aria-hidden="true">
          <circle className="sd-success-ring" cx="42" cy="42" r="29" stroke={dairaPalette.status.success} strokeWidth="4" />
          <path className="sd-success-path" d="M25 42.5 36.5 54 59 30" stroke={dairaPalette.status.success}
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-5 text-xl font-extrabold" style={{ color: dairaPalette.text.heading }}>
        {isEditing ? "تغییرات پاسخ خودکار با موفقیت ذخیره شد" : "عملیات با موفقیت انجام شد"}
      </h1>
      <button type="button"
        onClick={() => { window.scrollTo(0, 0); router.push("/dashboard/direct-automation", { scroll: true }); }}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--daira-primary)]/30"
        style={{ background: dairaPalette.primary.main }}>
        بازگشت به لیست پاسخ‌ها
      </button>
    </div>
  );
}
