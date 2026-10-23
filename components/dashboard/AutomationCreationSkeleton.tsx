import { dairaPalette } from "../../lib/design-system/palette";

type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";

function GuideSkeleton({ step, width }: { step: string; width: string }) {
  return (
    <div
      className="daira-skeleton-glass mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{
        background: dairaPalette.guide.background,
        borderColor: dairaPalette.guide.border,
      }}
      aria-hidden="true"
    >
      <span className="mt-1 h-[17px] w-[17px] shrink-0 rounded-full" style={{ background: dairaPalette.guide.border }} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: dairaPalette.guide.icon }}>
          {step}
        </span>
        <span className={"h-3 rounded-md " + width} style={{ background: dairaPalette.guide.border }} />
      </div>
    </div>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={"block rounded-md bg-[#E8EDF5] " + className} />;
}

export default function AutomationCreationSkeleton({
  triggerType = "COMMENT_KEYWORD",
}: {
  triggerType?: TriggerType;
}) {
  const isComment = triggerType === "COMMENT_KEYWORD";

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl py-2 sm:py-4" role="status" aria-label="در حال آماده‌سازی فرم پاسخ خودکار">
      <span className="sr-only">در حال آماده‌سازی فرم پاسخ خودکار...</span>
      <div className="animate-pulse">
        <section>
          <GuideSkeleton step="۱" width="w-44 max-w-[80%]" />
          <div className="daira-skeleton-glass rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: dairaPalette.background.surfaceActive }} />
                <div className="flex min-w-0 flex-col gap-2">
                  <SkeletonLine className="h-3 w-32" />
                  <SkeletonLine className="h-2.5 w-20" />
                </div>
              </div>
              <span className="daira-skeleton-glass h-11 w-28 rounded-xl border" style={{ background: dairaPalette.background.surfaceHover, borderColor: dairaPalette.form.border }} />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <GuideSkeleton step="۲" width="w-48 max-w-[80%]" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((item) => (
              <div key={item} className="daira-skeleton-glass flex min-h-[68px] items-start gap-2.5 rounded-xl border bg-white p-3" style={{ borderColor: dairaPalette.form.border }}>
                <span className="daira-skeleton-glass mt-1 h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: dairaPalette.form.border }} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <SkeletonLine className="h-3 w-28 max-w-full" />
                  <SkeletonLine className="h-2.5 w-20 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <GuideSkeleton step="۳" width="w-52 max-w-[85%]" />
          <div className="daira-skeleton-glass rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
            {isComment ? (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[0, 1].map((item) => (
                    <div key={item} className="daira-skeleton-glass flex min-h-[74px] items-start gap-3 rounded-xl border p-3" style={{ borderColor: dairaPalette.form.border, background: dairaPalette.background.surfaceHover }}>
                      <span className="daira-skeleton-glass mt-1 h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: dairaPalette.form.border }} />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <SkeletonLine className="h-3 w-28 max-w-full" />
                        <SkeletonLine className="h-2.5 w-full max-w-[90%]" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[0, 1, 2].map((item) => <span key={item} className="h-7 w-16 rounded-full" style={{ background: dairaPalette.secondary.hoverBackground }} />)}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <SkeletonLine className="h-3 w-36" />
                <SkeletonLine className="h-11 w-full rounded-xl" />
              </div>
            )}
            <SkeletonLine className="mt-4 h-11 w-full rounded-xl" />
          </div>
        </section>

        {isComment ? (
          <>
            <section className="mt-6">
              <GuideSkeleton step="۴" width="w-56 max-w-[85%]" />
              <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg" style={{ background: dairaPalette.secondary.hoverBackground }} />
                  <SkeletonLine className="h-3 w-28" />
                </div>
                <SkeletonLine className="h-28 w-full rounded-xl" />
              </div>
            </section>
            <section className="mt-6">
              <GuideSkeleton step="۵" width="w-48 max-w-[85%]" />
              <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[0, 1].map((item) => (
                    <div key={item} className="flex min-h-[68px] items-start gap-3 rounded-xl border p-3" style={{ borderColor: dairaPalette.form.border }}>
                      <span className="mt-1 h-4 w-4 rounded-full border-2" style={{ borderColor: dairaPalette.form.border }} />
                      <div className="flex flex-1 flex-col gap-2">
                        <SkeletonLine className="h-3 w-32" />
                        <SkeletonLine className="h-2.5 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
                <SkeletonLine className="h-28 w-full rounded-xl" />
              </div>
            </section>
            <section className="mt-6">
              <GuideSkeleton step="۶" width="w-52 max-w-[85%]" />
              <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
                <div className="flex min-h-12 items-center gap-3 rounded-xl border p-3" style={{ borderColor: dairaPalette.form.border, background: dairaPalette.background.surfaceHover }}>
                  <span className="h-5 w-9 rounded-full" style={{ background: dairaPalette.background.surfaceActive }} />
                  <SkeletonLine className="h-3 w-52 max-w-[80%]" />
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="mt-6">
            <GuideSkeleton step="۴" width="w-48 max-w-[85%]" />
            <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: dairaPalette.border }}>
              <SkeletonLine className="h-3 w-32" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <SkeletonLine key={item} className="h-20 rounded-xl" />
                ))}
              </div>
              <SkeletonLine className="h-28 w-full rounded-xl" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
