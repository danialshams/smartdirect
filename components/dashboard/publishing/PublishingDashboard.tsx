"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";

type PublishType = "POST" | "CAROUSEL" | "REEL";
type MediaType = "IMAGE" | "VIDEO";

type LocalMedia = {
  file: File;
  type: MediaType;
  previewUrl: string;
  sortOrder: number;
};

type UploadedMedia = {
  type: MediaType;
  storageKey: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
};

type Job = {
  id: string;
  type: PublishType;
  status: string;
  caption: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  media: UploadedMedia[];
  instagramAccount?: {
    igUsername: string | null;
  };
};

type InstagramAccount = {
  id: string;
  igUsername: string | null;
  igUserId: string;
};

type JalaliDate = {
  year: number;
  month: number;
  day: number;
};

const typeLabels: Record<PublishType, string> = {
  POST: "پست",
  CAROUSEL: "Carousel",
  REEL: "Reel",
};

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  UPLOADING: "در حال آماده‌سازی",
  PROCESSING: "در حال پردازش",
  PUBLISHING: "در حال انتشار",
  PUBLISHED: "منتشر شده",
  FAILED: "ناموفق",
  SCHEDULED: "زمان‌بندی شده",
  CANCELLED: "لغو شده",
};

const jalaliMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function toPersianDigits(value: number | string) {
  return String(value).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    })
    : "-";
}

function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): [number, number, number] {
  const jYear = jy + 1595;

  let days =
    -355668 +
    365 * jYear +
    Math.floor(jYear / 33) * 8 +
    Math.floor(((jYear % 33) + 3) / 4) +
    jd +
    (jm < 7
      ? (jm - 1) * 31
      : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);

  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;

    if (days >= 365) {
      days += 1;
    }
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const gd = days + 1;

  const monthDays = [
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
      ? 29
      : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  let remaining = gd;
  let gm = 1;

  while (remaining > monthDays[gm - 1]) {
    remaining -= monthDays[gm - 1];
    gm += 1;
  }

  return [gy, gm, remaining];
}

function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): JalaliDate {
  let jy = gy - 621;

  const candidate = jalaliToGregorian(jy, 1, 1);

  const inputUtc = Date.UTC(gy, gm - 1, gd);

  if (
    inputUtc <
    Date.UTC(candidate[0], candidate[1] - 1, candidate[2])
  ) {
    jy -= 1;
  }

  const start = jalaliToGregorian(jy, 1, 1);

  const diff = Math.floor(
    (inputUtc -
      Date.UTC(start[0], start[1] - 1, start[2])) /
    86400000,
  );

  return diff < 186
    ? {
      year: jy,
      month: Math.floor(diff / 31) + 1,
      day: (diff % 31) + 1,
    }
    : {
      year: jy,
      month: Math.floor((diff - 186) / 30) + 7,
      day: ((diff - 186) % 30) + 1,
    };
}

function isJalaliLeap(year: number) {
  const epBase = year - (year >= 0 ? 474 : 473);
  const epYear = 474 + (epBase % 2820);

  return ((epYear + 38) * 682) % 2816 < 682;
}

function jalaliMonthDays(year: number, month: number) {
  if (month <= 6) {
    return 31;
  }

  if (month <= 11) {
    return 30;
  }

  return isJalaliLeap(year) ? 30 : 29;
}

