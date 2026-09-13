"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    ArrowDownLeft,
    ArrowUpLeft,
    BarChart3,
    Eye,
    Heart,
    MessageCircle,
    RefreshCw,
    TrendingUp,
    Users,
} from "lucide-react";

type Range = 7 | 30 | 90;
type Metric = "reach" | "views" | "interactions";

type Account = {
    id: string;
    igUserId: string;
    username: string;
    isConnected: boolean;
    profilePictureUrl?: string | null;
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
};

const nf = new Intl.NumberFormat("fa-IR");
const pf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });

function number(value: number | null | undefined) {
    return value == null ? "—" : nf.format(value);
}

function percent(value: number | null | undefined) {
    return value == null || !Number.isFinite(value) ? "—" : `${pf.format(value)}٪`;
}

function shortDate(value: string) {
    return new Intl.DateTimeFormat("fa-IR", {
        month: "short",
        day: "numeric",
    }).format(new Date(value));
}

function fullDate(value: string) {
    return new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
    }).format(new Date(value));
}

function metricValue(snapshot: Snapshot, metric: Metric) {
    if (metric === "reach") return snapshot.reach ?? 0;
    if (metric === "views") return snapshot.views ?? 0;
    return snapshot.totalInteractions ?? 0;
}

function initials(username: string) {
    return username.replace(/^@/, "").slice(0, 2).toUpperCase() || "IG";
}

