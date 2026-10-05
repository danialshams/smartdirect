"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/dashboard/DashboardUI";
import PersianDatePicker from "./PersianDatePicker";
const EntryPointFlowBuilder = dynamic(
  () => import("@/components/dashboard/EntryPointFlowBuilder"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-32 items-center justify-center">
        <Loader2 size={22} className="animate-spin text-[#2563EB]" />
      </div>
    ),
  },
);

type Job = {
  id: string;
  type: "POST" | "CAROUSEL" | "REEL" | "STORY";
  status: string;
  caption: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  media: Array<{
    id: string;
    type: "IMAGE" | "VIDEO";
    publicUrl: string | null;
    fileName: string | null;
  }>;
  commentAutomationId: string | null;
  storyReplyAutomationId: string | null;
  instagramAccount: {
    id: string;
    igUsername: string | null;
  };
};

type AutomationMeta = {
  id: string;
  triggerType: "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD" | "DM";
  keyword: string | null;
  isActive: boolean;
};

const labels = {
  POST: "پست",
  CAROUSEL: "آلبوم",
  REEL: "ریلز",
  STORY: "استوری",
} as const;

function toPersianDigits(value: number | string) {
  return String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
}

function getTehranDateParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    date: `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`,
    hour: get("hour"),
    minute: get("minute"),
  };
}

function toTehranIso(date: string, hour: number, minute: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) -
      3.5 * 60 * 60 * 1000,
  ).toISOString();
}

function readCachedJob(id: string | undefined): Job | null {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("smartdirect:publishing-jobs");
    if (!raw) return null;
    const jobs = JSON.parse(raw);
    if (!Array.isArray(jobs)) return null;
    const cached = jobs.find((item) => item && typeof item === "object" && item.id === id);
    return cached && typeof cached.id === "string" ? (cached as Job) : null;
  } catch {
    return null;
  }
}

