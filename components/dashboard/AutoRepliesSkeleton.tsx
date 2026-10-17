type AutoRepliesSkeletonProps = {
  includeCreateButton?: boolean;
};

export default function AutoRepliesSkeleton({ includeCreateButton = false }: AutoRepliesSkeletonProps) {
  return (
    <div dir="rtl" className="min-h-full px-1 py-2 sm:px-2 sm:py-3" role="status" aria-label="در حال دریافت پاسخ‌های خودکار">
      <span className="sr-only">در حال دریافت پاسخ‌های خودکار...</span>
      <div className="mx-auto w-full max-w-4xl">
        {includeCreateButton ? (
          <section className="mb-4 px-0 pt-1" aria-hidden="true">
            <div className="h-[54px] w-full animate-pulse rounded-full bg-[#2F61FD]/70" />
          </section>
        ) : null}
        <section className="rounded-[28px] bg-transparent">
          <div className="mb-4 px-1">
            <div className="h-11 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]" />
          </div>
          <div className="space-y-2.5" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex min-h-[100px] items-center justify-between gap-2.5 rounded-[22px] border border-[#E8EDF5] bg-white px-2.5 py-2.5 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-2xl border border-[#E2E8F0] bg-[#EEF3FB] sm:h-[84px] sm:w-[84px]" />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="h-3.5 w-32 max-w-[80%] animate-pulse rounded-md bg-[#E8EDF5]" />
                    <div className="h-2.5 w-20 max-w-[55%] animate-pulse rounded-md bg-[#F1F5F9]" />
                  </div>
                </div>
                <div className="h-8 w-[62px] shrink-0 animate-pulse rounded-[8px] border border-[#E8EDF5] bg-[#F8FAFC]" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
