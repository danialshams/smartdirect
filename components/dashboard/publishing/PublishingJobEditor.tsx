"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/dashboard/DashboardUI";
import { PersianDatePicker } from "./PublishingDashboardV2";
import EntryPointFlowBuilder from "@/components/dashboard/EntryPointFlowBuilder";

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

export default function PublishingJobEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [job, setJob] = useState<Job | null>(null);
  const [automation, setAutomation] = useState<AutomationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      try {
        setLoading(true);

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

        const automationId =
          data.commentAutomationId ?? data.storyReplyAutomationId;

        if (automationId) {
          setAutomationLoading(true);

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

    if (
      !window.confirm(
        "این Automation حذف شود؟ پاسخ خودکار این محتوا دیگر اجرا نخواهد شد.",
      )
    ) {
      return;
    }

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
      router.push("/dashboard/publishing");
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

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[60vh] items-center justify-center"
      >
        <Loader2
          size={28}
          className="animate-spin text-[#2563EB]"
        />
      </div>
    );
  }

  if (!job) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[60vh] items-center justify-center text-sm text-[#64748B]"
      >
        محتوا پیدا نشد.
      </div>
    );
  }

  const automationId =
    job.commentAutomationId ?? job.storyReplyAutomationId;
  const triggerType =
    job.type === "STORY"
      ? "STORY_REPLY_KEYWORD"
      : "COMMENT_KEYWORD";

  return (
    <div
      dir="rtl"
      className="min-h-full bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="relative flex min-h-10 items-center justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/publishing")}
            className="absolute right-0 min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"
          >
            <ArrowRight size={15} strokeWidth={2} />
            بازگشت
          </Button>

          <h1 className="text-base font-bold text-[#0F172A] sm:text-lg">
            ویرایش {labels[job.type]}
          </h1>
        </div>

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
                    media.type === "IMAGE" ? (
                      <img
                        src={media.publicUrl}
                        alt={labels[job.type]}
                        className="aspect-[4/5] h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={media.publicUrl}
                        controls
                        playsInline
                        className="aspect-[4/5] h-full w-full object-cover"
                      />
                    )
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

        {automationId ? (
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#0F172A]">
                  {job.type === "STORY"
                    ? "پاسخ خودکار استوری"
                    : "پاسخ خودکار کامنت"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  کل پاسخ خودکار را می‌توانی مثل صفحه پیام شروع گفتگو ویرایش کنی.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => void deleteAutomation()}
                disabled={deleting || automationLoading}
                className="h-9 shrink-0 rounded-lg border-[#FECACA] bg-white px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2]"
                aria-label="حذف اتوماسیون"
              >
                <Trash2 size={14} className="text-[#DC2626]" />
                <span className="hidden sm:inline text-[#DC2626]">
                  حذف
                </span>
              </Button>
            </div>

            {automationLoading ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2
                  size={22}
                  className="animate-spin text-[#2563EB]"
                />
              </div>
            ) : automation ? (
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
                  toast.success("Automation با موفقیت ذخیره شد.");
                }}
              />
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-5 text-center text-xs font-medium text-[#64748B]">
            برای این محتوا Automation فعالی ثبت نشده است.
          </section>
        )}

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
  );
}
