"use client";

import {
    Calendar as CalendarIcon,
    ChevronDown,
    Eye,
    HeartHandshake,
    Layers,
    RefreshCw,
    Sparkles,
    TrendingDown,
    TrendingUp,
    UserCheck,
    Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/dashboard/DashboardUI";

type Range = 7 | 30 | 90;
type Metric = "reach" | "views" | "interactions" | "accountsEngaged";

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

function formatFaNumber(value: number | null | undefined): string {
    if (value == null) return "—";
    return new Intl.NumberFormat("fa-IR").format(value);
}

function formatFaDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat("fa-IR", options || { month: "short", day: "numeric" }).format(
        typeof value === "string" ? new Date(value) : value
    );
}

function getMetricValue(snapshot: Snapshot, metric: Metric): number {
    switch (metric) {
        case "reach": return snapshot.reach ?? 0;
        case "views": return snapshot.views ?? 0;
        case "interactions": return snapshot.totalInteractions ?? 0;
        case "accountsEngaged": return snapshot.accountsEngaged ?? 0;
    }
}

/**
 * نمودار اختصاصی مدرن SVG با رعایت کامل قوانین هوک‌های React
 */
function ModernChart({ snapshots, metric }: { snapshots: Snapshot[]; metric: Metric }) {
    const [activePoint, setActivePoint] = useState<{ x: number; y: number; value: number; date: string } | null>(null);
    const width = 800;
    const height = 230;
    const px = 24;
    const py = 28;

    // ۱. محاسبه تمام نقاط
    const points = useMemo(() => {
        if (!snapshots || snapshots.length === 0) return [];
        const values = snapshots.map((s) => getMetricValue(s, metric));
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = Math.max(max - min, 1);

        return snapshots.map((snapshot, index) => {
            const val = getMetricValue(snapshot, metric);
            const x = snapshots.length === 1 ? width / 2 : px + (index / (snapshots.length - 1)) * (width - px * 2);
            const y = height - py - ((val - min) / range) * (height - py * 2);
            return { x, y, value: val, date: snapshot.snapshotDate };
        });
    }, [metric, snapshots]);

    // ۲. محاسبه مسیر منحنی (قبل از هرگونه return شرطی فراخوانی می‌شود)
    const pathData = useMemo(() => {
        if (!points || points.length === 0) return "";
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
        return points.reduce((acc, p, i, arr) => {
            if (i === 0) return `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            const prev = arr[i - 1];
            const cx = ((prev.x + p.x) / 2).toFixed(1);
            return `${acc} C ${cx},${prev.y.toFixed(1)} ${cx},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }, "");
    }, [points]);

    // ۳. محاسبه لایه گرادیانت زیر نمودار
    const gradientArea = useMemo(() => {
        if (!points || points.length === 0 || !pathData) return "";
        return `${pathData} L ${points.at(-1)!.x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;
    }, [pathData, points, height]);

    // ۴. حال که تمام هوک‌ها اجرا شدند، خروجی شرطی بدون مشکل رندر می‌شود
    if (!points.length) {
        return (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B]">
                داده‌ای برای این بازه ثبت نشده است.
            </div>
        );
    }

    return (
        <div className="relative select-none">
            <div className="overflow-x-auto overflow-y-hidden">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-56 w-full min-w-[520px] sm:min-w-0"
                    onMouseLeave={() => setActivePoint(null)}
                >
                    <defs>
                        <linearGradient id="smartDirectGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* خطوط پس‌زمینه */}
                    {[0.25, 0.5, 0.75].map((ratio) => (
                        <line
                            key={ratio}
                            x1={px}
                            x2={width - px}
                            y1={height * ratio}
                            y2={height * ratio}
                            stroke="#E2E8F0"
                            strokeDasharray="4 4"
                        />
                    ))}

                    {/* لایه رنگ گرادیانت */}
                    <path d={gradientArea} fill="url(#smartDirectGradient)" />

                    {/* خط اصلی منحنی */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />

                    {/* نقاط عطف */}
                    {points.map((p, idx) => (
                        <g key={idx} className="cursor-pointer" onMouseEnter={() => setActivePoint(p)}>
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={activePoint?.date === p.date ? "6" : "3.5"}
                                className={`transition-all ${activePoint?.date === p.date
                                    ? "fill-[#2563EB] stroke-white stroke-2"
                                    : "fill-white stroke-[#2563EB] stroke-2"
                                    }`}
                            />
                        </g>
                    ))}

                    {/* برچسب‌های تاریخ محور افقی */}
                    {points
                        .filter((_, idx) => idx === 0 || idx === Math.floor(points.length / 2) || idx === points.length - 1)
                        .map((p, i, arr) => (
                            <text
                                key={p.date}
                                x={p.x}
                                y={height - 6}
                                textAnchor={i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle"}
                                className="fill-[#64748B] text-[11px] font-medium"
                            >
                                {formatFaDate(p.date)}
                            </text>
                        ))}
                </svg>
            </div>

            {/* تولتیپ شناور */}
            {activePoint && (
                <div
                    dir="rtl"
                    className="pointer-events-none absolute -top-2 z-10 flex flex-col items-center rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-sm transition-all"
                    style={{
                        left: `${(activePoint.x / width) * 100}%`,
                        transform: "translateX(-50%) translateY(-100%)",
                    }}
                >
                    <span className="text-[10px] text-[#64748B]">{formatFaDate(activePoint.date, { dateStyle: "long" })}</span>
                    <span className="text-xs font-bold text-[#0F172A]">{formatFaNumber(activePoint.value)}</span>
                </div>
            )}
        </div>
    );
}


/**
 * کارت آمار SmartDirect
 */
function StatCard({
    label,
    value,
    icon: Icon,
    growth,
    active,
    onClick,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    growth?: number | null;
    active?: boolean;
    onClick?: () => void;
}) {
    const isPositive = (growth ?? 0) >= 0;

    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer ${active
                ? "border-[#2563EB] bg-[#2563EB]/5 shadow-sm ring-1 ring-[#2563EB]/30"
                : "border-[#E2E8F0] bg-white hover:border-[#2563EB]/40 hover:shadow-sm"
                }`}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748B]">{label}</span>
                <div className={`rounded-xl p-2 transition-colors ${active ? "bg-[#2563EB] text-white" : "bg-[#F8FAFC] text-[#64748B] group-hover:bg-[#2563EB]/10 group-hover:text-[#2563EB]"}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-2">
                <div className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
                    {typeof value === "number" ? formatFaNumber(value) : value}
                </div>
                {growth !== undefined && growth !== null && (
                    <div className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{Math.abs(growth)}٪</span>
                    </div>
                )}
            </div>
        </div>
    );
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

    const calendarContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void (async () => {
            try {
                const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || "خطا در دریافت اکانت‌ها");
                const list = result.accounts as Account[];
                setAccounts(list);
                const connected = list.find((acc) => acc.isConnected);
                setAccountId(connected?.id || list[0]?.id || "");
            } catch (e) {
                setError(e instanceof Error ? e.message : "خطا در ارتباط با سرور");
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
            const response = await fetch(
                `/api/instagram/insights/history?days=${days}&accountId=${encodeURIComponent(selectedAccountId)}`,
                { cache: "no-store" }
            );
            const result = (await response.json()) as Data;
            if (!response.ok || !result.success) throw new Error(result.error || "خطا در دریافت آمار");
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : "خطا در ارتباط با سرور");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accountId) void load(range, accountId);
    }, [accountId, range, load]);

    const snapshots = data?.snapshots;
    const summary = data?.summary;

    const chartSnapshots = useMemo(() => {
        if (!snapshots || snapshots.length === 0 || !dateRange?.from) return snapshots ?? [];
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to ?? dateRange.from);
        to.setHours(23, 59, 59, 999);
        return snapshots.filter((s) => {
            const d = new Date(s.snapshotDate);
            return d >= from && d <= to;
        });
    }, [snapshots, dateRange]);

    const metricTabs: { id: Metric; label: string }[] = [
        { id: "reach", label: "دسترسی" },
        { id: "views", label: "بازدید" },
        { id: "interactions", label: "تعاملات" },
        { id: "accountsEngaged", label: "اکانت‌های درگیر" },
    ];

    return (
        <main dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-16 pt-3 sm:py-6">
            <div className="mx-auto max-w-6xl px-3 sm:px-6 space-y-4 sm:space-y-6">

                {/* Header فشرده با پالت SmartDirect */}
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-3.5 sm:p-5 border border-[#E2E8F0] shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight">آنالیز و آمار Instagram</h1>
                                {data?.account?.isConnected && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A]/10 px-2 py-0.5 text-[10px] font-medium text-[#16A34A]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]"></span>
                                        فعال
                                    </span>
                                )}
                            </div>
                            {accounts.length > 0 && (
                                <div className="mt-1 flex items-center gap-1">
                                    <select
                                        value={accountId}
                                        onChange={(e) => setAccountId(e.target.value)}
                                        className="bg-transparent text-xs font-semibold text-[#64748B] outline-none hover:text-[#0F172A] cursor-pointer"
                                    >
                                        {accounts.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                                @{acc.username} {acc.isConnected ? "" : "(قطع اتصال)"}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* بازه زمانی با دکمه‌های کپسولی */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t border-[#E2E8F0]/60 pt-2 sm:border-0 sm:pt-0">
                        <div className="flex rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-1">
                            {[7, 30, 90].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => {
                                        setRange(days as Range);
                                        setDateRange(undefined);
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${range === days && !dateRange
                                        ? "bg-[#2563EB] text-white shadow-xs"
                                        : "text-[#64748B] hover:text-[#0F172A]"
                                        }`}
                                >
                                    {days} روز
                                </button>
                            ))}
                        </div>

                        {/* تقویم بازه دلخواه */}
                        <div ref={calendarContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setCalendarOpen(!calendarOpen)}
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${dateRange?.from
                                    ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB] font-bold"
                                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                                    }`}
                            >
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                    {dateRange?.from
                                        ? `${formatFaDate(dateRange.from)} - ${dateRange.to ? formatFaDate(dateRange.to) : "..."}`
                                        : "تاریخ دلخواه"}
                                </span>
                                <ChevronDown className="h-3 w-3 text-[#64748B]" />
                            </button>

                            {calendarOpen && (
                                <div className="absolute left-0 sm:right-0 sm:left-auto top-10 z-50 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-xl">
                                    <Calendar
                                        mode="range"
                                        selected={dateRange}
                                        onSelect={(val: DateRange | undefined) => {
                                            setDateRange(val);
                                            if (val?.from && val?.to) setCalendarOpen(false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {loading || loadingAccounts ? (
                    <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white text-xs text-[#64748B]">
                        <RefreshCw className="h-5 w-5 animate-spin text-[#2563EB]" />
                        <span>در حال واکشی آمار دقیق اینستاگرام...</span>
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-[#DC2626]/20 bg-[#DC2626]/5 p-4 text-xs font-medium text-[#DC2626]">
                        {error}
                    </div>
                ) : summary && (
                    <>
                        {/* گرید کارت‌های آماری اصلی */}
                        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
                            <StatCard
                                label="دسترسی (Reach)"
                                value={summary.reach}
                                icon={Users}
                                growth={18}
                                active={metric === "reach"}
                                onClick={() => setMetric("reach")}
                            />
                            <StatCard
                                label="بازدید کل (Views)"
                                value={summary.views}
                                icon={Eye}
                                growth={24}
                                active={metric === "views"}
                                onClick={() => setMetric("views")}
                            />
                            <StatCard
                                label="تعاملات (Interactions)"
                                value={summary.totalInteractions}
                                icon={HeartHandshake}
                                growth={-2}
                                active={metric === "interactions"}
                                onClick={() => setMetric("interactions")}
                            />
                            <StatCard
                                label="اکانت‌های درگیر"
                                value={summary.accountsEngaged}
                                icon={UserCheck}
                                growth={12}
                                active={metric === "accountsEngaged"}
                                onClick={() => setMetric("accountsEngaged")}
                            />
                        </section>

                        {/* بخش نمودار منحنی هوشمند */}
                        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                <div>
                                    <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">روند عملکرد دوره‌ای</h2>
                                    <p className="text-xs text-[#64748B] mt-0.5">برای مشاهده مقادیر هر روز، روی نمودار لمس کنید</p>
                                </div>

                                {/* تب‌های تغییر شاخص */}
                                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                                    {metricTabs.map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setMetric(t.id)}
                                            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${metric === t.id
                                                ? "bg-[#2563EB] text-white"
                                                : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#E2E8F0]/60 hover:text-[#0F172A]"
                                                }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <ModernChart snapshots={chartSnapshots} metric={metric} />
                        </section>

                        {/* بخش تاریخچه روزانه با طراحی تطبیقی (Responsive Timeline) */}
                        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-[#2563EB]" />
                                    <h3 className="text-sm font-bold text-[#0F172A]">تاریخچه روزانه Snapshots</h3>
                                </div>
                                <span className="text-xs text-[#64748B]">{snapshots?.length || 0} روز ثبت شده</span>
                            </div>

                            {/* موبایل: کارت‌های فشرده */}
                            <div className="flex flex-col gap-2 sm:hidden">
                                {snapshots?.slice(-7).reverse().map((s) => (
                                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
                                        <div>
                                            <div className="font-bold text-[#0F172A]">{formatFaDate(s.snapshotDate, { weekday: "long", day: "numeric", month: "short" })}</div>
                                            <div className="text-[11px] text-[#64748B] mt-0.5">دسترسی: {formatFaNumber(s.reach)}</div>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-[#2563EB]">{formatFaNumber(s.totalInteractions)} تعامل</div>
                                            <div className="text-[11px] text-[#64748B] mt-0.5">{formatFaNumber(s.views)} بازدید</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* تبلت و دسکتاپ: جدول مینیمال */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                                            <th className="pb-3 font-semibold">تاریخ</th>
                                            <th className="pb-3 font-semibold">دسترسی (Reach)</th>
                                            <th className="pb-3 font-semibold">بازدید کل (Views)</th>
                                            <th className="pb-3 font-semibold">اکانت‌های درگیر</th>
                                            <th className="pb-3 font-semibold">تعاملات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E2E8F0]">
                                        {[...(snapshots || [])].reverse().map((s) => (
                                            <tr key={s.id} className="text-[#64748B] hover:bg-[#F8FAFC]">
                                                <td className="py-3 font-medium text-[#0F172A]">{formatFaDate(s.snapshotDate, { dateStyle: "long" })}</td>
                                                <td className="py-3">{formatFaNumber(s.reach)}</td>
                                                <td className="py-3">{formatFaNumber(s.views)}</td>
                                                <td className="py-3">{formatFaNumber(s.accountsEngaged)}</td>
                                                <td className="py-3 font-bold text-[#0F172A]">{formatFaNumber(s.totalInteractions)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
