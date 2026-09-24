"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";

type Range = 7 | 30 | 90;
type Metric = "reach" | "views" | "interactions";

type Account = {
    id: string;
    igUserId: string;
    username: string;
    isConnected: boolean;
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

type Data = {
    success: boolean;
    account: Account;
    summary: {
        reach: number;
        views: number;
        accountsEngaged: number;
        totalInteractions: number;
        profileViews: number;
        followerCount: number;
        followerGrowth: number;
        engagementRate: number | null;
    };
    latest: Snapshot | null;
    snapshots: Snapshot[];
    error?: string;
};

function number(value: number | null | undefined) {
    return value == null ? "—" : new Intl.NumberFormat("fa-IR").format(value);
}

function percent(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) return "—";
    return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value)}٪`;
}

function date(value: string) {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value));
}

function metricValue(snapshot: Snapshot, metric: Metric) {
    if (metric === "reach") return snapshot.reach ?? 0;
    if (metric === "views") return snapshot.views ?? 0;
    return snapshot.totalInteractions ?? 0;
}

function Chart({ snapshots, metric }: { snapshots: Snapshot[]; metric: Metric }) {
    const width = 900;
    const height = 300;
    const px = 18;
    const py = 24;

    const points = useMemo(() => {
        if (!snapshots.length) return [];
        const values = snapshots.map((s) => metricValue(s, metric));
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = Math.max(max - min, 1);

        return snapshots.map((snapshot, index) => ({
            x: snapshots.length === 1 ? width / 2 : px + (index / (snapshots.length - 1)) * (width - px * 2),
            y: height - py - ((metricValue(snapshot, metric) - min) / range) * (height - py * 2),
            value: metricValue(snapshot, metric),
            date: snapshot.snapshotDate,
        }));
    }, [metric, snapshots]);

    if (!points.length) {
        return <div className="flex h-[300px] items-center justify-center border border-dashed border-zinc-200 text-sm text-zinc-400">هنوز داده تاریخی برای این بازه وجود ندارد.</div>;
    }

    const line = points.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area = `${line} L ${points.at(-1)!.x.toFixed(2)} ${height - py} L ${points[0].x.toFixed(2)} ${height - py} Z`;
    const labels = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));

    return (
        <div className="overflow-hidden">
            <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-zinc-500">{metric === "reach" ? "دسترسی" : metric === "views" ? "بازدید" : "تعاملات"}</span>
                <span className="text-xs text-zinc-400">{number(points.at(-1)!.value)} آخرین مقدار</span>
            </div>
            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] min-w-[680px] w-full" role="img">
                    {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={px} x2={width - px} y1={height * ratio} y2={height * ratio} stroke="currentColor" className="text-zinc-100" />)}
                    <path d={area} fill="currentColor" className="text-zinc-100" />
                    <path d={line} fill="none" stroke="currentColor" className="text-zinc-900" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {points.map((p) => <circle key={`${p.date}-${p.value}`} cx={p.x} cy={p.y} r="3.5" fill="currentColor" className="text-zinc-900" />)}
                    {labels.map((i) => <text key={points[i].date} x={points[i].x} y={height - 4} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-zinc-400 text-[12px]">{new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(points[i].date))}</text>)}
                </svg>
            </div>
        </div>
    );
}

function Stat({ label, value, helper }: { label: string; value: string; helper?: string }) {
    return <div className="border border-zinc-200 bg-white p-5 sm:p-6"><div className="text-sm text-zinc-500">{label}</div><div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{value}</div>{helper && <div className="mt-2 text-xs text-zinc-400">{helper}</div>}</div>;
}

export default function InsightsDashboard() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountId, setAccountId] = useState("");
    const [range, setRange] = useState<Range>(7);
    const [metric, setMetric] = useState<Metric>("reach");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState<Data | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || "خطا در دریافت اکانت‌ها");
                const list = result.accounts as Account[];
                setAccounts(list);
                const connected = list.find((account) => account.isConnected);
                setAccountId(connected?.id || list[0]?.id || "");
            } catch (e) {
                setError(e instanceof Error ? e.message : "خطا در دریافت اکانت‌های Instagram");
            } finally {
                setLoadingAccounts(false);
            }
        })();
    }, []);

    const load = useCallback(async (days: Range, selectedAccountId: string) => {
        if (!selectedAccountId) return;
        try {
            setLoading(true);
            setError("");
            const response = await fetch(`/api/instagram/insights/history?days=${days}&accountId=${encodeURIComponent(selectedAccountId)}`, { cache: "no-store" });
            const result = (await response.json()) as Data;
            if (!response.ok || !result.success) throw new Error(result.error || "خطا در دریافت آمار Instagram");
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : "خطا در دریافت آمار Instagram");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accountId) void load(range, accountId);
    }, [accountId, range, load]);

    const summary = data?.summary;
    const latest = data?.latest;

    const chartSnapshots = useMemo(() => {
        if (!data?.snapshots.length || !dateRange?.from) return data?.snapshots ?? [];
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to ?? dateRange.from);
        to.setHours(23, 59, 59, 999);
        return data.snapshots.filter((snapshot) => {
            const snapshotDate = new Date(snapshot.snapshotDate);
            return snapshotDate >= from && snapshotDate <= to;
        });
    }, [data?.snapshots, dateRange]);

    return (
        <main dir="rtl" className="min-h-screen bg-zinc-50/40 px-4 py-5 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
                <header className="flex flex-col gap-5 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Instagram Insights</div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">تحلیل پیج</h1>
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                        {accounts.length > 0 && (
                            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-11 min-w-64 border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-zinc-500">
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        @{account.username}{account.isConnected ? "" : " — قطع اتصال"}
                                    </option>
                                ))}
                            </select>
                        )}
                        <div className="flex gap-1 border border-zinc-200 bg-white p-1">
                            {[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => setRange(days as Range)} className={`min-w-16 px-4 py-2 text-sm transition-colors ${range === days ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}`}>{days} روز</button>)}
                        </div>
                    </div>
                </header>

                {error && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
                {loadingAccounts && <div className="border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">در حال دریافت اکانت‌ها...</div>}
                {!loadingAccounts && accounts.length === 0 && <div className="border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">هیچ اکانت Instagram برای این حساب پیدا نشد.</div>}
                {loading && accountId && !data && <div className="border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">در حال دریافت آمار...</div>}

                {data && summary && (
                    <>
                        {!data.account.isConnected && <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">این اکانت در حال حاضر متصل نیست؛ داده‌های ذخیره‌شده تاریخی نمایش داده می‌شوند و برای دریافت داده جدید باید دوباره متصل شود.</div>}

                        <section className="grid grid-cols-1 gap-px overflow-hidden border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            <Stat label="دسترسی" value={number(summary.reach)} helper={`${range} روز اخیر`} />
                            <Stat label="بازدید" value={number(summary.views)} helper={`${range} روز اخیر`} />
                            <Stat label="اکانت‌های درگیر" value={number(summary.accountsEngaged)} helper={`${range} روز اخیر`} />
                            <Stat label="تعاملات" value={number(summary.totalInteractions)} helper={`${range} روز اخیر`} />
                            <Stat label="بازدید پروفایل" value={number(summary.profileViews)} helper={`${range} روز اخیر`} />
                            <Stat label="دنبال‌کنندگان" value={number(summary.followerCount)} helper={summary.followerGrowth === 0 ? "بدون تغییر در بازه" : `${summary.followerGrowth > 0 ? "+" : ""}${number(summary.followerGrowth)} در بازه`} />
                        </section>

                        <section className="border border-zinc-200 bg-white p-5 sm:p-6">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-2xl">
                                    <h2 className="text-xl font-semibold text-zinc-950">روند عملکرد Instagram</h2>
                                    <p className="mt-2 text-sm leading-6 text-zinc-500">شاخص‌های عملکرد اکانت فعال را در یک بازه مشخص بررسی کنید.</p>
                                    <div className="mt-5 flex w-full gap-1 border border-zinc-200 p-1 sm:w-fit">
                                        {([["reach", "دسترسی"], ["views", "بازدید"], ["interactions", "تعاملات"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMetric(value)} className={`px-3 py-2 text-xs sm:text-sm ${metric === value ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}>{label}</button>)}
                                    </div>
                                </div>
                                <div className="relative shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setCalendarOpen((open) => !open)}
                                        className="inline-flex h-11 min-w-48 items-center justify-center gap-3 border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
                                        aria-expanded={calendarOpen}
                                        aria-haspopup="dialog"
                                    >
                                        <span>{dateRange?.from ? (dateRange.to ? `${date(dateRange.from.toISOString())} تا ${date(dateRange.to.toISOString())}` : date(dateRange.from.toISOString())) : "انتخاب بازه زمانی"}</span>
                                        <span className="text-zinc-400">⌄</span>
                                    </button>

                                    {calendarOpen && (
                                        <div className="absolute right-0 top-14 z-50 border border-zinc-200 bg-white p-2 shadow-lg">
                                            <Calendar
                                                mode="range"
                                                selected={dateRange}
                                                onSelect={(value) => {
                                                    setDateRange(value);
                                                    if (value?.from && value?.to) setCalendarOpen(false);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 border-t border-zinc-100 pt-6">
                                <Chart snapshots={chartSnapshots} metric={metric} />
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-6 lg:grid-cols-1">
                            <aside className="border border-zinc-200 bg-white p-5 sm:p-6">
                                <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">وضعیت فعلی</div>
                                <h2 className="mt-2 text-lg font-semibold text-zinc-950">خلاصه عملکرد</h2>
                                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                    <div><div className="text-sm text-zinc-500">نرخ تعامل</div><div className="mt-1 text-2xl font-semibold text-zinc-950">{percent(summary.engagementRate)}</div></div>
                                    <div className="border-t border-zinc-100 pt-5 sm:border-t-0 sm:border-r sm:pt-0 sm:pr-5"><div className="text-sm text-zinc-500">آخرین دسترسی</div><div className="mt-1 text-xl font-semibold text-zinc-950">{number(latest?.reach)}</div></div>
                                    <div className="border-t border-zinc-100 pt-5 sm:border-t-0 sm:border-r sm:pt-0 sm:pr-5"><div className="text-sm text-zinc-500">آخرین تعاملات</div><div className="mt-1 text-xl font-semibold text-zinc-950">{number(latest?.totalInteractions)}</div></div>
                                    <div className="border-t border-zinc-100 pt-5 sm:border-t-0 sm:border-r sm:pt-0 sm:pr-5"><div className="text-sm text-zinc-500">آخرین Snapshot</div><div className="mt-1 text-sm font-medium text-zinc-900">{latest ? date(latest.snapshotDate) : "—"}</div></div>
                                </div>
                            </aside>
                        </section>

                        <section className="border border-zinc-200 bg-white p-5 sm:p-6">
                            <div className="mb-5"><h2 className="text-lg font-semibold text-zinc-950">تاریخچه روزانه</h2><p className="mt-1 text-sm text-zinc-500">{data.snapshots.length} Snapshot در این بازه ذخیره شده است.</p></div>
                            {data.snapshots.length === 0 ? <div className="border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">هنوز داده تاریخی برای این بازه وجود ندارد.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="px-4 py-3 font-medium">تاریخ</th><th className="px-4 py-3 font-medium">دسترسی</th><th className="px-4 py-3 font-medium">بازدید</th><th className="px-4 py-3 font-medium">اکانت‌های درگیر</th><th className="px-4 py-3 font-medium">تعاملات</th><th className="px-4 py-3 font-medium">دنبال‌کنندگان</th></tr></thead><tbody>{[...data.snapshots].reverse().map((snapshot) => <tr key={snapshot.id} className="border-b border-zinc-100 last:border-b-0"><td className="px-4 py-4 text-zinc-700">{date(snapshot.snapshotDate)}</td><td className="px-4 py-4 font-medium text-zinc-950">{number(snapshot.reach)}</td><td className="px-4 py-4 text-zinc-700">{number(snapshot.views)}</td><td className="px-4 py-4 text-zinc-700">{number(snapshot.accountsEngaged)}</td><td className="px-4 py-4 text-zinc-700">{number(snapshot.totalInteractions)}</td><td className="px-4 py-4 text-zinc-700">{number(snapshot.followerCount)}</td></tr>)}</tbody></table></div>}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
