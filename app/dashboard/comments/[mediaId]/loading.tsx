"use client";

export default function Loading() {
  return (
    <main dir="rtl" className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 h-4 w-16 animate-pulse rounded-full bg-muted" />

        <div className="grid gap-8 lg:grid-cols-[minmax(280px,400px)_1fr] lg:items-start">
          <section>
            <div className="aspect-square animate-pulse rounded-2xl bg-muted lg:rounded-xl" />
            <div className="mt-4 space-y-3">
              <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
            </div>
          </section>

          <section>
            <div className="space-y-2 border-b pb-5">
              <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded-full bg-muted" />
            </div>

            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="py-5">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                        <div className="h-2.5 w-16 animate-pulse rounded-full bg-muted" />
                      </div>
                      <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-muted" />
                      <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                      <div className="mt-4 h-9 w-full animate-pulse rounded-lg bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