export default function PublishingJobEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [job, setJob] = useState<Job | null>(() => readCachedJob(id));
  const [automation, setAutomation] = useState<AutomationMeta | null>(null);
  const [loading, setLoading] = useState(() => readCachedJob(id) === null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAutomationConfirm, setShowDeleteAutomationConfirm] = useState(false);

  const [caption, setCaption] = useState("");
  const [originalCaption, setOriginalCaption] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [originalScheduledDate, setOriginalScheduledDate] = useState("");
  const [hour, setHour] = useState(0);
  const [originalHour, setOriginalHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [originalMinute, setOriginalMinute] = useState(0);

  const [automationKeyword, setAutomationKeyword] = useState("");
  const [automationActive, setAutomationActive] = useState(true);
  const [automationDirty, setAutomationDirty] = useState(false);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedMediaIds, setLoadedMediaIds] = useState<Set<string>>(
    () => new Set(),
  );

  const isPublished = job?.status === "PUBLISHED";
  const isScheduled = job?.status === "SCHEDULED";

  const contentDirty = useMemo(() => {
    if (!isScheduled) return false;
    return (
      caption !== originalCaption ||
      scheduledDate !== originalScheduledDate ||
      hour !== originalHour ||
      minute !== originalMinute
    );
  }, [
    caption,
    originalCaption,
    scheduledDate,
    originalScheduledDate,
    hour,
    originalHour,
    minute,
    originalMinute,
    isScheduled,
  ]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      setRefreshing(true);
      try {
        const response = await fetch(
          `/api/instagram/publishing/${encodeURIComponent(id)}`,
          { cache: "no-store", credentials: "include" },
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "دریافت محتوا ناموفق بود.");
        }

        if (cancelled) return;

        const data = result.data as Job;
        setJob(data);
        setLoadedMediaIds(new Set());
        const automationId =
          data.commentAutomationId ?? data.storyReplyAutomationId;
        setAutomationLoaded(!automationId);

        const nextCaption = data.caption ?? "";
        setCaption(nextCaption);
        setOriginalCaption(nextCaption);

        if (data.scheduledAt) {
          const parts = getTehranDateParts(data.scheduledAt);
          setScheduledDate(parts.date);
          setOriginalScheduledDate(parts.date);
          setHour(parts.hour);
          setOriginalHour(parts.hour);
          setMinute(parts.minute);
          setOriginalMinute(parts.minute);
        }

        // Render the detail page immediately after the fast Job query.
        // Published media enrichment and automation details load independently.
        setLoading(false);

        if (data.status === "PUBLISHED") {
          void (async () => {
            try {
              const mediaResponse = await fetch(
                `/api/instagram/publishing/${encodeURIComponent(id)}?includeMedia=true`,
                { cache: "no-store", credentials: "include" },
              );
              const mediaResult = await mediaResponse.json();

              if (
                mediaResponse.ok &&
                mediaResult.success &&
                !cancelled
              ) {
                setJob(mediaResult.data as Job);
              }
            } catch (mediaError) {
              console.warn("Failed to load published media:", mediaError);
            }
          })();
        }

        if (automationId) {
          setAutomationLoading(true);

          void (async () => {
            try {
              const automationResponse = await fetch(
                `/api/automations/${encodeURIComponent(automationId)}`,
                { cache: "no-store", credentials: "include" },
              );
              const automationResult = await automationResponse.json();

              if (
                automationResponse.ok &&
                automationResult.success &&
                !cancelled
              ) {
                const nextAutomation =
                  automationResult.data as AutomationMeta;

                setAutomation(nextAutomation);
                setAutomationKeyword(nextAutomation.keyword ?? "");
                setAutomationActive(nextAutomation.isActive);
                setAutomationDirty(false);
              }
            } catch (automationError) {
              console.warn("Failed to load automation:", automationError);
            } finally {
              if (!cancelled) {
                setAutomationLoading(false);
                setAutomationLoaded(true);
              }
            }
          })();
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "خطا در دریافت محتوا.",
          );
        }
      } finally {
        if (!cancelled) {
          setAutomationLoading(false);
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function saveContent() {
    if (!job || !isScheduled || !contentDirty) return;

    if (!scheduledDate) {
      toast.error("تاریخ انتشار را انتخاب کن.");
      return;
    }

    const scheduledAt = toTehranIso(scheduledDate, hour, minute);

    if (new Date(scheduledAt).getTime() <= Date.now()) {
      toast.error("زمان انتشار باید در آینده باشد.");
      return;
    }

    setContentSaving(true);

    try {
      const response = await fetch(
        `/api/instagram/publishing/${encodeURIComponent(job.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            caption: caption.trim() || null,
            scheduledAt,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "ویرایش محتوا ناموفق بود.",
        );
      }

      setJob(result.data);
      setOriginalCaption(caption);
      setOriginalScheduledDate(scheduledDate);
      setOriginalHour(hour);
      setOriginalMinute(minute);

      toast.success("محتوا با موفقیت ویرایش شد.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "ویرایش محتوا ناموفق بود.",
      );
    } finally {
      setContentSaving(false);
    }
  }

  async function deleteAutomation() {
    if (!automation) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/automations/${encodeURIComponent(automation.id)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "حذف Automation ناموفق بود.");
      }

      setAutomation(null);
      setAutomationDirty(false);
      setJob((current) =>
        current
          ? {
              ...current,
              commentAutomationId: null,
              storyReplyAutomationId: null,
            }
          : current,
      );

      toast.success("Automation با موفقیت حذف شد.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "حذف Automation ناموفق بود.",
      );
    } finally {
      setDeleting(false);
      setShowDeleteAutomationConfirm(false);
    }
  }

  async function cancelScheduled() {
    if (!job || !isScheduled) return;

    if (
      !window.confirm(
        "این محتوای زمان‌بندی‌شده لغو و فایل‌های آن حذف شود؟",
      )
    ) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/instagram/publishing/${encodeURIComponent(job.id)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "لغو محتوا ناموفق بود.",
        );
      }

      toast.success(
        result.message || "محتوای زمان‌بندی‌شده حذف شد.",
      );
      router.back();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "لغو محتوا ناموفق بود.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const automationId =
    job?.commentAutomationId ?? job?.storyReplyAutomationId;
  const triggerType =
    job?.type === "STORY"
      ? "STORY_REPLY_KEYWORD"
      : "COMMENT_KEYWORD";

  return (
    <>
    <div
      dir="rtl"
      className="min-h-full bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="mb-5 space-y-3">
          <div className="flex justify-start">
            <Button
              type="button"
              onClick={() => router.back()}
              className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"
            >
              <span>بازگشت</span>
              <ArrowRight size={15} strokeWidth={2} />
            </Button>
          </div>

          {job && (
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">
                  <Pencil size={15} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-bold text-[#0F172A] sm:text-base">
                      ویرایش {labels[job.type]}
                    </h1>
                    {refreshing && (
                      <Loader2
                        size={14}
                        className="animate-spin text-[#2563EB]"
                        aria-label="در حال به‌روزرسانی"
                      />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                    پاسخ خودکار {labels[job.type]} خود را ویرایش کنید.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        {!job ? (
          <section className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
            {loading ? (
              <Loader2 size={28} className="animate-spin text-[#2563EB]" />
            ) : (
              <span className="text-sm text-[#64748B]">محتوا پیدا نشد.</span>
            )}
          </section>
        ) : (
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          {job.media.length > 0 && (
            <div
              className={
                job.media.length > 1
                  ? "mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
                  : "mb-5 flex justify-center"
              }
            >
              {job.media.map((media) => (
                <div
                  key={media.id}
                  className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9]"
                >
                  {media.publicUrl ? (
                    <div className="relative">
                      {media.type === "IMAGE" ? (
                        <img
                          src={media.publicUrl}
                          alt={labels[job.type]}
                          onLoad={() =>
                            setLoadedMediaIds((current) => {
                              const next = new Set(current);
                              next.add(media.id);
                              return next;
                            })
                          }
                          className="aspect-[4/5] h-full w-full object-cover"
                        />
                      ) : (
                        <video
                          src={media.publicUrl}
                          controls
                          playsInline
                          onLoadedData={() =>
                            setLoadedMediaIds((current) => {
                              const next = new Set(current);
                              next.add(media.id);
                              return next;
                            })
                          }
                          className="aspect-[4/5] h-full w-full object-cover"
                        />
                      )}
                      {!loadedMediaIds.has(media.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#F8FAFC]">
                          <Loader2
                            size={20}
                            className="animate-spin text-[#2563EB]"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center">
                      <Loader2
                        size={20}
                        className="animate-spin text-[#2563EB]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isPublished ? (
            <div className="text-center">
              <p className="text-xs font-medium text-[#64748B]">
                {formatDate(job.publishedAt)}
              </p>
              {job.caption && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#334155]">
                  {job.caption}
                </p>
              )}
            </div>
          ) : (
            <>
              <label className="mb-2 block text-sm font-bold text-[#0F172A]">
                کپشن
              </label>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={2200}
                rows={6}
                className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
                style={{
                  fontSize: "16px",
                  WebkitTextSizeAdjust: "100%",
                }}
              />

              <div className="mt-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarClock
                    size={17}
                    className="text-[#2563EB]"
                  />
                  <span className="text-sm font-bold text-[#0F172A]">
                    زمان انتشار
                  </span>
                </div>

                <PersianDatePicker
                  value={
                    scheduledDate
                      ? (() => {
                          const [year, month, day] =
                            scheduledDate
                              .split("-")
                              .map(Number);
                          return {
                            year,
                            month,
                            day,
                          };
                        })()
                      : {
                          year: 1400,
                          month: 1,
                          day: 1,
                        }
                  }
                  onChange={(value) => {
                    setScheduledDate(
                      `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`,
                    );
                  }}
                />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#64748B]">
                    ساعت
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={hour}
                      onChange={(event) =>
                        setHour(
                          Math.max(
                            0,
                            Math.min(23, Number(event.target.value)),
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 !text-base font-semibold text-[#334155] outline-none focus:border-[#2563EB]"
                      style={{ fontSize: "16px" }}
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#64748B]">
                    دقیقه
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={minute}
                      onChange={(event) =>
                        setMinute(
                          Math.max(
                            0,
                            Math.min(59, Number(event.target.value)),
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 !text-base font-semibold text-[#334155] outline-none focus:border-[#2563EB]"
                      style={{ fontSize: "16px" }}
                    />
                  </label>
                </div>

                <Button
                  type="button"
                  disabled={!contentDirty || contentSaving || deleting}
                  onClick={() => void saveContent()}
                  className="mt-4 min-h-11 w-full rounded-xl !bg-[#2563EB] px-4 text-sm font-bold text-white hover:!bg-[#1D4ED8] disabled:cursor-not-allowed disabled:!bg-[#E2E8F0] disabled:!text-[#94A3B8]"
                >
                  {contentSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      در حال ذخیره...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Save size={17} />
                      ذخیره
                    </span>
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
        )}

        {job && automationId ? (
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {job.type === "STORY"
                  ? "پاسخ خودکار استوری"
                  : "پاسخ خودکار کامنت"}
              </h2>
            </div>

            {automationLoading || !automationLoaded ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2
                  size={22}
                  className="animate-spin text-[#2563EB]"
                />
              </div>
            ) : automation ? (
              <>
                <EntryPointFlowBuilder
                  accountId={job.instagramAccount.id}
                  automationId={automation.id}
                  triggerType={triggerType}
                  keyword={automationKeyword}
                  onKeywordChange={setAutomationKeyword}
                  isActive={automationActive}
                  onActiveChange={setAutomationActive}
                  dirty={automationDirty}
                  onDirtyChange={setAutomationDirty}
                  finalSaveLabel="ذخیره"
                  finalSaveLoadingLabel="در حال ذخیره..."
                  onAutomationReady={(automationId) => {
                    setAutomation((current) =>
                      current ? { ...current, id: automationId } : current,
                    );
                    setAutomationDirty(false);
                    toast.success("پاسخ خودکار با موفقیت ذخیره شد.");
                  }}
                />

                <div className="mt-5 border-t border-[#E2E8F0] pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={deleting || automationLoading}
                    className="min-h-11 w-full rounded-xl !border-[#CBD5E1] !bg-[#F8FAFC] px-4 text-sm font-bold !text-[#475569] hover:!bg-[#F1F5F9]"
                  >
                    انصراف
                  </Button>
                </div>

                <div className="mt-6 border-t border-[#F1F5F9] pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDeleteAutomationConfirm(true)}
                    disabled={deleting || automationLoading}
                    className="min-h-11 w-full rounded-xl !border-[#FECACA] !bg-[#FEF2F2] px-4 text-sm font-bold !text-[#DC2626] hover:!bg-[#FEE2E2]"
                  >
                    <span dir="rtl" className="inline-flex items-center justify-center gap-2">
                      {deleting ? "در حال حذف..." : `حذف پاسخ خودکار ${labels[job.type]}`}
                      <Trash2 size={17} className="shrink-0 !text-[#DC2626]" />
                    </span>
                  </Button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {isScheduled && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void cancelScheduled()}
            disabled={deleting || contentSaving}
            className="min-h-11 w-full rounded-xl border-[#FECACA] bg-[#FEF2F2] px-4 text-sm font-bold text-[#DC2626] hover:bg-[#FEE2E2]"
          >
            <Trash2 size={17} />
            {deleting ? "در حال حذف..." : "لغو و حذف محتوا"}
          </Button>
        )}
      </div>
    </div>
      {showDeleteAutomationConfirm && automation && job && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !deleting) {
              setShowDeleteAutomationConfirm(false);
            }
          }}
        >
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-automation-title"
            className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xl"
          >
            <h3 id="delete-automation-title" className="text-base font-bold text-[#0F172A]">
              مطمئنی می‌خوای این مورد رو پاک کنی؟
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              پاسخ خودکار «{labels[job.type]}» حذف می‌شود و دیگر برای این محتوا اجرا نخواهد شد.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteAutomationConfirm(false)}
                disabled={deleting}
                className="h-10 flex-1 rounded-xl border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void deleteAutomation()}
                disabled={deleting}
                className="h-10 flex-1 rounded-xl border-[#FECACA] bg-[#FEF2F2] text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                {deleting ? "در حال حذف..." : "بله، حذف شود"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
