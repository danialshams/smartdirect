"use client";

import {
    CalendarClock,
    CheckCircle2,
    Clock3,
    ImagePlus,
    Loader2,
    RefreshCw,
    Send,
    Trash2,
    Video,
    XCircle,
} from "lucide-react";

import { useEffect, useState } from "react";

type PublishType = "POST" | "CAROUSEL" | "REEL";

type MediaItem = {
    type: "IMAGE" | "VIDEO";
    storageKey: string;
    publicUrl: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
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
    media: MediaItem[];
    instagramAccount?: {
        igUsername: string | null;
    };
};

type InstagramAccount = {
    id: string;
    igUsername: string | null;
    igUserId: string;
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

    const [media, setMedia] = useState<MediaItem[]>([]);

    const [scheduledAt, setScheduledAt] =
        useState("");

    const [loading, setLoading] = useState(true);

    const [publishing, setPublishing] =
        useState(false);

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
            result.data ??
            result.accounts ??
            [];

        setAccounts(list);

        if (list.length && !selectedAccount) {
            setSelectedAccount(list[0].id);
        }
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
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "خطا در دریافت اطلاعات.",
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function handleFiles(
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        const files = Array.from(
            event.target.files ?? [],
        );

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

        const maxFiles =
            type === "CAROUSEL" ? 10 : 1;

        const selected = accepted.slice(
            0,
            maxFiles,
        );

        const items: MediaItem[] = selected.map(
            (file, index) => ({
                type: file.type.startsWith("video/")
                    ? "VIDEO"
                    : "IMAGE",
                storageKey: `pending/${crypto.randomUUID()}-${file.name}`,
                publicUrl: URL.createObjectURL(file),
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size,
                sortOrder: index,
            }),
        );

        setMedia(items);
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

        if (!media.length) {
            setError("حداقل یک فایل انتخاب کنید.");
            return;
        }

        if (type === "CAROUSEL" && media.length < 2) {
            setError(
                "Carousel باید حداقل دو تصویر داشته باشد.",
            );
            return;
        }

        try {
            setPublishing(true);
            setError("");

            /*
             * این نسخه فعلاً برای تست UI از publicUrl استفاده می‌کند.
             *
             * URL.createObjectURL فقط داخل Browser معتبر است
             * و برای Meta قابل استفاده نیست.
             *
             * بنابراین تا زمانی که Storage عمومی وصل نشده،
             * انتشار واقعی فایل Browser نباید انجام شود.
             */

            const hasLocalBrowserUrl = media.some(
                (item) =>
                    item.publicUrl.startsWith(
                        "blob:",
                    ),
            );

            if (hasLocalBrowserUrl) {
                throw new Error(
                    "برای انتشار واقعی، فایل باید ابتدا در Storage عمومی ذخیره شود. URL موقت Browser برای Instagram قابل استفاده نیست.",
                );
            }

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
                        scheduledAt:
                            publishNow
                                ? null
                                : scheduledAt
                                    ? new Date(
                                        scheduledAt,
                                    ).toISOString()
                                    : null,
                        idempotencyKey:
                            crypto.randomUUID(),
                        media,
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
            setMedia([]);
            setScheduledAt("");

            await loadJobs();
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "خطا در Publishing.",
            );
        } finally {
            setPublishing(false);
        }
    }

    async function retryJob(id: string) {
        try {
            const response =
                await fetch(
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
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Retry ناموفق بود.",
            );
        }
    }

    async function cancelJob(id: string) {
        try {
            const response =
                await fetch(
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
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "لغو ناموفق بود.",
            );
        }
    }

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
                            مدیریت پست، Carousel و Reel
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                        <RefreshCw
                            size={16}
                        />
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
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-slate-950">
                                    محتوای جدید
                                </h2>

                                <p className="mt-1 text-xs text-slate-400">
                                    آماده‌سازی محتوا برای Instagram
                                </p>
                            </div>
                        </div>

                        <div className="mb-5 grid grid-cols-3 gap-2">
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
                                ([
                                    value,
                                    label,
                                    Icon,
                                ]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => {
                                            setType(
                                                value,
                                            );
                                            setMedia(
                                                [],
                                            );
                                        }}
                                        className={[
                                            "flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm transition",
                                            type ===
                                                value
                                                ? "border-slate-950 bg-slate-950 text-white"
                                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                                        ].join(
                                            " ",
                                        )}
                                    >
                                        <Icon
                                            size={
                                                20
                                            }
                                        />

                                        {
                                            label
                                        }
                                    </button>
                                ),
                            )}
                        </div>

                        <label className="mb-5 block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                                اکانت Instagram
                            </span>

                            <select
                                value={
                                    selectedAccount
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setSelectedAccount(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                            >
                                <option value="">
                                    انتخاب اکانت
                                </option>

                                {accounts.map(
                                    (
                                        account,
                                    ) => (
                                        <option
                                            key={
                                                account.id
                                            }
                                            value={
                                                account.id
                                            }
                                        >
                                            @
                                            {
                                                account.igUsername
                                            }
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>

                        <label className="mb-5 block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                                تصاویر / ویدیو
                            </span>

                            <input
                                type="file"
                                accept={
                                    type ===
                                        "REEL"
                                        ? "video/*"
                                        : "image/*"
                                }
                                multiple={
                                    type ===
                                    "CAROUSEL"
                                }
                                onChange={
                                    handleFiles
                                }
                                className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm"
                            />
                        </label>

                        {media.length > 0 && (
                            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {media.map(
                                    (
                                        item,
                                    ) => (
                                        <div
                                            key={
                                                item.storageKey
                                            }
                                            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                        >
                                            {item.type ===
                                                "IMAGE" ? (
                                                <img
                                                    src={
                                                        item.publicUrl
                                                    }
                                                    alt=""
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
                                        </div>
                                    ),
                                )}
                            </div>
                        )}

                        <label className="mb-5 block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                                کپشن
                            </span>

                            <textarea
                                value={
                                    caption
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setCaption(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                                rows={6}
                                maxLength={
                                    2200
                                }
                                placeholder="کپشن پست را بنویسید..."
                                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            />
                        </label>

                        <label className="mb-6 block">
                            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                                <CalendarClock
                                    size={
                                        16
                                    }
                                />
                                زمان انتشار
                            </span>

                            <input
                                type="datetime-local"
                                value={
                                    scheduledAt
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setScheduledAt(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            />
                        </label>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                disabled={
                                    publishing
                                }
                                onClick={() =>
                                    createJob(
                                        true,
                                    )
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {publishing ? (
                                    <Loader2
                                        size={
                                            17
                                        }
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Send
                                        size={
                                            17
                                        }
                                    />
                                )}

                                انتشار فوری
                            </button>

                            <button
                                type="button"
                                disabled={
                                    publishing ||
                                    !scheduledAt
                                }
                                onClick={() =>
                                    createJob(
                                        false,
                                    )
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Clock3
                                    size={
                                        17
                                    }
                                />

                                زمان‌بندی
                            </button>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5">
                            <h2 className="font-bold text-slate-950">
                                انتشارهای اخیر
                            </h2>

                            <p className="mt-1 text-xs text-slate-400">
                                وضعیت آخرین محتواها
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2
                                    size={
                                        24
                                    }
                                    className="animate-spin text-slate-400"
                                />
                            </div>
                        ) : jobs.length ===
                            0 ? (
                            <div className="py-12 text-center text-sm text-slate-400">
                                هنوز محتوایی ایجاد نشده است.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {jobs.map(
                                    (
                                        job,
                                    ) => (
                                        <div
                                            key={
                                                job.id
                                            }
                                            className="rounded-xl border border-slate-100 p-3"
                                        >
                                            <div className="flex gap-3">
                                                {job
                                                    .media
                                                    ?.[
                                                    0
                                                ]
                                                    ?.publicUrl ? (
                                                    <img
                                                        src={
                                                            job
                                                                .media[
                                                                0
                                                            ]
                                                                .publicUrl
                                                        }
                                                        alt=""
                                                        className="h-14 w-14 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
                                                        <ImagePlus
                                                            size={
                                                                18
                                                            }
                                                            className="text-slate-400"
                                                        />
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-semibold text-slate-800">
                                                            {
                                                                typeLabels[
                                                                job
                                                                    .type
                                                                ]
                                                            }
                                                        </span>

                                                        <Status
                                                            status={
                                                                job.status
                                                            }
                                                        />
                                                    </div>

                                                    <p className="mt-1 truncate text-xs text-slate-500">
                                                        {
                                                            job
                                                                .caption
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            {job.errorMessage && (
                                                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
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
                                                                retryJob(
                                                                    job.id,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs text-white"
                                                        >
                                                            <RefreshCw
                                                                size={
                                                                    13
                                                                }
                                                            />
                                                            Retry
                                                        </button>
                                                    )}

                                                {[
                                                    "DRAFT",
                                                    "SCHEDULED",
                                                ].includes(
                                                    job.status,
                                                ) && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                cancelJob(
                                                                    job.id,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500"
                                                        >
                                                            <Trash2
                                                                size={
                                                                    13
                                                                }
                                                            />
                                                            لغو
                                                        </button>
                                                    )}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

function Status({
    status,
}: {
    status: string;
}) {
    if (status === "PUBLISHED") {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                <CheckCircle2 size={13} />
                منتشر شده
            </span>
        );
    }

    if (status === "FAILED") {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-600">
                <XCircle size={13} />
                ناموفق
            </span>
        );
    }

    if (status === "SCHEDULED") {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                <Clock3 size={13} />
                زمان‌بندی
            </span>
        );
    }

    return (
        <span className="text-[11px] text-slate-400">
            {statusLabels[status] ?? status}
        </span>
    );
}