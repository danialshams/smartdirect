"use client";

import {
    BarChart3,
    Download,
    RefreshCw,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type Account = {
    id: string;
    igUserId: string;
    username: string;
    isConnected: boolean;
};

type AnalyticsResponse = {
    success: boolean;
    account: Account;
    snapshots: Snapshot[];
    error?: string;
};

type MetricKey =
    | "reach"
    | "views"
    | "accountsEngaged"
    | "totalInteractions"
    | "profileViews";

type Metric = {
    key: MetricKey;
    title: string;
};

const METRICS: Metric[] = [
    { key: "reach", title: "دسترسی" },
    { key: "views", title: "بازدید" },
    { key: "accountsEngaged", title: "اکانت‌های درگیر" },
    { key: "totalInteractions", title: "تعاملات" },
    { key: "profileViews", title: "بازدید پروفایل" },
];

const nf = new Intl.NumberFormat("fa-IR");
const pf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

function formatNumber(value: number | null | undefined) {
    return value == null ? "—" : nf.format(Math.round(value));
}

function formatPercent(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) return "—";
    return `${pf.format(value)}٪`;
}

function toInputDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function startOfDay(value: string) {
    const date = parseInputDate(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfDay(value: string) {
    const date = parseInputDate(value);
    date.setHours(23, 59, 59, 999);
    return date;
}

function snapshotDate(value: string) {
    return new Date(value).toLocaleDateString("fa-IR");
}

function sum(snapshots: Snapshot[], key: MetricKey) {
    return snapshots.reduce((total, item) => total + (item[key] ?? 0), 0);
}

function followerGrowth(snapshots: Snapshot[]) {
    if (!snapshots.length) return null;
    const first = snapshots[0]?.followerCount;
    const last = snapshots[snapshots.length - 1]?.followerCount;
    if (typeof first !== "number" || typeof last !== "number") return null;
    return last - first;
}

function changePercent(current: number | null, previous: number | null) {
    if (current == null || previous == null || previous === 0) return null;
    return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function csvCell(value: string | number | null) {
    const text = value == null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
}

export default function AdvancedAnalyticsReports() {
    const today = useMemo(() => new Date(), []);
    const defaultFrom = useMemo(() => {
        const date = new Date(today);
        date.setDate(date.getDate() - 29);
        return toInputDate(date);
    }, [today]);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountId, setAccountId] = useState("");
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(toInputDate(today));
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [error, setError] = useState("");

    const loadAccounts = useCallback(async () => {
        try {
            setLoadingAccounts(true);
            const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || "خطا در دریافت اکانت‌ها");
            }
            const list = Array.isArray(result.accounts) ? (result.accounts as Account[]) : [];
            setAccounts(list);
            setAccountId((current) =>
                list.some((item) => item.id === current)
                    ? current
                    : list.find((item) => item.isConnected)?.id || list[0]?.id || "",
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "خطا در دریافت اکانت‌ها");
        } finally {
            setLoadingAccounts(false);
        }
    }, []);

    const load = useCallback(async (selectedAccountId: string) => {
        if (!selectedAccountId) return;

        try {
            setLoading(true);
            setError("");
            const response = await fetch(
                `/api/instagram/insights/history?days=365&accountId=${encodeURIComponent(selectedAccountId)}`,
                { cache: "no-store" },
            );
            const result = (await response.json()) as AnalyticsResponse;
            if (!response.ok || !result.success) {
                throw new Error(result.error || "خطا در دریافت گزارش تحلیلی");
            }
            setData(result);
        } catch (err) {
            setData(null);
            setError(err instanceof Error ? err.message : "خطا در دریافت گزارش تحلیلی");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccounts();
    }, [loadAccounts]);

    useEffect(() => {
        if (accountId) void load(accountId);
    }, [accountId, load]);

    const report = useMemo(() => {
        if (!data || !from || !to || startOfDay(from) > endOfDay(to)) return null;

        const currentStart = startOfDay(from).getTime();
        const currentEnd = endOfDay(to).getTime();
        const duration = currentEnd - currentStart + 1;
        const previousStart = currentStart - duration;
        const previousEnd = currentStart - 1;

        const current = data.snapshots.filter((item) => {
            const time = new Date(item.snapshotDate).getTime();
            return time >= currentStart && time <= currentEnd;
        });

        const previous = data.snapshots.filter((item) => {
            const time = new Date(item.snapshotDate).getTime();
            return time >= previousStart && time <= previousEnd;
        });

        const currentMetrics = Object.fromEntries(
            METRICS.map(({ key }) => [key, sum(current, key)]),
        ) as Record<MetricKey, number>;

        const previousMetrics = Object.fromEntries(
            METRICS.map(({ key }) => [key, sum(previous, key)]),
        ) as Record<MetricKey, number>;

        const follower = followerGrowth(current);
        const previousFollower = followerGrowth(previous);

        return {
            current,
            previous,
            currentMetrics,
            previousMetrics,
            follower,
            previousFollower,
            currentEngagementRate:
                currentMetrics.reach > 0
                    ? Number(((currentMetrics.totalInteractions / currentMetrics.reach) * 100).toFixed(2))
                    : null,
            previousEngagementRate:
                previousMetrics.reach > 0
                    ? Number(((previousMetrics.totalInteractions / previousMetrics.reach) * 100).toFixed(2))
                    : null,
        };
    }, [data, from, to]);

    const exportCsv = useCallback(() => {
        if (!report || !data) return;

        const rows = [
            ["Instagram Advanced Analytics"],
            ["Account", `@${data.account.username}`],
            ["Current period", `${from} → ${to}`],
            ["Previous period", "Same duration immediately before current period"],
            [],
            ["Metric", "Current", "Previous", "Change %"],
            ...METRICS.map(({ key, title }) => [
                title,
                report.currentMetrics[key],
                report.previousMetrics[key],
                changePercent(report.currentMetrics[key], report.previousMetrics[key]),
            ]),
            ["رشد فالوئر", report.follower, report.previousFollower, changePercent(report.follower, report.previousFollower)],
            ["نرخ تعامل", report.currentEngagementRate, report.previousEngagementRate, changePercent(report.currentEngagementRate, report.previousEngagementRate)],
            [],
            ["Snapshot date", ...METRICS.map((metric) => metric.title), "Follower Count"],
            ...report.current.map((item) => [
                snapshotDate(item.snapshotDate),
                ...METRICS.map(({ key }) => item[key]),
                item.followerCount,
            ]),
        ];

        const csv = rows
            .map((row) => row.map((cell) => csvCell(cell as string | number | null)).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `smartdirect-instagram-report-${from}-${to}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [data, from, report, to]);

    const invalidRange = !from || !to || startOfDay(from) > endOfDay(to);

    return (
        <section id="advanced-analytics" dir="rtl" className="scroll-mt-24 space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-slate-400">
                        <BarChart3 size={14} />
                        ADVANCED REPORTS
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                        گزارش پیشرفته عملکرد
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                        بازه دلخواه را انتخاب کنید، با دوره قبل مقایسه کنید و گزارش CSV بگیرید.
                    </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <label className="block text-[10px] text-slate-400">از تاریخ</label>
                        <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(event) => setFrom(event.target.value)}
                            className="mt-1 bg-transparent text-xs font-medium text-slate-800 outline-none"
                        />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <label className="block text-[10px] text-slate-400">تا تاریخ</label>
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            max={toInputDate(today)}
                            onChange={(event) => setTo(event.target.value)}
                            className="mt-1 bg-transparent text-xs font-medium text-slate-800 outline-none"
                        />
                    </div>
                    <select
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        disabled={loadingAccounts || !accounts.length}
                        className="h-[58px] min-w-[150px] rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none"
                        aria-label="انتخاب پیج برای گزارش"
                    >
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                @{account.username}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => accountId && load(accountId)}
                        disabled={loading || !accountId}
                        className="inline-flex h-[58px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        بروزرسانی
                    </button>
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={!report || invalidRange}
                        className="inline-flex h-[58px] items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Download size={15} />
                        خروجی CSV
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>
                    <button type="button" onClick={() => accountId && load(accountId)} className="inline-flex items-center gap-1.5 font-medium hover:underline">
                        <RefreshCw size={14} />
                        تلاش مجدد
                    </button>
                </div>
            )}

            {invalidRange && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    بازه انتخاب‌شده معتبر نیست. تاریخ شروع باید قبل از تاریخ پایان باشد.
                </div>
            )}

            {loading && !data && (
                <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
                    در حال آماده‌سازی گزارش...
                </div>
            )}

            {report && !invalidRange && (
                <>
                    <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
                        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                            <p className="text-sm font-bold text-slate-900">مقایسه با دوره قبل</p>
                            <p className="mt-1 text-xs text-slate-400">در این بخش فقط تغییرات دوره‌ای نمایش داده می‌شود تا آمار خام عملکرد پیج دوباره تکرار نشود.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-[720px] w-full text-right text-xs">
                                <thead className="bg-slate-50 text-slate-400">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">شاخص</th>
                                        <th className="px-5 py-3 font-medium">بازه انتخابی</th>
                                        <th className="px-5 py-3 font-medium">دوره قبل</th>
                                        <th className="px-5 py-3 font-medium">تغییر</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {METRICS.map(({ key, title }) => {
                                        const current = report.currentMetrics[key];
                                        const previous = report.previousMetrics[key];
                                        const change = changePercent(current, previous);
                                        const positive = change == null || change >= 0;
                                        const Icon = positive ? TrendingUp : TrendingDown;
                                        return (
                                            <tr key={key} className="text-slate-700">
                                                <td className="px-5 py-3 font-medium">{title}</td>
                                                <td className="px-5 py-3">{formatNumber(current)}</td>
                                                <td className="px-5 py-3">{formatNumber(previous)}</td>
                                                <td className="px-5 py-3">
                                                    <span className={change == null ? "text-slate-400" : positive ? "inline-flex items-center gap-1 font-semibold text-emerald-600" : "inline-flex items-center gap-1 font-semibold text-red-600"}>
                                                        {change == null ? "—" : <><Icon size={13} /> {formatPercent(change)}</>}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="text-slate-700">
                                        <td className="px-5 py-3 font-medium">رشد فالوئر</td>
                                        <td className="px-5 py-3">{formatNumber(report.follower)}</td>
                                        <td className="px-5 py-3">{formatNumber(report.previousFollower)}</td>
                                        <td className="px-5 py-3">{formatPercent(changePercent(report.follower, report.previousFollower))}</td>
                                    </tr>
                                    <tr className="text-slate-700">
                                        <td className="px-5 py-3 font-medium">نرخ تعامل</td>
                                        <td className="px-5 py-3">{formatPercent(report.currentEngagementRate)}</td>
                                        <td className="px-5 py-3">{formatPercent(report.previousEngagementRate)}</td>
                                        <td className="px-5 py-3">{formatPercent(changePercent(report.currentEngagementRate, report.previousEngagementRate))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    </div>
                </>
            )}
        </section>
    );
}
