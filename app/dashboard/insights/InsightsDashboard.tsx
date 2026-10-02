"use client";

import {
  Activity,
  BarChart3,
  Calendar as CalendarIcon,
  ChevronDown,
  Eye,
  HeartHandshake,
  LoaderCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UserRoundPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/dashboard/DashboardUI";

type Range = 7 | 30 | 90;
type Metric = "reach" | "views" | "interactions" | "accountsEngaged";

type Account = { id: string; igUserId: string; username: string; isConnected: boolean };
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

const n = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("fa-IR").format(Math.round(value));

const date = (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fa-IR", options || { month: "short", day: "numeric" }).format(
    typeof value === "string" ? new Date(value) : value,
  );

function metricValue(snapshot: Snapshot, metric: Metric) {
  if (metric === "reach") return snapshot.reach ?? 0;
  if (metric === "views") return snapshot.views ?? 0;
  if (metric === "interactions") return snapshot.totalInteractions ?? 0;
  return snapshot.accountsEngaged ?? 0;
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center gap-2">
      <div
        className="h-[34px] w-[34px] rounded-full border-[3px] border-[#E2E8F0] border-t-[#2563EB]"
        style={{ animation: "sdDashboardSpin 800ms linear infinite" }}
      />
      <span className="text-[11px] text-[#64748B]">{label}</span>
      <style jsx global>{`
        @keyframes sdDashboardSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-5 lg:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
          <Icon className="h-[17px] w-[17px]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#0F172A] sm:text-[15px]">{title}</h2>
          {description && <p className="mt-0.5 text-[10px] leading-5 text-[#64748B] sm:text-[11px]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | null;
  icon: ElementType;
  tone: "blue" | "purple" | "green" | "slate";
  active: boolean;
  onClick: () => void;
}) {
  const palette = {
    blue: ["#EFF6FF", "#DBEAFE", "#2563EB"],
    purple: ["#F5F3FF", "#EDE9FE", "#7C3AED"],
    green: ["#F0FDF4", "#DCFCE7", "#16A34A"],
    slate: ["#F8FAFC", "#E2E8F0", "#64748B"],
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-[18px] border p-3 text-right transition-all active:scale-[0.99] lg:hover:-translate-y-0.5"
      style={{ background: active ? palette[0] : "#FFFFFF", borderColor: active ? palette[1] : "#E2E8F0" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-medium text-[#64748B] sm:text-[11px]">{label}</span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: active ? palette[2] : palette[0], color: active ? "#FFFFFF" : palette[2] }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-[20px] font-bold tracking-tight text-[#0F172A] sm:text-[22px]">{n(value)}</div>
    </button>
  );
}

function Trend({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#94A3B8]">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "inline-flex items-center gap-1 text-xs font-bold text-[#16A34A]" : "inline-flex items-center gap-1 text-xs font-bold text-[#DC2626]"}>
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {n(Math.abs(value))}٪
    </span>
  );
}

function Chart({ snapshots, metric }: { snapshots: Snapshot[]; metric: Metric }) {
  const [active, setActive] = useState<{ x: number; y: number; value: number; date: string } | null>(null);
  const width = 820;
  const height = 245;
  const pad = 24;

  const points = useMemo(() => {
    if (!snapshots.length) return [];
    const values = snapshots.map((s) => metricValue(s, metric));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);
    return snapshots.map((s, i) => {
      const value = metricValue(s, metric);
      const x = snapshots.length === 1 ? width / 2 : pad + (i / (snapshots.length - 1)) * (width - pad * 2);
      const y = height - 28 - ((value - min) / range) * (height - 56);
      return { x, y, value, date: s.snapshotDate };
    });
  }, [snapshots, metric]);

  const path = useMemo(() => {
    if (!points.length) return "";
    return points.reduce((result, point, i) => {
      if (i === 0) return "M " + point.x.toFixed(1) + "," + point.y.toFixed(1);
      const previous = points[i - 1];
      const cx = ((previous.x + point.x) / 2).toFixed(1);
      return result + " C " + cx + "," + previous.y.toFixed(1) + " " + cx + "," + point.y.toFixed(1) + " " + point.x.toFixed(1) + "," + point.y.toFixed(1);
    }, "");
  }, [points]);

  if (!points.length) return <div className="flex h-52 items-center justify-center rounded-2xl bg-[#F8FAFC] text-xs text-[#64748B]">برای این بازه داده‌ای ثبت نشده است.</div>;

  const area = path + " L " + points[points.length - 1].x.toFixed(1) + "," + height + " L " + points[0].x.toFixed(1) + "," + height + " Z";
  const labels = points.filter((_, i) => i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1);

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg viewBox={"0 0 " + width + " " + height} className="h-[220px] w-full min-w-[560px] sm:h-[245px] sm:min-w-0" onMouseLeave={() => setActive(null)}>
          <defs>
            <linearGradient id="smartDirectInsightsArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.2, 0.4, 0.6, 0.8].map((r) => (
            <line key={r} x1={pad} x2={width - pad} y1={height * r} y2={height * r} stroke="#E2E8F0" strokeDasharray="4 5" />
          ))}
          <path d={area} fill="url(#smartDirectInsightsArea)" />
          <path d={path} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
          {points.map((point) => (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r={active?.date === point.date ? 6 : 3.5}
              fill={active?.date === point.date ? "#2563EB" : "#FFFFFF"}
              stroke="#2563EB"
              strokeWidth="2"
              onMouseEnter={() => setActive(point)}
            />
          ))}
          {labels.map((point, i) => (
            <text key={point.date + "-label"} x={point.x} y={height - 6} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-[#64748B] text-[11px]">
              {date(point.date)}
            </text>
          ))}
        </svg>
      </div>
      {active && (
        <div className="pointer-events-none absolute -top-1 z-10 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 shadow-lg" style={{ left: (active.x / width) * 100 + "%", transform: "translateX(-50%) translateY(-100%)" }}>
          <div className="text-[10px] text-[#64748B]">{date(active.date, { dateStyle: "long" })}</div>
          <div className="mt-0.5 text-xs font-bold text-[#0F172A]">{n(active.value)}</div>
        </div>
      )}
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
  const calendarRef = useRef<HTMLDivElement>(null);

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
        setError(e instanceof Error ? e.message : "خطا در ارتباط با سرور");
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, []);

  const load = useCallback(async (days: Range, id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/instagram/insights/history?days=" + days + "&accountId=" + encodeURIComponent(id), { cache: "no-store" });
      const result = (await response.json()) as Data;
      if (!response.ok || !result.success) throw new Error(result.error || "خطا در دریافت آمار");
      setData(result);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accountId) void load(dateRange?.from ? 90 : range, accountId);
  }, [accountId, range, dateRange?.from, load]);

  const snapshots = data?.snapshots ?? [];
  const summary = data?.summary;
  const visibleSnapshots = useMemo(() => {
    if (!dateRange?.from) return snapshots;
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to ?? dateRange.from);
    to.setHours(23, 59, 59, 999);
    return snapshots.filter((s) => {
      const d = new Date(s.snapshotDate);
      return d >= from && d <= to;
    });
  }, [snapshots, dateRange]);

  const tabs: { id: Metric; label: string; icon: ElementType }[] = [
    { id: "reach", label: "دسترسی", icon: Users },
    { id: "views", label: "بازدید", icon: Eye },
    { id: "interactions", label: "تعاملات", icon: HeartHandshake },
    { id: "accountsEngaged", label: "اکانت‌های درگیر", icon: UserCheck },
  ];
  const selectedLabel = tabs.find((tab) => tab.id === metric)?.label || "دسترسی";

  return (
    <main dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-16 pt-1 sm:pb-16 sm:pt-2 lg:pb-6 lg:pt-2">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-2 sm:gap-4 sm:px-3 lg:gap-5 lg:px-5">
        <header className="rounded-[22px] border border-[#E2E8F0] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                <BarChart3 className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold text-[#0F172A] sm:text-base">تحلیل پیج</h1>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#64748B]">
                  <span dir="ltr" className="truncate font-medium">{data?.account?.username ? "@" + data.account.username : "Instagram"}</span>
                  {data?.account?.isConnected && <span className="rounded-full bg-[#F0FDF4] px-1.5 py-0.5 text-[9px] font-bold text-[#16A34A]">متصل</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              {loadingAccounts ? (
                <div className="flex h-9 items-center justify-center rounded-xl border border-[#E2E8F0] px-4">
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#2563EB]" />
                </div>
              ) : accounts.length > 0 ? (
                <label className="flex h-9 min-w-0 items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 lg:min-w-[210px]">
                  <span className="text-[10px] text-[#64748B]">پیج</span>
                  <select
                    value={accountId}
                    onChange={(e) => { setDateRange(undefined); setAccountId(e.target.value); }}
                    className="min-w-0 flex-1 bg-transparent text-left text-xs font-bold text-[#0F172A] outline-none"
                    dir="ltr"
                  >
                    {accounts.map((account) => <option key={account.id} value={account.id}>{"@" + account.username + (account.isConnected ? "" : " (قطع اتصال)")}</option>)}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </label>
              ) : null}

              <div className="flex items-center gap-1 rounded-xl bg-[#F8FAFC] p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => { setDateRange(undefined); setRange(days as Range); }}
                    className={range === days && !dateRange ? "flex-1 rounded-lg bg-[#2563EB] px-3 py-2 text-[10px] font-bold text-white shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-[10px] font-bold text-[#64748B]"}
                  >
                    {days} روز
                  </button>
                ))}
              </div>

              <div ref={calendarRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCalendarOpen((v) => !v)}
                  className={dateRange?.from ? "flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#2563EB] bg-[#EFF6FF] px-3 text-[10px] font-bold text-[#2563EB] lg:w-auto" : "flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 text-[10px] font-bold text-[#64748B] lg:w-auto"}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>{dateRange?.from ? date(dateRange.from) + (dateRange.to ? " تا " + date(dateRange.to) : " تا...") : "بازه دلخواه"}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {calendarOpen && (
                  <div className="absolute left-0 top-11 z-50 rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)] sm:left-auto sm:right-0">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(value: DateRange | undefined) => {
                        setDateRange(value);
                        if (value?.from && value?.to) setCalendarOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-6 text-[#B91C1C]">{error}</div>}

        <Section title="خلاصه عملکرد" description={dateRange?.from ? "آمار بازه انتخاب‌شده" : "آمار " + range + " روز اخیر"} icon={Activity}>
          {loading ? <Spinner label="در حال دریافت خلاصه عملکرد..." /> : summary ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:gap-4">
              <MetricCard label="دسترسی" value={summary.reach} icon={Users} tone="blue" active={metric === "reach"} onClick={() => setMetric("reach")} />
              <MetricCard label="بازدید" value={summary.views} icon={Eye} tone="purple" active={metric === "views"} onClick={() => setMetric("views")} />
              <MetricCard label="تعاملات" value={summary.totalInteractions} icon={HeartHandshake} tone="green" active={metric === "interactions"} onClick={() => setMetric("interactions")} />
              <MetricCard label="اکانت‌های درگیر" value={summary.accountsEngaged} icon={UserCheck} tone="slate" active={metric === "accountsEngaged"} onClick={() => setMetric("accountsEngaged")} />
            </div>
          ) : <div className="py-6 text-center text-xs text-[#64748B]">داده‌ای برای نمایش وجود ندارد.</div>}
        </Section>

        <Section title={"روند " + selectedLabel} description="شاخص موردنظر را انتخاب کنید و روند آن را ببینید." icon={BarChart3}>
          {loading ? <Spinner label="در حال آماده‌سازی نمودار..." /> : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-[#F8FAFC] p-1 sm:grid-cols-4">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.id} type="button" onClick={() => setMetric(tab.id)} className={metric === tab.id ? "flex items-center justify-center gap-1.5 rounded-xl bg-white px-2 py-2.5 text-[10px] font-bold text-[#2563EB] shadow-sm ring-1 ring-[#DBEAFE]" : "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-bold text-[#64748B]"}>
                      <Icon className="h-3.5 w-3.5" />{tab.label}
                    </button>
                  );
                })}
              </div>
              <Chart snapshots={visibleSnapshots} metric={metric} />
            </>
          )}
        </Section>

        <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <Section title="بازدید پروفایل" icon={Eye}>
            {loading ? <Spinner label="در حال دریافت..." /> : <div className="flex items-end justify-between"><div><div className="text-2xl font-bold text-[#0F172A]">{n(summary?.profileViews)}</div><div className="mt-1 text-[10px] text-[#64748B]">بازدید از پروفایل</div></div><Eye className="h-5 w-5 text-[#7C3AED]" /></div>}
          </Section>
          <Section title="رشد فالوور" icon={UserRoundPlus}>
            {loading ? <Spinner label="در حال دریافت..." /> : <div className="flex items-end justify-between"><div><div className="text-2xl font-bold text-[#0F172A]">{n(summary?.followerCount)}</div><div className="mt-1"><Trend value={summary?.followerGrowth ?? null} /></div></div><UserRoundPlus className="h-5 w-5 text-[#16A34A]" /></div>}
          </Section>
          <Section title="نرخ تعامل" icon={HeartHandshake}>
            {loading ? <Spinner label="در حال دریافت..." /> : <div className="flex items-end justify-between"><div><div className="text-2xl font-bold text-[#0F172A]">{summary?.engagementRate == null ? "—" : new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(summary.engagementRate) + "٪"}</div><div className="mt-1 text-[10px] text-[#64748B]">بر اساس داده‌های موجود</div></div><HeartHandshake className="h-5 w-5 text-[#2563EB]" /></div>}
          </Section>
        </section>

        <Section title="تاریخچه روزانه" description="جزئیات عملکرد روزهای ثبت‌شده در بازه انتخابی." icon={RefreshCw}>
          {loading ? <Spinner label="در حال دریافت تاریخچه..." /> : visibleSnapshots.length ? (
            <>
              <div className="flex flex-col gap-2 sm:hidden">
                {[...visibleSnapshots].reverse().map((s) => (
                  <div key={s.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="text-xs font-bold text-[#0F172A]">{date(s.snapshotDate, { weekday: "long", day: "numeric", month: "long" })}</div><div className="mt-1 text-[10px] text-[#64748B]">دسترسی {n(s.reach)}</div></div>
                      <div className="text-left"><div className="text-xs font-bold text-[#2563EB]">{n(s.totalInteractions)}</div><div className="mt-1 text-[10px] text-[#64748B]">تعامل</div></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3 text-[10px]">
                      <div className="flex items-center justify-between"><span className="text-[#64748B]">بازدید</span><strong className="text-[#0F172A]">{n(s.views)}</strong></div>
                      <div className="flex items-center justify-between"><span className="text-[#64748B]">اکانت درگیر</span><strong className="text-[#0F172A]">{n(s.accountsEngaged)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[620px] text-right text-xs">
                  <thead><tr className="border-b border-[#E2E8F0] text-[#64748B]"><th className="pb-3 font-semibold">تاریخ</th><th className="pb-3 font-semibold">دسترسی</th><th className="pb-3 font-semibold">بازدید</th><th className="pb-3 font-semibold">اکانت درگیر</th><th className="pb-3 font-semibold">تعاملات</th></tr></thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {[...visibleSnapshots].reverse().map((s) => <tr key={s.id} className="text-[#64748B] hover:bg-[#F8FAFC]"><td className="py-3 font-medium text-[#0F172A]">{date(s.snapshotDate, { dateStyle: "long" })}</td><td className="py-3">{n(s.reach)}</td><td className="py-3">{n(s.views)}</td><td className="py-3">{n(s.accountsEngaged)}</td><td className="py-3 font-bold text-[#0F172A]">{n(s.totalInteractions)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="py-8 text-center text-xs text-[#64748B]">برای این بازه snapshot ثبت نشده است.</div>}
        </Section>
      </div>
    </main>
  );
}