function currentJalaliDate(): JalaliDate {
  const now = new Date();

  return gregorianToJalali(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
}

function jalaliDateTimeToDate(
  date: JalaliDate,
  hour: number,
  minute: number,
) {
  const [gy, gm, gd] = jalaliToGregorian(
    date.year,
    date.month,
    date.day,
  );

  return new Date(
    gy,
    gm - 1,
    gd,
    hour,
    minute,
    0,
    0,
  );
}

function PersianDatePicker({
  value,
  onChange,
}: {
  value: JalaliDate;
  onChange: (value: JalaliDate) => void;
}) {
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<JalaliDate>({
    ...value,
    day: 1,
  });

  const first = jalaliToGregorian(
    view.year,
    view.month,
    1,
  );

  const firstWeekday =
    (new Date(
      first[0],
      first[1] - 1,
      first[2],
    ).getDay() +
      1) %
    7;

  const days = jalaliMonthDays(
    view.year,
    view.month,
  );

  function moveMonth(delta: number) {
    let year = view.year;
    let month = view.month + delta;

    if (month < 1) {
      month = 12;
      year -= 1;
    }

    if (month > 12) {
      month = 1;
      year += 1;
    }

    setView({
      year,
      month,
      day: 1,
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-right text-sm hover:border-slate-300"
      >
        <CalendarClock
          size={18}
          className="text-slate-500"
        />

        <span className="font-medium text-slate-800">
          {jalaliMonths[value.month - 1]}{" "}
          {toPersianDigits(value.day)}،{" "}
          {toPersianDigits(value.year)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-full min-w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight size={18} />
            </button>

            <div className="text-sm font-bold text-slate-900">
              {jalaliMonths[view.month - 1]}{" "}
              {toPersianDigits(view.year)}
            </div>

            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({
              length: firstWeekday,
            }).map((_, index) => (
              <span key={`empty-${index}`} />
            ))}

            {Array.from(
              { length: days },
              (_, index) => index + 1,
            ).map((day) => {
              const selected =
                value.year === view.year &&
                value.month === view.month &&
                value.day === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange({
                      year: view.year,
                      month: view.month,
                      day,
                    });

                    setOpen(false);
                  }}
                  className={[
                    "aspect-square rounded-lg text-sm",
                    selected
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function uploadFileWithProgress(
  file: File,
  onProgress: (value: number) => void,
) {
  return new Promise<UploadedMedia>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append("file", file);

      xhr.open(
        "POST",
        "/api/instagram/publishing/upload",
      );

      xhr.responseType = "json";

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(
            Math.min(
              100,
              Math.round(
                (event.loaded / event.total) * 100,
              ),
            ),
          );
        }
      };

      xhr.onerror = () => {
        reject(
          new Error(
            `آپلود ${file.name} ناموفق بود.`,
          ),
        );
      };

      xhr.onabort = () => {
        reject(
          new Error("آپلود لغو شد."),
        );
      };

      xhr.onload = () => {
        const result = xhr.response;

        if (
          xhr.status < 200 ||
          xhr.status >= 300 ||
          !result?.success
        ) {
          reject(
            new Error(
              result?.message ||
              `آپلود ${file.name} ناموفق بود.`,
            ),
          );

          return;
        }

        resolve({
          ...result.data,
          fileName: file.name,
        });
      };

      xhr.send(formData);
    },
  );
}

export default function PublishingDashboard() {
  const [accounts, setAccounts] = useState<
    InstagramAccount[]
  >([]);

  const [jobs, setJobs] = useState<Job[]>([]);

  const [selectedAccount, setSelectedAccount] =
    useState("");

  const [type, setType] =
    useState<PublishType>("POST");

  const [caption, setCaption] = useState("");

  const [media, setMedia] = useState<LocalMedia[]>(
    [],
  );

  const [uploadedMedia, setUploadedMedia] =
    useState<UploadedMedia[]>([]);

  const [scheduledDate, setScheduledDate] =
    useState<JalaliDate>(currentJalaliDate());

  const [hour, setHour] = useState(
    new Date().getHours(),
  );

  const [minute, setMinute] = useState(() => {
    const currentMinute = new Date().getMinutes();
    const rounded =
      Math.ceil(currentMinute / 5) * 5;

    return rounded >= 60 ? 0 : rounded;
  });

  const [uploading, setUploading] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [uploadIndex, setUploadIndex] =
    useState(0);

  const [publishing, setPublishing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  async function loadAccounts() {
    const response = await fetch(
      "/api/instagram/accounts",
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        "دریافت اکانت‌های Instagram ناموفق بود.",
      );
    }

    const result = await response.json();

    const list =
      result.data ?? result.accounts ?? [];

    setAccounts(list);

    setSelectedAccount(
      (current) =>
        current || list[0]?.id || "",
    );
  }

  async function loadJobs() {
    const response = await fetch(
      "/api/instagram/publishing",
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        "دریافت Publishing Jobs ناموفق بود.",
      );
    }

    const result = await response.json();

    setJobs(result.data ?? []);
  }

  async function load() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadAccounts(),
        loadJobs(),
      ]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "خطا در دریافت اطلاعات.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function revokeLocalMedia(
    items: LocalMedia[],
  ) {
    items.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }

  function clearLocalMedia() {
    revokeLocalMedia(media);
    setMedia([]);
  }

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    event.target.value = "";

    if (!files.length) {
      return;
    }

    const accepted =
      type === "REEL"
        ? files.filter((file) =>
          file.type.startsWith("video/"),
        )
        : files.filter((file) =>
          file.type.startsWith("image/"),
        );

    if (type !== "CAROUSEL") {
      clearLocalMedia();
      setUploadedMedia([]);
    }

    const remaining = Math.max(
      0,
      10 -
      media.length -
      uploadedMedia.length,
    );

    const selected =
      type === "CAROUSEL"
        ? accepted.slice(0, remaining)
        : accepted.slice(0, 1);

    const newItems: LocalMedia[] =
      selected.map((file, index) => {
        const mediaType: MediaType =
          file.type.startsWith("video/")
            ? "VIDEO"
            : "IMAGE";

        return {
          file,
          type: mediaType,
          previewUrl:
            URL.createObjectURL(file),
          sortOrder:
            uploadedMedia.length +
            media.length +
            index,
        };
      });

    setMedia((current) => [
      ...current,
      ...newItems,
    ]);
  }

  function removeLocal(index: number) {
    const item = media[index];

    if (item) {
      URL.revokeObjectURL(
        item.previewUrl,
      );
    }

    setMedia((current) =>
      current
        .filter(
          (_, itemIndex) =>
            itemIndex !== index,
        )
        .map((item, itemIndex) => ({
          ...item,
          sortOrder:
            itemIndex +
            uploadedMedia.length,
        })),
    );
  }

  async function removeUploaded(
    item: UploadedMedia,
  ) {
    try {
      setError("");

      const response = await fetch(
        "/api/instagram/publishing/upload",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            storageKey:
              item.storageKey,
          }),
        },
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
          "حذف فایل ناموفق بود.",
        );
      }

      setUploadedMedia((current) =>
        current
          .filter(
            (mediaItem) =>
              mediaItem.storageKey !==
              item.storageKey,
          )
          .map((mediaItem, index) => ({
            ...mediaItem,
            sortOrder: index,
          })),
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "حذف فایل ناموفق بود.",
      );
    }
  }

  async function uploadSelectedMedia() {
    if (!selectedAccount) {
      setError(
        "ابتدا یک اکانت Instagram انتخاب کنید.",
      );
      return;
    }

    if (!media.length) {
      setError(
        "ابتدا فایل را انتخاب کنید.",
      );
      return;
    }

    if (
      type === "CAROUSEL" &&
      media.length +
      uploadedMedia.length <
      2
    ) {
      setError(
        "Carousel باید حداقل دو تصویر داشته باشد.",
      );
      return;
    }

    try {
      setUploading(true);
      setError("");
      setUploadProgress(0);

      const totalBytes = media.reduce(
        (sum, item) =>
          sum + item.file.size,
        0,
      );

      let completedBytes = 0;

      const results: UploadedMedia[] =
        [];

      for (
        let index = 0;
        index < media.length;
        index += 1
      ) {
        const item = media[index];

        setUploadIndex(index + 1);

        const result =
          await uploadFileWithProgress(
            item.file,
            (fileProgress) => {
              const currentBytes =
                completedBytes +
                (item.file.size *
                  fileProgress) /
                100;

              setUploadProgress(
                totalBytes
                  ? Math.min(
                    100,
                    Math.round(
                      (currentBytes /
                        totalBytes) *
                      100,
                    ),
                  )
                  : fileProgress,
              );
            },
          );

        results.push({
          ...result,
          sortOrder:
            uploadedMedia.length +
            results.length,
        });

        completedBytes +=
          item.file.size;
      }

      revokeLocalMedia(media);

      setMedia([]);

      setUploadedMedia((current) => [
        ...current,
        ...results,
      ].map((item, index) => ({
        ...item,
        sortOrder: index,
      })));

      setUploadProgress(100);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "آپلود فایل ناموفق بود.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function createJob(
    publishNow: boolean,
  ) {
    if (!selectedAccount) {
      setError(
        "ابتدا یک اکانت Instagram انتخاب کنید.",
      );
      return;
    }

    if (!uploadedMedia.length) {
      setError(
        "ابتدا فایل را آپلود کنید.",
      );
      return;
    }

    if (
      type === "CAROUSEL" &&
      uploadedMedia.length < 2
    ) {
      setError(
        "Carousel باید حداقل دو تصویر داشته باشد.",
      );
      return;
    }

    const scheduled =
      jalaliDateTimeToDate(
        scheduledDate,
        hour,
        minute,
      );

    if (
      !publishNow &&
      scheduled.getTime() <= Date.now()
    ) {
      setError(
        "زمان‌بندی باید در آینده باشد.",
      );
      return;
    }

    try {
      setPublishing(true);
      setError("");

      const response = await fetch(
        "/api/instagram/publishing",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            instagramAccountId:
              selectedAccount,
            type,
            caption:
              caption.trim() || null,
            scheduledAt: publishNow
              ? null
              : scheduled.toISOString(),
            idempotencyKey:
              crypto.randomUUID(),
            media: uploadedMedia,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          "ساخت Publishing Job ناموفق بود.",
        );
      }

      const job: Job = result.data;

      if (publishNow) {
        const publishResponse =
          await fetch(
            `/api/instagram/publishing/${job.id}/publish`,
            {
              method: "POST",
            },
          );

        const publishResult =
          await publishResponse.json();

        if (!publishResponse.ok) {
          throw new Error(
            publishResult.message ||
            "انتشار ناموفق بود.",
          );
        }
      }

      setCaption("");
      setUploadedMedia([]);
      setUploadProgress(0);
      setScheduledDate(
        currentJalaliDate(),
      );

      await loadJobs();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "خطا در Publishing.",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function retryJob(id: string) {
    try {
      setError("");

      const response = await fetch(
        `/api/instagram/publishing/${id}/retry`,
        {
          method: "POST",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          "Retry ناموفق بود.",
        );
      }

      await loadJobs();
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Retry ناموفق بود.",
      );
    }
  }

  async function cancelJob(id: string) {
    try {
      setError("");

      const response = await fetch(
        `/api/instagram/publishing/${id}`,
        {
          method: "DELETE",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          "لغو ناموفق بود.",
        );
      }

      await loadJobs();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "لغو ناموفق بود.",
      );
    }
  }

  const canPublish =
    uploadedMedia.length > 0 &&
    !uploading &&
    !publishing;

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              انتشار محتوا
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              انتشار واقعی پست، Carousel و
              Reel در Instagram
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            بروزرسانی
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">
              محتوای جدید
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              ابتدا فایل را آپلود کنید؛ بعد از
              تکمیل آپلود، تنظیم زمان انتشار
              فعال می‌شود.
            </p>

            <div className="my-6 grid grid-cols-3 gap-2">
              {(
                [
                  [
                    "POST",
                    "پست",
                    ImagePlus,
                  ],
                  [
                    "CAROUSEL",
                    "Carousel",
                    ImagePlus,
                  ],
                  [
                    "REEL",
                    "Reel",
                    Video,
                  ],
                ] as const
              ).map(
                ([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      clearLocalMedia();
                      setUploadedMedia([]);
                      setType(value);
                      setUploadProgress(0);
                    }}
                    className={[
                      "flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm transition",
                      type === value
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ),
              )}
            </div>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                اکانت Instagram
              </span>

              <select
                value={selectedAccount}
                onChange={(event) =>
                  setSelectedAccount(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              >
                <option value="">
                  انتخاب اکانت
                </option>

                {accounts.map(
                  (account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      @{account.igUsername}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="mb-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <label className="block cursor-pointer">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  {type === "CAROUSEL"
                    ? "تصاویر Carousel"
                    : type === "REEL"
                      ? "ویدیوی Reel"
                      : "تصویر پست"}
                </span>

                <input
                  type="file"
                  accept={
                    type === "REEL"
                      ? "video/mp4,video/quicktime"
                      : "image/jpeg,image/png,image/webp"
                  }
                  multiple={
                    type === "CAROUSEL"
                  }
                  onChange={handleFiles}
                  disabled={
                    uploading ||
                    publishing ||
                    (type ===
                      "CAROUSEL" &&
                      uploadedMedia.length >=
                      10)
                  }
                  className="block w-full cursor-pointer text-sm"
                />
              </label>

              <p className="mt-2 text-xs text-slate-400">
                {type === "CAROUSEL"
                  ? `حداکثر ۱۰ تصویر — ${toPersianDigits(
                    uploadedMedia.length +
                    media.length,
                  )} فایل انتخاب/آپلود شده`
                  : "فایل پس از انتخاب هنوز به Storage ارسال نشده است."}
              </p>
            </div>

            {(media.length > 0 ||
              uploadedMedia.length >
              0) && (
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {uploadedMedia.map(
                    (item) => (
                      <div
                        key={
                          item.storageKey
                        }
                        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        {item.type ===
                          "IMAGE" ? (
                          <img
                            src={item.publicUrl}
                            alt={
                              item.fileName
                            }
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <video
                            src={
                              item.publicUrl
                            }
                            controls
                            className="aspect-square w-full object-cover"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void removeUploaded(
                              item,
                            )
                          }
                          disabled={
                            uploading ||
                            publishing
                          }
                          className="absolute left-2 top-2 rounded-full bg-white/95 p-1.5 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                          aria-label="حذف فایل"
                        >
                          <X size={15} />
                        </button>

                        <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
                          <span className="truncate text-slate-600">
                            {item.fileName}
                          </span>

                          <CheckCircle2
                            size={14}
                            className="shrink-0 text-emerald-600"
                          />
                        </div>
                      </div>
                    ),
                  )}

                  {media.map(
                    (item, index) => (
                      <div
                        key={`${item.file.name}-${item.sortOrder}`}
                        className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50"
                      >
                        {item.type ===
                          "IMAGE" ? (
                          <img
                            src={
                              item.previewUrl
                            }
                            alt={
                              item.file.name
                            }
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <video
                            src={
                              item.previewUrl
                            }
                            controls
                            className="aspect-square w-full object-cover"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            removeLocal(
                              index,
                            )
                          }
                          disabled={
                            uploading ||
                            publishing
                          }
                          className="absolute left-2 top-2 rounded-full bg-white/95 p-1.5 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                          aria-label="حذف فایل انتخاب‌شده"
                        >
                          <X size={15} />
                        </button>

                        <div className="truncate px-2 py-2 text-xs text-slate-500">
                          در انتظار آپلود
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

            {uploading && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    در حال آپلود محتوا
                  </span>

                  <span className="font-bold text-slate-950">
                    {toPersianDigits(
                      uploadProgress,
                    )}
                    ٪
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-950 transition-all duration-200"
                    style={{
                      width: `${uploadProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  فایل{" "}
                  {toPersianDigits(
                    uploadIndex,
                  )}{" "}
                  از{" "}
                  {toPersianDigits(
                    media.length,
                  )}
                </p>
              </div>
            )}

            {!uploading &&
              uploadedMedia.length >
              0 && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 size={19} />

                  <span>
                    آپلود محتوا با موفقیت
                    کامل شد. حالا می‌توانید
                    زمان انتشار را تنظیم
                    کنید.
                  </span>
                </div>
              )}

            {media.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  void uploadSelectedMedia()
                }
                disabled={
                  uploading ||
                  publishing ||
                  loading
                }
                className="mb-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={17} />
                )}

                آپلود محتوا
              </button>
            )}

            {uploadedMedia.length >
              0 && (
                <>
                  <label className="mb-5 block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Caption
                    </span>

                    <textarea
                      value={caption}
                      onChange={(event) =>
                        setCaption(
                          event.target
                            .value,
                        )
                      }
                      maxLength={2200}
                      rows={5}
                      placeholder="متن کپشن..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />

                    <span className="mt-1 block text-left text-xs text-slate-400">
                      {caption.length}/2200
                    </span>
                  </label>

                  <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-medium text-slate-700">
                          زمان‌بندی انتشار
                        </span>

                        <span className="mt-1 block text-xs text-slate-400">
                          تقویم کاملاً شمسی
                        </span>
                      </div>

                      <CalendarClock
                        size={18}
                        className="text-slate-500"
                      />
                    </div>

                    <PersianDatePicker
                      value={
                        scheduledDate
                      }
                      onChange={
                        setScheduledDate
                      }
                    />

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label>
                        <span className="mb-1 block text-xs text-slate-500">
                          ساعت
                        </span>

                        <select
                          value={hour}
                          onChange={(
                            event,
                          ) =>
                            setHour(
                              Number(
                                event.target
                                  .value,
                              ),
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                        >
                          {Array.from(
                            {
                              length: 24,
                            },
                            (_, value) => (
                              <option
                                key={value}
                                value={value}
                              >
                                {toPersianDigits(
                                  String(
                                    value,
                                  ).padStart(
                                    2,
                                    "0",
                                  ),
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        <span className="mb-1 block text-xs text-slate-500">
                          دقیقه
                        </span>

                        <select
                          value={minute}
                          onChange={(
                            event,
                          ) =>
                            setMinute(
                              Number(
                                event.target
                                  .value,
                              ),
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                        >
                          {Array.from(
                            {
                              length: 12,
                            },
                            (_, value) =>
                              value * 5,
                          ).map(
                            (value) => (
                              <option
                                key={value}
                                value={value}
                              >
                                {toPersianDigits(
                                  String(
                                    value,
                                  ).padStart(
                                    2,
                                    "0",
                                  ),
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={
                        !canPublish ||
                        loading
                      }
                      onClick={() =>
                        void createJob(
                          true,
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {publishing ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <Send size={17} />
                      )}

                      انتشار الآن
                    </button>

                    <button
                      type="button"
                      disabled={
                        !canPublish ||
                        loading
                      }
                      onClick={() =>
                        void createJob(
                          false,
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CalendarClock
                        size={17}
                      />

                      زمان‌بندی انتشار
                    </button>
                  </div>
                </>
              )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-950">
                  تاریخچه انتشار
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  آخرین ۱۰۰ Job
                </p>
              </div>

              <Clock3
                size={18}
                className="text-slate-500"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2
                  className="animate-spin"
                  size={22}
                />
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                هنوز محتوایی ثبت نشده
                است.
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start gap-3">
                      {job.media[0] ? (
                        job.media[0].type ===
                          "IMAGE" ? (
                          <img
                            src={
                              job.media[0]
                                .publicUrl
                            }
                            alt={
                              job.media[0]
                                .fileName ||
                              ""
                            }
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <video
                            src={
                              job.media[0]
                                .publicUrl
                            }
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        )
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-800">
                            {
                              typeLabels[
                              job.type
                              ]
                            }
                          </span>

                          <span className="text-xs text-slate-500">
                            {statusLabels[
                              job.status
                            ] ||
                              job.status}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          @
                          {job
                            .instagramAccount
                            ?.igUsername ||
                            "Instagram"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {job.status ===
                            "PUBLISHED"
                            ? formatDate(
                              job.publishedAt,
                            )
                            : formatDate(
                              job.scheduledAt,
                            )}
                        </p>
                      </div>
                    </div>

                    {job.errorMessage && (
                      <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {
                          job.errorMessage
                        }
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      {job.status ===
                        "FAILED" && (
                          <button
                            type="button"
                            onClick={() =>
                              void retryJob(
                                job.id,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <RefreshCw
                              size={13}
                            />
                            تلاش مجدد
                          </button>
                        )}

                      {job.status !==
                        "PUBLISHED" &&
                        job.status !==
                        "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() =>
                              void cancelJob(
                                job.id,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2
                              size={13}
                            />
                            لغو
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}