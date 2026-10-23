import { Lightbulb } from "lucide-react";
import { dairaPalette } from "../../../lib/design-system/palette";
import type { ReactNode } from "react";

export default function PublishingSectionGuide({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="daira-guide-glass mb-3 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-right sm:px-5"
      style={{background:"var(--daira-guide-glass)",borderColor:"var(--daira-guide-glass-rim)"}}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{background:"#FFF1C5",color:dairaPalette.guide.icon}} aria-hidden="true"><Lightbulb size={20}/></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-6" style={{color:dairaPalette.guide.text}}>
          {number.toLocaleString("fa-IR")}. {title}
        </p>
        <p className="mt-1 text-xs leading-6" style={{color:dairaPalette.guide.text}}>{children}</p>
      </div>
    </div>
  );
}
