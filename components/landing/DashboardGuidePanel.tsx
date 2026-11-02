import { CheckCircle2, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { GuideStep } from "./feature-ui-guides";

/** Dashboard UI reconstruction based on its actual forms; no private data. */
export function DashboardGuidePanel({step}:{step:GuideStep}) {
  return <div className="da-dashboard-demo" aria-label={"بازسازی بصری بخش "+step.panel}>
    <div className="da-dashboard-demo__top">
      <strong>دایرا · داشبورد</strong>
      <span className="da-dashboard-demo__dots" aria-hidden="true"><i/><i/><i/></span>
    </div>
    <div className="da-dashboard-demo__body">
      <span className="da-dashboard-demo__section">{step.panel}</span>
      {step.inputs.map((input,index)=><div className="da-dashboard-demo__field" key={input}>
        {index%2===0?<SlidersHorizontal size={15} aria-hidden="true"/>:<ChevronDown size={15} aria-hidden="true"/>}
        <span>{input}</span>
      </div>)}
      <div className="da-dashboard-demo__chips">
        {step.chips.map(chip=><span key={chip}>{chip}</span>)}
      </div>
      <div className="da-dashboard-demo__action"><CheckCircle2 size={15} aria-hidden="true" style={{marginLeft:8}}/>{step.action}</div>
    </div>
  </div>;
}
