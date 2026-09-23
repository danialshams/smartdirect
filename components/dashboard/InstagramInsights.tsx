"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Eye,
  Link2,
  RefreshCw,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker/persian";
import type { DateRange } from "react-day-picker";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RangePreset = 7 | 30 | 90 | "custom";
type Metric =
  | "reach"
  | "views"
  | "accountsEngaged"
  | "totalInteractions"
  | "follows"
  | "unfollows"
  | "profileLinksTaps"
  | "followerCount";

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
  follows: number | null;
  unfollows: number | null;
  profileLinksTaps: number | null;
  followerCount: number | null;
};

type Data = {
  success: boolean;
  account: Account;
  period: {
    days: number;
    from: string;
    to: string;
  };
  summary: {
    reach: number;
    views: number;
    accountsEngaged: number;
    totalInteractions: number;
    follows: number | null;
    unfollows: number | null;
    profileLinksTaps: number | null;
    followerCount: number;
    followerGrowth: number;
    engagementRate: number | null;
  };
  latest: Snapshot | null;
  snapshots: Snapshot[];
};

const numberFormatter = new Intl.NumberFormat("fa-IR");
const percentFormatter = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 2,
});

const metricLabels: Record<Metric, string> = {
  reach: "دسترسی",
  views: "بازدید",
  accountsEngaged: "اکانت‌های درگیر",
  totalInteractions: "تعاملات",
  follows: "فالو",
  unfollows: "آنفالو",
  profileLinksTaps: "کلیک‌های پروفایل",
  followerCount: "تعداد فالوورها",
};

const metricDescriptions: Record<Metric, string> = {
  reach: "تعداد اکانت‌های رسیده در هر روز",
  views: "تعداد بازدیدهای ثبت‌شده در هر روز",
  accountsEngaged: "اکانت‌هایی که با محتوا تعامل داشته‌اند",
  totalInteractions: "مجموع تعاملات ثبت‌شده",
  follows: "فالوهای ثبت‌شده در روز",
  unfollows: "آنفالوهای ثبت‌شده در روز",
  profileLinksTaps: "تپ روی آدرس، تماس، ایمیل یا پیام پروفایل",
  followerCount: "تعداد فالوور در زمان ثبت Snapshot",
};

