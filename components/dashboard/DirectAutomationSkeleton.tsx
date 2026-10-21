"use client";
import { dairaPalette } from "../../lib/design-system/palette";
const line=(w:string)=>"animate-pulse rounded-lg "+w;
export default function DirectAutomationSkeleton({view="list"}:{view?:"list"|"editor"}){
 return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4" aria-label="در حال دریافت پاسخ‌های خودکار دایرکت">
  {view==="list"?<>
   <div className="h-[54px] animate-pulse rounded-full" style={{background:dairaPalette.secondary.hoverBackground}}/>
   <div className={line("h-12 w-full")} style={{background:dairaPalette.background.surfaceHover}}/>
   <div className="grid gap-3 sm:grid-cols-2">{Array.from({length:6},(_,i)=><div key={i}
    className="space-y-4 rounded-2xl border bg-white p-4" style={{borderColor:dairaPalette.border}}>
    <div className="flex items-center gap-3"><span className="h-12 w-12 animate-pulse rounded-xl" style={{background:dairaPalette.secondary.hoverBackground}}/>
      <div className="flex-1 space-y-2"><div className={line("h-3 w-2/3")} style={{background:dairaPalette.background.surfaceHover}}/><div className={line("h-2.5 w-1/3")} style={{background:dairaPalette.background.surfaceHover}}/></div></div>
    <div className="flex gap-2"><div className={line("h-8 w-20")} style={{background:dairaPalette.secondary.hoverBackground}}/><div className={line("h-8 w-16")} style={{background:dairaPalette.background.surfaceHover}}/></div>
   </div>)}</div>
  </>:<>
   <div className={line("h-10 w-24")} style={{background:dairaPalette.background.surfaceHover}}/>
   {[1,2].map(n=><section key={n} className="space-y-3">
    <div className="flex gap-3 rounded-xl border p-4" style={{borderColor:dairaPalette.guide.border,background:dairaPalette.guide.background}}>
      <span className="h-5 w-5 animate-pulse rounded-full" style={{background:dairaPalette.secondary.hoverBackground}}/><div className="flex-1 space-y-2">
      <div className={line("h-3 w-40")} style={{background:dairaPalette.secondary.hoverBackground}}/>
      <div className={line("h-2.5 w-4/5")} style={{background:dairaPalette.secondary.hoverBackground}}/></div>
    </div><div className="space-y-4 rounded-2xl border bg-white p-5" style={{borderColor:dairaPalette.border}}>
     {n===1?<><div className="flex gap-2"><span className={line("h-8 w-20")} style={{background:dairaPalette.secondary.hoverBackground}}/>
       <span className={line("h-8 w-28")} style={{background:dairaPalette.secondary.hoverBackground}}/></div>
       <div className={line("h-12 w-full")} style={{background:dairaPalette.background.surfaceHover}}/></>:
       <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({length:6},(_,i)=><div key={i} className={line("h-28 w-full")} style={{background:dairaPalette.background.surfaceHover}}/>)}</div>}
    </div></section>)}
  </>}
 </div>;
}
