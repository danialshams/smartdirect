"use client";

const Bar=({className=""}:{className?:string})=><div aria-hidden="true" className={"animate-pulse rounded-xl bg-[#E7EDF6] "+className}/>;
function Guide({width="w-40"}:{width?:string}){
 return <div className="mb-3 flex gap-3 rounded-xl border border-[#DFE7F4] bg-[#F7F9FD] p-3.5">
  <Bar className="h-5 w-5 shrink-0 rounded-full"/>
  <div className="flex-1 space-y-2"><Bar className={"h-4 "+width}/><Bar className="h-3 w-4/5"/></div>
 </div>;
}
export default function ShareMentionSkeleton(){
 return <div dir="rtl" aria-busy="true" role="status" aria-label="در حال بارگذاری پاسخ به اشتراک‌گذاری و منشن" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
  <span className="sr-only">در حال بارگذاری تنظیمات پاسخ...</span>
  <section><Guide/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
   {[0,1].map(x=><div key={x} className="flex h-28 items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
    <Bar className="h-9 w-9"/><div className="flex-1 space-y-3"><Bar className="h-4 w-36"/><Bar className="h-3 w-4/5"/></div>
   </div>)}
  </div></section>
  <section><Guide width="w-44"/><div className="rounded-2xl border border-[#E2E8F0] bg-white p-4"><Bar className="h-12 w-full"/><Bar className="mt-3 h-3 w-44"/></div></section>
  <section><Guide width="w-32"/><div className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
   <Bar className="h-4 w-36"/><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
    {Array.from({length:5},(_,i)=><div key={i} className="space-y-2 rounded-xl border border-[#E2E8F0] p-3"><Bar className="mx-auto h-9 w-9"/><Bar className="mx-auto h-3 w-14"/></div>)}
   </div><Bar className="h-24 w-full"/><Bar className="h-11 w-full"/>
  </div></section>
 </div>;
}