function formatNumber(value: number | null | undefined) {
  return value == null ? "—" : numberFormatter.format(Math.round(value));
}

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : percentFormatter.format(value) + "٪";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function fromIsoDate(value: string) {
  return new Date(value + "T12:00:00");
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function metricValue(snapshot: Snapshot, metric: Metric) {
  return snapshot[metric];
}

function RangeCalendar({
  range,
  onChange,
  onClose,
}: {
  range: DateRange;
  onChange: (range: DateRange | undefined) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+10px)] z-40 w-[min(92vw,360px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={onChange}
        defaultMonth={range.from}
        disabled={{ after: new Date() }}
        max={365}
        dir="rtl"
        className="mx-auto"
        showOutsideDays
      />
      <div className="mt-2 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400">بازه انتخاب‌شده</p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-800">
              {range.from && range.to
                ? formatDate(range.from.toISOString()) +
                  " تا " +
                  formatDate(range.to.toISOString())
                : "تاریخ پایان را انتخاب کنید"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!range.from || !range.to}
            className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            اعمال
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="text-right text-[9px] leading-4 text-slate-400">{helper}</span>
      </div>
      <p className="mt-3 truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function RateCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3.5 py-3">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 truncate text-[9px] text-slate-400">{helper}</p>
    </div>
  );
}

export default function InstagramInsights({
  accountId: externalAccountId,
}: {
  accountId?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const [accountId, setAccountId] = useState(externalAccountId || "");
  const [preset, setPreset] = useState<RangePreset>(30);
  const [range, setRange] = useState<DateRange>({
    from: addDays(today, -29),
    to: today,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [metric, setMetric] = useState<Metric>("reach");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const effectiveRange = useMemo(() => {
    if (!range.from || !range.to) return null;

    return {
      from: toIsoDate(range.from),
      to: toIsoDate(range.to),
    };
  }, [range]);

  const syncInsights = useCallback(async () => {
    if (!accountId) return;

    const response = await fetch(
      "/api/instagram/insights?accountId=" + encodeURIComponent(accountId),
      { cache: "no-store" },
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "خطا در بروزرسانی Instagram Insights");
    }
  }, [accountId]);

  const load = useCallback(async () => {
    if (!accountId || !effectiveRange) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/instagram/insights/history?from=" +
          encodeURIComponent(effectiveRange.from) +
          "&to=" +
          encodeURIComponent(effectiveRange.to) +
          "&accountId=" +
          encodeURIComponent(accountId),
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "خطا در دریافت آمار پیج");
      }

      setData(result as Data);
    } catch (requestError) {
      setData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "خطا در دریافت آمار پیج",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, effectiveRange]);

  useEffect(() => {
    if (externalAccountId) setAccountId(externalAccountId);
  }, [externalAccountId]);

  useEffect(() => {
    if (!accountId) return;

    void (async () => {
      try {
        await syncInsights();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "خطا در بروزرسانی Instagram Insights",
        );
      } finally {
        await load();
      }
    })();
  }, [accountId, syncInsights, load]);

  useEffect(() => {
    const handler = () => {
      void (async () => {
        try {
          await syncInsights();
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "خطا در بروزرسانی Instagram Insights",
          );
        } finally {
          await load();
        }
      })();
    };
    window.addEventListener("smartdirect:refresh", handler);
    return () => window.removeEventListener("smartdirect:refresh", handler);
  }, [load]);

  function selectPreset(value: Exclude<RangePreset, "custom">) {
    setPreset(value);
    const end = new Date();
    setRange({
      from: addDays(end, -(value - 1)),
      to: end,
    });
    setCalendarOpen(false);
  }

  function selectCustomRange(next: DateRange | undefined) {
    setRange(next || {});
    setPreset("custom");

    if (next?.from && next.to) {
      const days =
        Math.floor(
          (new Date(toIsoDate(next.to)).getTime() -
            new Date(toIsoDate(next.from)).getTime()) /
            86400000,
        ) + 1;

      if (days > 365) return;
    }
  }

  const chartData = useMemo(
    () =>
      (data?.snapshots ?? []).map((snapshot) => ({
        date: snapshot.snapshotDate,
        label: formatShortDate(snapshot.snapshotDate),
        value: metricValue(snapshot, metric),
      })),
    [data?.snapshots, metric],
  );

  const rates = useMemo(() => {
    if (!data) return null;

    const average = (key: "reach" | "accountsEngaged" | "totalInteractions" | "profileLinksTaps") => {
      const values = data.snapshots
        .map((snapshot) => snapshot[key])
        .filter((value): value is number => value != null);

      return values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null;
    };

    const reach = average("reach");
    const engaged = average("accountsEngaged");
    const interactions = average("totalInteractions");
    const profileLinks = average("profileLinksTaps");

    return {
      engagementRate:
        reach && engaged != null ? (engaged / reach) * 100 : data.summary.engagementRate,
      interactionRate:
        reach && interactions != null ? (interactions / reach) * 100 : null,
      profileLinkRate:
        reach && profileLinks != null ? (profileLinks / reach) * 100 : null,
      netFollowerGrowth:
        data.summary.follows != null && data.summary.unfollows != null
          ? data.summary.follows - data.summary.unfollows
          : data.summary.followerGrowth,
    };
  }, [data]);

  return (
    <section className="min-w-0 overflow-visible rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">تحلیل پیج</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
              روند عملکرد Instagram
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-500">
              شاخص‌های عملکرد اکانت فعال را در یک بازه مشخص بررسی کنید.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => selectPreset(days as 7 | 30 | 90)}
                  className={[
                    "shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition sm:px-3.5",
                    preset === days
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:bg-white hover:text-slate-800",
                  ].join(" ")}
                >
                  {days} روز
                </button>
              ))}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setCalendarOpen((open) => !open)}
                className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300"
                aria-expanded={calendarOpen}
              >
                <CalendarDays size={15} className="shrink-0 text-slate-400" />
                <span className="max-w-[150px] truncate">
                  {range.from && range.to
                    ? formatDate(range.from.toISOString()) +
                      " — " +
                      formatDate(range.to.toISOString())
                    : "انتخاب بازه"}
                </span>
                <ChevronDown
                  size={14}
                  className={calendarOpen ? "rotate-180 transition" : "transition"}
                />
              </button>

              {calendarOpen && (
                <RangeCalendar
                  range={range}
                  onChange={selectCustomRange}
                  onClose={() => setCalendarOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 sm:mx-6">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
          <div className="mt-4 h-[280px] animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : data ? (
        <div className="min-w-0 p-4 sm:p-5 lg:p-6">
          <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-slate-400">اکانت فعال</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                @{data.account.username}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void (async () => {
                  try {
                    await syncInsights();
                  } catch (requestError) {
                    setError(
                      requestError instanceof Error
                        ? requestError.message
                        : "خطا در بروزرسانی Instagram Insights",
                    );
                  } finally {
                    await load();
                  }
                })()
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw size={13} />
              بروزرسانی
            </button>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <MetricCard
              label="دسترسی"
              value={formatNumber(data.summary.reach)}
              helper="میانگین روزانه"
              icon={Eye}
            />
            <MetricCard
              label="بازدید"
              value={formatNumber(data.summary.views)}
              helper="در بازه انتخابی"
              icon={BarChart3}
            />
            <MetricCard
              label="اکانت‌های درگیر"
              value={formatNumber(data.summary.accountsEngaged)}
              helper="در بازه انتخابی"
              icon={Users}
            />
            <MetricCard
              label="تعاملات"
              value={formatNumber(data.summary.totalInteractions)}
              helper="در بازه انتخابی"
              icon={BarChart3}
            />
            <MetricCard
              label="فالو / آنفالو"
              value={
                data.summary.follows == null || data.summary.unfollows == null
                  ? "—"
                  : formatNumber(
                      data.summary.follows - data.summary.unfollows,
                    )
              }
              helper={
                data.summary.follows == null || data.summary.unfollows == null
                  ? "داده از Meta در دسترس نیست"
                  : formatNumber(data.summary.follows) +
                    " فالو / " +
                    formatNumber(data.summary.unfollows) +
                    " آنفالو"
              }
              icon={UserPlus}
            />
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard
              label="کلیک‌های پروفایل"
              value={formatNumber(data.summary.profileLinksTaps)}
              helper="آدرس، تماس، ایمیل یا پیام"
              icon={Link2}
            />
            <MetricCard
              label="فالوور فعلی"
              value={formatNumber(data.summary.followerCount)}
              helper="آخرین Snapshot"
              icon={Users}
            />
            <MetricCard
              label="رشد فالوور"
              value={formatNumber(data.summary.followerGrowth)}
              helper="تغییر بین ابتدا و انتهای بازه"
              icon={UserMinus}
            />
          </div>

          <div className="mt-5 min-w-0 rounded-xl border border-slate-200 p-3.5 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-950">
                    روند روزانه
                  </h3>
                  <p className="mt-1 text-[10px] leading-5 text-slate-400">
                    محور افقی تاریخ روزهای بازه است؛ با انتخاب شاخص، روند همان
                    شاخص نمایش داده می‌شود.
                  </p>
                </div>
                <div className="w-full overflow-x-auto sm:w-auto sm:max-w-full">
                  <div className="flex min-w-max rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {(
                      [
                        "reach",
                        "views",
                        "accountsEngaged",
                        "totalInteractions",
                        "follows",
                        "unfollows",
                        "profileLinksTaps",
                        "followerCount",
                      ] as Metric[]
                    ).map((value) => (
                      <button
                        key={value}
                        type="button"
                        title={metricDescriptions[value]}
                        onClick={() => setMetric(value)}
                        className={[
                          "rounded-md px-2.5 py-1.5 text-[10px] font-medium transition",
                          metric === value
                            ? "bg-slate-950 text-white"
                            : "text-slate-500 hover:bg-white hover:text-slate-800",
                        ].join(" ")}
                      >
                        {metricLabels[value]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {chartData.length ? (
                <div className="h-[250px] w-full min-w-0 sm:h-[290px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 4, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#eef2f7"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatShortDate}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tickFormatter={(value) => numberFormatter.format(value)}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        allowDecimals={false}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatDate(String(value))}
                        formatter={(value) => [
                          formatNumber(
                            typeof value === "number" ? value : null,
                          ),
                          metricLabels[metric],
                        ]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
                          fontFamily: "Vazirmatn, Arial, sans-serif",
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#0f172a"
                        strokeWidth={2.5}
                        dot={{ r: 2.5, strokeWidth: 1 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  برای این بازه داده تاریخی ثبت نشده است.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 min-w-0 rounded-xl border border-slate-200 p-3.5 sm:p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-950">
                نرخ‌های عملکرد
              </h3>
              <p className="mt-1 text-[10px] text-slate-400">
                همه نرخ‌ها فقط در این بخش محاسبه می‌شوند و با تغییر بازه به‌روزرسانی می‌شوند.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <RateCard
                label="نرخ اکانت‌های درگیر"
                value={formatPercent(rates?.engagementRate)}
                helper="اکانت‌های درگیر نسبت به دسترسی"
              />
              <RateCard
                label="نرخ تعامل"
                value={formatPercent(rates?.interactionRate)}
                helper="تعاملات نسبت به دسترسی"
              />
              <RateCard
                label="رشد خالص فالوور"
                value={formatNumber(rates?.netFollowerGrowth)}
                helper="فالو منهای آنفالو"
              />
              <RateCard
                label="کلیک پروفایل نسبت به دسترسی"
                value={
                  rates?.profileLinkRate != null
                    ? formatPercent(rates.profileLinkRate)
                    : "—"
                }
                helper="بر اساس داده‌های موجود Meta"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-16 text-center text-sm text-slate-400">
          داده‌ای برای نمایش وجود ندارد.
        </div>
      )}
    </section>
  );
}
