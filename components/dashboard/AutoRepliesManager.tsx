"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircleReply, Pencil } from "lucide-react";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY";

type Job = {
  id: string;
  type: PublishType;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  caption: string | null;
  media: Array<{
    type: "IMAGE" | "VIDEO";
    publicUrl: string | null;
  }>;
  commentAutomationId?: string | null;
  storyReplyAutomationId?: string | null;
};

const typeLabels: Record<PublishType, string> = {
  POST: "پست",
  CAROUSEL: "آلبوم",
  REEL: "ریلز",
  STORY: "استوری",
};

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
}

export default function AutoRepliesManager() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/instagram/publishing", {
          cache: "no-store",
          credentials: "include",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "دریافت محتوا ناموفق بود.");
        }

        if (!cancelled) {
          setJobs(
            (Array.isArray(result.data) ? result.data : []).filter(
              (job: Job) => job.status === "PUBLISHED",
            ),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "خطا در دریافت محتوا.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-full bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <MessageCircleReply size={19} />
            </span>
            <div>
              <h1 className="text-base font-bold text-[#0F172A]">مدیریت پاسخ‌های خودکار</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                پاسخ‌های خودکار محتواهای منتشرشده را از اینجا مشاهده و ویرایش کنید.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 size={24} className="animate-spin text-[#2563EB]" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium text-[#B91C1C]">
              {error}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-center text-xs font-medium text-[#94A3B8]">
              هنوز محتوای منتشرشده‌ای وجود ندارد.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0]">
              {jobs.map((job) => {
                const hasAutomation =
                  Boolean(job.commentAutomationId) || Boolean(job.storyReplyAutomationId);

                return (
                  <div key={job.id} className="flex items-center justify-between gap-3 px-3.5 py-3.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {job.media[0]?.publicUrl ? (
                        <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
                          {job.media[0].type === "IMAGE" ? (
                            <img
                              src={job.media[0].publicUrl}
                              alt={typeLabels[job.type]}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={job.media[0].publicUrl}
                              muted
                              playsInline
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      ) : null}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#0F172A]">
                            {typeLabels[job.type]}
                          </span>
                          <span className="text-[11px] font-medium text-[#64748B]">
                            {formatDate(job.publishedAt ?? job.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-[#64748B]">
                          {hasAutomation ? "پاسخ خودکار فعال است." : "بدون پاسخ خودکار"}
                        </p>
                      </div>
                    </div>

                    {hasAutomation ? (
                      <Link
                        href={`/dashboard/publishing/${job.id}`}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-white px-2.5 text-xs font-semibold text-[#2563EB] no-underline hover:bg-[#EFF6FF]"
                      >
                        <Pencil size={14} />
                        <span>ویرایش پاسخ</span>
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
