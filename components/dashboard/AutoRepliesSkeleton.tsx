type AutoRepliesSkeletonProps = {
  includeCreateButton?: boolean;
};

export default function AutoRepliesSkeleton({ includeCreateButton = false }: AutoRepliesSkeletonProps) {
  return (
    <div
      dir="rtl"
      className={includeCreateButton ? "min-h-[calc(100dvh-2rem)]" : "min-h-full px-1 py-2 sm:px-2 sm:py-3"}
      role="status"
      aria-label="در حال دریافت پاسخ‌های خودکار"
    >
      <span className="sr-only">در حال دریافت پاسخ‌های خودکار...</span>
      <div className="mx-auto w-full max-w-4xl">
        {includeCreateButton ? (
          <section className="mb-4 px-0 pt-1" aria-hidden="true">
            <div className="daira-skeleton-glass flex min-h-[54px] w-full animate-pulse flex-row-reverse items-center justify-center gap-2 rounded-full bg-[#2F61FD]/70 px-5 shadow-sm">
              <span className="daira-skeleton-glass h-5 w-5 rounded-full bg-white/35" />
              <span className="daira-skeleton-glass h-4 w-28 rounded-md bg-white/45" />
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] bg-transparent">
          <div className="mb-4 px-1" aria-hidden="true">
            <div className="daira-skeleton-glass flex h-11 animate-pulse items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5">
              <span className="daira-skeleton-glass h-[17px] w-[17px] shrink-0 rounded-full bg-[#E2E8F0]" />
              <span className="daira-skeleton-glass h-3 w-44 max-w-[70%] rounded-md bg-[#E8EDF5]" />
            </div>
          </div>

          <div className="space-y-2.5" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <article
                key={index}
                className="daira-skeleton-glass flex min-h-[84px] animate-pulse items-center justify-between gap-3 rounded-[22px] border border-[#E8EDF5] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-4"
              >
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                  <div className="daira-skeleton-glass h-[38px] w-44 max-w-full rounded-xl border border-[#DCE6FF] bg-[#EEF3FF] px-3 py-2" />
                  <div className="h-2.5 w-24 rounded-md bg-[#E8EDF5]" />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="inline-flex h-8 w-[66px] items-center justify-center rounded-[8px] border border-[#E8EDF5] bg-[#F8FAFC] sm:w-[74px]">
                    <span className="h-2.5 w-8 rounded bg-[#E2E8F0]" />
                  </div>
                  <div className="inline-flex h-8 w-[54px] items-center justify-center rounded-[8px] border border-[#F3D5D5] bg-[#FFF8F8] sm:w-[62px]">
                    <span className="h-2.5 w-6 rounded bg-[#F1DADA]" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
