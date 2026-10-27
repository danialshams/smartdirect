"use client";
import { Children, useId, useState, type ReactNode } from "react";

/** Keep the complete desktop workspace, but expose one focused section at a time on phones/tablets. */
export default function AdminMobileSections({ labels, children, initial=0 }: {
  labels: string[]; children: ReactNode; initial?: number;
}) {
  const sections=Children.toArray(children).filter(Boolean);
  const [active,setActive]=useState(initial);
  const key=useId().replace(/:/g,"");
  return <div className="adm-responsive-sections">
    <div className="adm-section-switcher" role="tablist" aria-label="بخش‌های این صفحه">
      {sections.map((_,i)=><button key={i} id={key+"-tab-"+i} type="button" role="tab"
        aria-controls={key+"-panel-"+i} aria-selected={active===i}
        tabIndex={active===i?0:-1}
        className={"adm-section-tab "+(active===i?"is-active":"")}
        onClick={()=>setActive(i)} onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?sections.length-1:(i+(event.key==="ArrowLeft"?1:-1)+sections.length)%sections.length;setActive(next);document.getElementById(key+"-tab-"+next)?.focus();}}>{labels[i]||"بخش "+(i+1).toLocaleString("fa-IR")}</button>)}
    </div>
    <div className="adm-responsive-panels">
      {sections.map((section,i)=><div key={i} id={key+"-panel-"+i}
        role="tabpanel" aria-labelledby={key+"-tab-"+i}
        className={"adm-responsive-section-panel "+(active===i?"is-active":"")}>
        {section}
      </div>)}
    </div>
  </div>;
}
