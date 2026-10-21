type Props = { view?: "create" | "queue" | "editor" };
function Pulse({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={"block animate-pulse rounded-xl bg-[#E8EDF5] " + className} />;
}
export default function PublishingPageSkeleton({ view = "create" }: Props) {
  return <div dir="rtl" role="status" aria-busy="true" aria-label="در حال دریافت اطلاعات انتشار محتوا" className="mx-auto w-full max-w-4xl px-1 py-3">
    <span className="sr-only">در حال بارگذاری اطلاعات انتشار محتوا...</span>
    {view === "queue" ? <div className="space-y-3">
      <Pulse className="mb-5 h-11 w-full" />
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="flex min-h-[94px] items-center gap-3 rounded-[22px] border border-[#E8EDF5] bg-white p-3.5">
        <Pulse className="h-16 w-14 shrink-0" /><div className="flex-1 space-y-3"><Pulse className="h-4 w-24" /><Pulse className="h-3 w-44 max-w-full" /><Pulse className="h-3 w-32" /></div><Pulse className="h-8 w-14" />
      </div>)}
    </div> : view === "editor" ? <div className="space-y-5">
      <Pulse className="h-7 w-32" />
      <div className="rounded-[24px] border border-[#E8EDF5] bg-white p-5">
        <Pulse className="mx-auto mb-5 aspect-[4/5] w-40" />
        <Pulse className="mb-3 h-4 w-24" /><Pulse className="h-32 w-full" />
        <Pulse className="mt-5 h-4 w-36" /><Pulse className="mt-3 h-11 w-full" />
      </div>
    </div> : <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }, (_, i) => <Pulse key={i} className="h-11 w-full" />)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex h-28 flex-col items-center justify-center gap-3 rounded-[22px] border border-[#E8EDF5] bg-white"><Pulse className="h-9 w-9" /><Pulse className="h-3 w-14" /></div>)}</div>
      <div className="rounded-[24px] border border-[#E8EDF5] bg-white p-5">
        <Pulse className="mb-4 h-4 w-36" /><Pulse className="h-48 w-full" />
        <Pulse className="mx-auto mt-4 h-11 w-40 max-w-full" />
      </div>
    </div>}
  </div>;
}
