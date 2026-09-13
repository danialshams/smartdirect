"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Range = 7 | 30 | 90;

type Account = {
    id: string;
    igUserId: string;
    username: string;
};

type Summary = {
    reach: number;
    views: number;
    accountsEngaged: number;
    totalInteractions: number;
    profileViews: number;
    followerCount: number;
    followerGrowth: number;
    engagementRate: number | null;
};

type Snapshot = {
    id: string;
    snapshotDate: string;
    reach: number | null;
    views: number | null;
    accountsEngaged: number | null;
    totalInteractions: number | null;
    profileViews: number | null;
    followerCount: number | null;
};

type HistoryResponse = {
    success: boolean;
    account: Account;
    period: {
        days: number;
        from: string;
        to: string;
    };
    summary: Summary;
    latest: Snapshot | null;
    snapshots: Snapshot[];
    error?: string;
};

type ChartMetric = "reach" | "views" | "interactions";

function formatNumber(value: number | null | undefined) {
    if (value === null || value === undefined) {
        return "—";
    }

    return new Intl.NumberFormat("fa-IR").format(value);
}

function formatPercent(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "—";
    }

    return `${new Intl.NumberFormat("fa-IR", {
        maximumFractionDigits: 2,
    }).format(value)}٪`;
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("fa-IR", {
        month: "short",
        day: "numeric",
    }).format(new Date(value));
}

function getMetricValue(snapshot: Snapshot, metric: ChartMetric) {
    if (metric === "reach") return snapshot.reach ?? 0;
    if (metric === "views") return snapshot.views ?? 0;
    return snapshot.totalInteractions ?? 0;
}

function getChartLabel(metric: ChartMetric) {
    if (metric === "reach") return "دسترسی";
    if (metric === "views") return "بازدید";
    return "تعاملات";
}

function StatCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper?: string;
}) {
    return (
        <div className="border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="text-sm text-zinc-500">{label}</div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                {value}
            </div>
            {helper ? (
                <div className="mt-2 text-xs text-zinc-400">{helper}</div>
            ) : null}
        </div>
    );
}