function Chart({ snapshots, metric }: { snapshots: Snapshot[]; metric: Metric }) {
    const width = 1000;
    const height = 310;
    const padX = 20;
    const padY = 28;

    const points = useMemo(() => {
        if (!snapshots.length) return [];

        const values = snapshots.map((item) => metricValue(item, metric));
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = Math.max(max - min, 1);

        return snapshots.map((item, index) => ({
            x: snapshots.length === 1
                ? width / 2
                : padX + (index / (snapshots.length - 1)) * (width - padX * 2),
            y: height - padY - ((metricValue(item, metric) - min) / range) * (height - padY * 2),
            value: metricValue(item, metric),
            date: item.snapshotDate,
        }));
    }, [metric, snapshots]);

    if (!points.length) {
        return (
            <div className="flex h-[310px] items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
                هنوز داده تاریخی برای این بازه ثبت نشده است.
            </div>
        );
    }

    const line = points
        .map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");
    const area = `${line} L ${points.at(-1)!.x.toFixed(2)} ${height - padY} L ${points[0].x.toFixed(2)} ${height - padY} Z`;
    const labelIndexes = Array.from(
        new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
    );

    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                    {metric === "reach" ? "دسترسی" : metric === "views" ? "بازدید" : "تعاملات"}
                </span>
                <span className="text-xs text-slate-400">
                    آخرین مقدار: {number(points.at(-1)?.value)}
                </span>
            </div>

            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-[310px] min-w-[680px] w-full" role="img">
                    {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
                        <line
                            key={ratio}
                            x1={padX}
                            x2={width - padX}
                            y1={height * ratio}
                            y2={height * ratio}
                            stroke="currentColor"
                            className="text-slate-100"
                        />
                    ))}
                    <path d={area} fill="currentColor" className="text-slate-50" />
                    <path
                        d={line}
                        fill="none"
                        stroke="currentColor"
                        className="text-slate-900"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                    />
                    {points.map((point) => (
                        <circle
                            key={`${point.date}-${point.value}`}
                            cx={point.x}
                            cy={point.y}
                            r="3.5"
                            fill="currentColor"
                            className="text-slate-900"
                        />
                    ))}
                    {labelIndexes.map((index) => (
                        <text
                            key={`${points[index].date}-${index}`}
                            x={points[index].x}
                            y={height - 5}
                            textAnchor={
                                index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"
                            }
                            className="fill-slate-400 text-[12px]"
                        >
                            {shortDate(points[index].date)}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
}

function Kpi({
    title,
    value,
    helper,
    icon: Icon,
}: {
    title: string;
    value: string;
    helper: string;
    icon: typeof Activity;
}) {
    return (
        <div className="group rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon size={18} strokeWidth={1.8} />
                </div>
                <span className="text-[11px] text-slate-400">{helper}</span>
            </div>
            <p className="mt-5 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm font-medium text-slate-600">{title}</p>
        </div>
    );
}

export default function InstagramInsights() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountId, setAccountId] = useState("");
    const [range, setRange] = useState<Range>(7);
    const [metric, setMetric] = useState<Metric>("reach");
    const [data, setData] = useState<Data | null>(null);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const loadAccounts = useCallback(async () => {
        try {
            setLoadingAccounts(true);
            const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || "خطا در دریافت اکانت‌ها");
            }

            const list = result.accounts as Account[];
            setAccounts(list);

            const current = list.find((account) => account.id === accountId);
            const connected = list.find((account) => account.isConnected);
            setAccountId(current?.id || connected?.id || list[0]?.id || "");
        } catch (err) {
            setError(err instanceof Error ? err.message : "خطا در دریافت اکانت‌های Instagram");
        } finally {
            setLoadingAccounts(false);
        }
    }, [accountId]);

    const load = useCallback(async (days: Range, selectedAccountId: string) => {
        if (!selectedAccountId) return;

        try {
            setLoading(true);
            setError("");
            const response = await fetch(
                `/api/instagram/insights/history?days=${days}&accountId=${encodeURIComponent(selectedAccountId)}`,
                { cache: "no-store" },
            );
            const result = (await response.json()) as Data & { error?: string };
            if (!response.ok || !result.success) {
                throw new Error(result.error || "خطا در دریافت آمار Instagram");
            }
            setData(result);
        } catch (err) {
            setData(null);
            setError(err instanceof Error ? err.message : "خطا در دریافت آمار Instagram");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccounts();
    }, []);

    useEffect(() => {
        if (accountId) void load(range, accountId);
    }, [accountId, range, load]);

    const summary = data?.summary;
    const latest = data?.latest;

    return (
        <section id="insights" dir="rtl" className="scroll-mt-24 space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-slate-400">
                        <BarChart3 size={14} />
                        INSTAGRAM ANALYTICS
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                        عملکرد پیج
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                        وضعیت، رشد و تعامل پیج‌های متصل را مستقیماً از داشبورد بررسی کنید.
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_6px_24px_rgba(15,23,42,0.03)]">
                        {data?.account.profilePictureUrl ? (
                            <img
                                src={data.account.profilePictureUrl}
                                alt={data.account.username}
                                className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100"
                            />
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
                                {initials(data?.account.username || accounts.find((item) => item.id === accountId)?.username || "IG")}
                            </div>
                        )}

                        <div className="min-w-0">
                            <select
                                value={accountId}
                                onChange={(event) => setAccountId(event.target.value)}
                                disabled={loadingAccounts || !accounts.length}
                                className="max-w-[190px] bg-transparent text-sm font-semibold text-slate-900 outline-none"
                                aria-label="انتخاب پیج Instagram"
                            >
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        @{account.username || "بدون نام"}{account.isConnected ? "" : " — قطع اتصال"}
                                    </option>
                                ))}
                            </select>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className={`h-1.5 w-1.5 rounded-full ${data?.account.isConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
                                {data?.account.isConnected ? "اتصال فعال" : "اتصال غیرفعال"}
                            </div>
                        </div>
                    </div>

                    <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_6px_24px_rgba(15,23,42,0.03)]">
                        {[7, 30, 90].map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => setRange(days as Range)}
                                className={`rounded-xl px-4 py-2.5 text-xs font-medium transition ${range === days ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                            >
                                {days} روز
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>
                    <button type="button" onClick={() => accountId && load(range, accountId)} className="inline-flex shrink-0 items-center gap-1.5 font-medium hover:underline">
                        <RefreshCw size={14} />
                        تلاش مجدد
                    </button>
                </div>
            )}

            {!loadingAccounts && !accounts.length && (
                <div className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <BarChart3 size={24} strokeWidth={1.7} />
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900">هنوز پیجی متصل نشده است</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                        ابتدا یک پیج Professional را متصل کنید تا آمار آن در همین داشبورد نمایش داده شود.
                    </p>
                </div>
            )}

            {loading && !data && (
                <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-400">
                    در حال دریافت آمار پیج...
                </div>
            )}

            {data && summary && (
                <>
                    {!data.account.isConnected && (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            این پیج در حال حاضر متصل نیست؛ داده‌های ذخیره‌شده تاریخی نمایش داده می‌شوند.
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <Kpi title="دسترسی" value={number(summary.reach)} helper={`${range} روز`} icon={Users} />
                        <Kpi title="بازدید" value={number(summary.views)} helper={`${range} روز`} icon={Eye} />
                        <Kpi title="اکانت‌های درگیر" value={number(summary.accountsEngaged)} helper={`${range} روز`} icon={Activity} />
                        <Kpi title="تعاملات" value={number(summary.totalInteractions)} helper={`${range} روز`} icon={Heart} />
                        <Kpi title="بازدید پروفایل" value={number(summary.profileViews)} helper={`${range} روز`} icon={BarChart3} />
                        <Kpi title="دنبال‌کنندگان" value={number(summary.followerCount)} helper={summary.followerGrowth === 0 ? "بدون تغییر" : `${summary.followerGrowth > 0 ? "+" : ""}${number(summary.followerGrowth)}`} icon={TrendingUp} />
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.035)] sm:p-7">
                            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-950">روند عملکرد</h3>
                                    <p className="mt-1 text-xs text-slate-400">تغییرات روزانه در بازه انتخاب‌شده</p>
                                </div>
                                <div className="flex rounded-xl bg-slate-100 p-1">
                                    {([["reach", "دسترسی"], ["views", "بازدید"], ["interactions", "تعاملات"]] as const).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setMetric(value)}
                                            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${metric === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Chart snapshots={data.snapshots} metric={metric} />
                        </div>

                        <aside className="rounded-[26px] bg-slate-950 p-6 text-white shadow-[0_15px_45px_rgba(15,23,42,0.12)]">
                            <div className="flex items-center gap-3">
                                {data.account.profilePictureUrl ? (
                                    <img src={data.account.profilePictureUrl} alt={data.account.username} className="h-12 w-12 rounded-full object-cover ring-2 ring-white/10" />
                                ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{initials(data.account.username)}</div>
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold">@{data.account.username}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">خلاصه عملکرد پیج</p>
                                </div>
                            </div>

                            <div className="mt-7 rounded-2xl bg-white/[0.06] p-4">
                                <p className="text-xs text-slate-400">نرخ تعامل</p>
                                <p className="mt-2 text-3xl font-bold tracking-tight">{percent(summary.engagementRate)}</p>
                            </div>

                            <div className="mt-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                    <span className="text-xs text-slate-400">آخرین دسترسی</span>
                                    <span className="text-sm font-semibold">{number(latest?.reach)}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                    <span className="text-xs text-slate-400">آخرین تعاملات</span>
                                    <span className="text-sm font-semibold">{number(latest?.totalInteractions)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">آخرین ثبت</span>
                                    <span className="text-xs font-medium text-slate-200">{latest ? fullDate(latest.snapshotDate) : "—"}</span>
                                </div>
                            </div>
                        </aside>
                    </div>

                    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.03)]">
                        <div className="flex items-center justify-between px-5 py-5 sm:px-7">
                            <div>
                                <h3 className="text-lg font-bold text-slate-950">تاریخچه روزانه</h3>
                                <p className="mt-1 text-xs text-slate-400">{number(data.snapshots.length)} ثبت در بازه انتخاب‌شده</p>
                            </div>
                            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
                                <MessageCircle size={14} />
                                Snapshotهای ذخیره‌شده
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-right text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-400">
                                    <tr>
                                        <th className="px-5 py-3 font-medium sm:px-7">تاریخ</th>
                                        <th className="px-5 py-3 font-medium">دسترسی</th>
                                        <th className="px-5 py-3 font-medium">بازدید</th>
                                        <th className="px-5 py-3 font-medium">تعاملات</th>
                                        <th className="px-5 py-3 font-medium">اکانت‌های درگیر</th>
                                        <th className="px-5 py-3 font-medium">دنبال‌کنندگان</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[...data.snapshots].reverse().map((snapshot) => (
                                        <tr key={snapshot.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-4 font-medium text-slate-700 sm:px-7">{fullDate(snapshot.snapshotDate)}</td>
                                            <td className="px-5 py-4 text-slate-600">{number(snapshot.reach)}</td>
                                            <td className="px-5 py-4 text-slate-600">{number(snapshot.views)}</td>
                                            <td className="px-5 py-4 text-slate-600">{number(snapshot.totalInteractions)}</td>
                                            <td className="px-5 py-4 text-slate-600">{number(snapshot.accountsEngaged)}</td>
                                            <td className="px-5 py-4 text-slate-600">{number(snapshot.followerCount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