function Chart({
    snapshots,
    metric,
}: {
    snapshots: Snapshot[];
    metric: ChartMetric;
}) {
    const width = 900;
    const height = 300;
    const paddingX = 18;
    const paddingY = 24;

    const points = useMemo(() => {
        if (snapshots.length === 0) return [];

        const values = snapshots.map((snapshot) =>
            getMetricValue(snapshot, metric),
        );
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = Math.max(max - min, 1);

        return snapshots.map((snapshot, index) => {
            const x =
                snapshots.length === 1
                    ? width / 2
                    : paddingX +
                      (index / (snapshots.length - 1)) *
                          (width - paddingX * 2);

            const value = getMetricValue(snapshot, metric);
            const y =
                height -
                paddingY -
                ((value - min) / range) *
                    (height - paddingY * 2);

            return {
                x,
                y,
                value,
                date: snapshot.snapshotDate,
            };
        });
    }, [metric, snapshots]);

    if (snapshots.length === 0) {
        return (
            <div className="flex h-[300px] items-center justify-center border border-dashed border-zinc-200 text-sm text-zinc-400">
                هنوز داده تاریخی برای این بازه وجود ندارد.
            </div>
        );
    }

    const line = points
        .map((point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(" ");

    const area = `${line} L ${points[points.length - 1].x.toFixed(2)} ${
        height - paddingY
    } L ${points[0].x.toFixed(2)} ${height - paddingY} Z`;

    const labelIndexes = Array.from(
        new Set([
            0,
            Math.floor((points.length - 1) / 2),
            points.length - 1,
        ]),
    );

    return (
        <div className="overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                    {getChartLabel(metric)}
                </span>
                <span className="text-xs text-zinc-400">
                    {formatNumber(points[points.length - 1].value)} آخرین مقدار
                </span>
            </div>

            <div className="overflow-x-auto">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-[300px] min-w-[680px] w-full"
                    role="img"
                    aria-label={`نمودار ${getChartLabel(metric)}`}
                >
                    {[0.25, 0.5, 0.75].map((ratio) => (
                        <line
                            key={ratio}
                            x1={paddingX}
                            x2={width - paddingX}
                            y1={height * ratio}
                            y2={height * ratio}
                            stroke="currentColor"
                            className="text-zinc-100"
                            strokeWidth="1"
                        />
                    ))}

                    <path
                        d={area}
                        fill="currentColor"
                        className="text-zinc-100"
                    />

                    <path
                        d={line}
                        fill="none"
                        stroke="currentColor"
                        className="text-zinc-900"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />

                    {points.map((point) => (
                        <circle
                            key={`${point.date}-${point.value}`}
                            cx={point.x}
                            cy={point.y}
                            r="3.5"
                            fill="currentColor"
                            className="text-zinc-900"
                        />
                    ))}

                    {labelIndexes.map((index) => {
                        const point = points[index];
                        return (
                            <text
                                key={`label-${point.date}`}
                                x={point.x}
                                y={height - 4}
                                textAnchor={
                                    index === 0
                                        ? "start"
                                        : index === points.length - 1
                                          ? "end"
                                          : "middle"
                                }
                                className="fill-zinc-400 text-[12px]"
                            >
                                {formatDate(point.date)}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

export default function InsightsDashboard() {
    const [range, setRange] = useState<Range>(7);
    const [metric, setMetric] = useState<ChartMetric>("reach");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState<HistoryResponse | null>(null);

    const load = useCallback(async (days: Range) => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `/api/instagram/insights/history?days=${days}`,
                {
                    cache: "no-store",
                },
            );

            const result = (await response.json()) as HistoryResponse;

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "خطا در دریافت آمار Instagram",
                );
            }

            setData(result);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "خطا در دریافت آمار Instagram",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(range);
    }, [load, range]);

    const latest = data?.latest;
    const summary = data?.summary;

    return (
        <main dir="rtl" className="min-h-screen bg-zinc-50/40 px-4 py-5 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
                <header className="flex flex-col gap-5 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                            Instagram Insights
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                            تحلیل عملکرد پیج
                        </h1>
                        {data?.account ? (
                            <p className="mt-2 text-sm text-zinc-500">
                                @{data.account.username}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex w-full gap-1 border border-zinc-200 bg-white p-1 sm:w-auto">
                        {[7, 30, 90].map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => setRange(days as Range)}
                                className={`min-w-16 px-4 py-2 text-sm transition-colors ${
                                    range === days
                                        ? "bg-zinc-950 text-white"
                                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                                }`}
                            >
                                {days} روز
                            </button>
                        ))}
                    </div>
                </header>

                {error ? (
                    <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {loading && !data ? (
                    <div className="border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
                        در حال دریافت آمار...
                    </div>
                ) : null}

                {data && summary ? (
                    <>
                        <section className="grid grid-cols-1 gap-px overflow-hidden border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            <StatCard
                                label="دسترسی"
                                value={formatNumber(summary.reach)}
                                helper={`${range} روز اخیر`}
                            />
                            <StatCard
                                label="بازدید"
                                value={formatNumber(summary.views)}
                                helper={`${range} روز اخیر`}
                            />
                            <StatCard
                                label="اکانت‌های درگیر"
                                value={formatNumber(summary.accountsEngaged)}
                                helper={`${range} روز اخیر`}
                            />
                            <StatCard
                                label="تعاملات"
                                value={formatNumber(summary.totalInteractions)}
                                helper={`${range} روز اخیر`}
                            />
                            <StatCard
                                label="بازدید پروفایل"
                                value={formatNumber(summary.profileViews)}
                                helper={`${range} روز اخیر`}
                            />
                            <StatCard
                                label="دنبال‌کنندگان"
                                value={formatNumber(summary.followerCount)}
                                helper={
                                    summary.followerGrowth === 0
                                        ? "بدون تغییر در بازه"
                                        : `${summary.followerGrowth > 0 ? "+" : ""}${formatNumber(summary.followerGrowth)} در بازه`
                                }
                            />
                        </section>

                        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                            <div className="border border-zinc-200 bg-white p-5 sm:p-6">
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-zinc-950">
                                            روند عملکرد
                                        </h2>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            داده‌های روزانه ذخیره‌شده در SmartDirect
                                        </p>
                                    </div>

                                    <div className="flex w-full gap-1 border border-zinc-200 p-1 sm:w-auto">
                                        {([
                                            ["reach", "دسترسی"],
                                            ["views", "بازدید"],
                                            ["interactions", "تعاملات"],
                                        ] as const).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setMetric(value)}
                                                className={`px-3 py-2 text-xs transition-colors sm:text-sm ${
                                                    metric === value
                                                        ? "bg-zinc-950 text-white"
                                                        : "text-zinc-500 hover:bg-zinc-50"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Chart
                                    snapshots={data.snapshots}
                                    metric={metric}
                                />
                            </div>

                            <aside className="border border-zinc-200 bg-white p-5 sm:p-6">
                                <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                                    وضعیت فعلی
                                </div>
                                <h2 className="mt-2 text-lg font-semibold text-zinc-950">
                                    خلاصه عملکرد
                                </h2>

                                <div className="mt-6 space-y-5">
                                    <div>
                                        <div className="text-sm text-zinc-500">
                                            نرخ تعامل
                                        </div>
                                        <div className="mt-1 text-2xl font-semibold text-zinc-950">
                                            {formatPercent(summary.engagementRate)}
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-100 pt-5">
                                        <div className="text-sm text-zinc-500">
                                            آخرین دسترسی
                                        </div>
                                        <div className="mt-1 text-xl font-semibold text-zinc-950">
                                            {formatNumber(latest?.reach)}
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-100 pt-5">
                                        <div className="text-sm text-zinc-500">
                                            آخرین تعاملات
                                        </div>
                                        <div className="mt-1 text-xl font-semibold text-zinc-950">
                                            {formatNumber(latest?.totalInteractions)}
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-100 pt-5">
                                        <div className="text-sm text-zinc-500">
                                            آخرین Snapshot
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-zinc-900">
                                            {latest
                                                ? new Intl.DateTimeFormat("fa-IR", {
                                                      dateStyle: "medium",
                                                  }).format(new Date(latest.snapshotDate))
                                                : "—"}
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </section>

                        <section className="border border-zinc-200 bg-white p-5 sm:p-6">
                            <div className="mb-5 flex items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-950">
                                        تاریخچه روزانه
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {data.snapshots.length} Snapshot در این بازه ذخیره شده است.
                                    </p>
                                </div>
                            </div>

                            {data.snapshots.length === 0 ? (
                                <div className="border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
                                    هنوز داده تاریخی برای این بازه وجود ندارد.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-right text-sm">
                                        <thead>
                                            <tr className="border-b border-zinc-200 text-zinc-500">
                                                <th className="px-4 py-3 font-medium">تاریخ</th>
                                                <th className="px-4 py-3 font-medium">دسترسی</th>
                                                <th className="px-4 py-3 font-medium">بازدید</th>
                                                <th className="px-4 py-3 font-medium">اکانت‌های درگیر</th>
                                                <th className="px-4 py-3 font-medium">تعاملات</th>
                                                <th className="px-4 py-3 font-medium">دنبال‌کنندگان</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...data.snapshots].reverse().map((snapshot) => (
                                                <tr
                                                    key={snapshot.id}
                                                    className="border-b border-zinc-100 last:border-b-0"
                                                >
                                                    <td className="px-4 py-4 text-zinc-700">
                                                        {new Intl.DateTimeFormat("fa-IR", {
                                                            dateStyle: "medium",
                                                        }).format(new Date(snapshot.snapshotDate))}
                                                    </td>
                                                    <td className="px-4 py-4 font-medium text-zinc-950">
                                                        {formatNumber(snapshot.reach)}
                                                    </td>
                                                    <td className="px-4 py-4 text-zinc-700">
                                                        {formatNumber(snapshot.views)}
                                                    </td>
                                                    <td className="px-4 py-4 text-zinc-700">
                                                        {formatNumber(snapshot.accountsEngaged)}
                                                    </td>
                                                    <td className="px-4 py-4 text-zinc-700">
                                                        {formatNumber(snapshot.totalInteractions)}
                                                    </td>
                                                    <td className="px-4 py-4 text-zinc-700">
                                                        {formatNumber(snapshot.followerCount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                ) : null}
            </div>
        </main>
    );
}
