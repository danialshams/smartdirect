"use client";

import {
  BarChart3,
  Eye,
  RefreshCw,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RangePreset = 7 | 30 | 90;
type Metric = "views" | "totalInteractions" | "follows" | "unfollows";

type Account = {
  id: string;
  igUserId: string;
  username: string;
  isConnected: boolean;
};

type Snapshot = {
  id: string;
  snapshotDate: string;
  views: number | null;
  totalInteractions: number | null;
  follows: number | null;
  unfollows: number | null;
  followerCount?: number | null;
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
    views: number;
    totalInteractions: number;
    follows: number | null;
    unfollows: number | null;
    followerCount?: number;
    followerGrowth?: number;
  };
  latest: Snapshot | null;
  snapshots: Snapshot[];
};

const numberFormatter = new Intl.NumberFormat("fa-IR", {
  useGrouping: false,
});
const percentFormatter = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 2,
});

const metricLabels: Record<Metric, string> = {
  views: "بازدید",
  totalInteractions: "تعاملات",
  follows: "فالو",
  unfollows: "آنفالو",
};

const metricDescriptions: Record<Metric, string> = {
  views: "تعداد دفعات مشاهده ثبت‌شده توسط Meta",
  totalInteractions: "مجموع تعاملات ثبت‌شده توسط Meta",
  follows: "فالوهای ثبت‌شده در بازه",
  unfollows: "آنفالوهای ثبت‌شده در بازه",
};

function formatNumber(value: number | null | undefined) {
  return value == null ? "—" : numberFormatter.format(Math.round(value));
}

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : percentFormatter.format(value) + "٪";
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value > 0) return "+" + percentFormatter.format(value) + "٪";
  if (value < 0) return "−" + percentFormatter.format(Math.abs(value)) + "٪";
  return "۰٪";
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function formatJalaliDate(value: Date) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .format(value)
    .replaceAll("/", ".");
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

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function metricValue(snapshot: Snapshot, metric: Metric) {
  return snapshot[metric];
}

function AnimatedNumber({
  value,
  formatter = formatNumber,
  duration = 900,
}: {
  value: number | null | undefined;
  formatter?: (value: number | null | undefined) => string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setDisplayValue(0);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{formatter(value == null ? null : displayValue)}</>;
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  iconPosition,
}: {
  label: string;
  value: number | null | undefined;
  helper: string;
  icon: typeof BarChart3;
  iconPosition?: "outer" | "inner";
}) {
  const iconPositionClass = iconPosition === "inner" ? "right-0" : "right-5 sm:right-8";

  return (
    <div className="relative flex min-h-[116px] min-w-0 items-center justify-center px-12 py-5 text-center">
      <div className="flex flex-col items-center justify-center">
        <p className="text-lg font-bold leading-none tracking-tight sm:text-xl">
          <AnimatedNumber value={value} />
        </p>
        <p className="mt-3 text-xs font-medium leading-none text-foreground">{label}</p>
        {helper && (
          <p className="mt-2 text-[9px] leading-4 text-muted-foreground">{helper}</p>
        )}
      </div>
      <span className={`absolute ${iconPositionClass} top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground`}>
        <Icon size={17} strokeWidth={1.8} />
      </span>
    </div>
  );
}

function RateMetric({
  label,
  value,
  signed,
  icon: Icon,
  iconPosition,
}: {
  label: string;
  value: number | null | undefined;
  signed?: boolean;
  icon: typeof BarChart3;
  iconPosition?: "outer" | "inner";
}) {
  const positive = value != null && value > 0;
  const negative = value != null && value < 0;
  const iconPositionClass = iconPosition === "inner" ? "right-2 sm:right-4" : "right-5 sm:right-8";

  return (
    <div className="relative flex min-h-[116px] min-w-0 items-center justify-center px-12 py-4 text-center">
      <div className="flex flex-col items-center justify-center">
        <p
          className={[
            "text-xl font-bold leading-none tracking-tight",
            positive ? "text-emerald-600" : "",
            negative ? "text-red-600" : "",
            !positive && !negative ? "text-foreground" : "",
          ].join(" ")}
        >
          {signed ? (
            <AnimatedNumber value={value} formatter={formatSignedPercent} />
          ) : (
            <AnimatedNumber value={value} formatter={formatPercent} />
          )}
        </p>
        <p className="mt-3 text-xs font-medium leading-none text-foreground">{label}</p>
      </div>
      <span className={`absolute ${iconPositionClass} top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground`}>
        <Icon size={17} strokeWidth={1.8} />
      </span>
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
  const [loadingAccounts, setLoadingAccounts] = useState(!externalAccountId);
  const [preset, setPreset] = useState<RangePreset>(30);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: addDays(today, -29),
    to: today,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<"from" | "to">("from");
  const [metric, setMetric] = useState<Metric>("views");

  const minSelectableDate = useMemo(() => {
    const value = new Date(today);
    value.setHours(0, 0, 0, 0);
    value.setFullYear(value.getFullYear() - 2);
    return value;
  }, [today]);

  const maxSelectableDate = useMemo(() => {
    const value = new Date(today);
    value.setHours(23, 59, 59, 999);
    return value;
  }, [today]);
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
      "/api/instagram/insights?accountId=" +
        encodeURIComponent(accountId) +
        "&from=" +
        encodeURIComponent(effectiveRange?.from ?? "") +
        "&to=" +
        encodeURIComponent(effectiveRange?.to ?? ""),
      { cache: "no-store" },
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "خطا در بروزرسانی Instagram Insights");
    }
  }, [accountId, effectiveRange]);

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
    if (externalAccountId) {
      setAccountId(externalAccountId);
      setLoadingAccounts(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "خطا در دریافت اکانت‌های Instagram");
        }

        const accounts = Array.isArray(result.accounts) ? result.accounts : [];
        const connected = accounts.find(
          (account: { id?: string; isConnected?: boolean }) => account.isConnected,
        );

        if (!cancelled) {
          setAccountId(connected?.id || accounts[0]?.id || "");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "خطا در دریافت اکانت Instagram",
          );
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [externalAccountId]);

  useEffect(() => {
    if (!accountId) return;

    void load();

    void (async () => {
      try {
        await syncInsights();
        await load();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "خطا در بروزرسانی Instagram Insights",
        );
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
  }, [load, syncInsights]);

  function selectPreset(value: RangePreset) {
    setPreset(value);
    const end = new Date();
    setRange({
      from: addDays(end, -(value - 1)),
      to: end,
    });
  }

  function openCalendar(target: "from" | "to") {
    setCalendarTarget(target);
    setCalendarOpen(true);
  }

  function selectCalendarDate(value: Date | undefined) {
    if (!value) return;

    setPreset(30);

    setRange((current) => {
      if (calendarTarget === "from") {
        const nextFrom = value < minSelectableDate ? minSelectableDate : value;
        const nextTo =
          current.to && current.to >= nextFrom ? current.to : nextFrom;

        return { from: nextFrom, to: nextTo };
      }

      const nextTo = value > maxSelectableDate ? maxSelectableDate : value;
      const nextFrom =
        current.from && current.from <= nextTo ? current.from : nextTo;

      return { from: nextFrom, to: nextTo };
    });

    setCalendarOpen(false);
  }

  const calendarDisabled = useMemo(() => {
    if (calendarTarget === "from") {
      return {
        before: minSelectableDate,
        after: maxSelectableDate,
      };
    }

    return {
      before: range.from ?? minSelectableDate,
      after: maxSelectableDate,
    };
  }, [calendarTarget, maxSelectableDate, minSelectableDate, range.from]);

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

    const totalViews = data.summary.views;
    const totalInteractions = data.summary.totalInteractions;
    const follows = data.summary.follows;
    const unfollows = data.summary.unfollows;

    return {
      interactionRate:
        totalViews > 0 ? (totalInteractions / totalViews) * 100 : null,
      netFollowerRate:
        totalViews > 0 && follows != null && unfollows != null
          ? ((follows - unfollows) / totalViews) * 100
          : null,
    };
  }, [data]);

  const runRefresh = async () => {
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
  };

  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runRefresh()}
            className="h-10 w-full rounded-xl border-border bg-white px-4 text-xs font-semibold text-foreground shadow-none hover:bg-muted sm:w-fit"
          >
            <RefreshCw size={14} />
            بروزرسانی
          </Button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex w-full rounded-xl border border-border bg-white p-1">
              {[7, 30, 90].map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant={preset === days ? "default" : "ghost"}
                  onClick={() => selectPreset(days as RangePreset)}
                  className={[
                    "h-9 flex-1 rounded-lg px-3 text-xs font-semibold shadow-none sm:flex-none sm:px-4",
                    preset === days
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {days} روز
                </Button>
              ))}
            </div>

            <div className="relative min-w-0 sm:justify-self-end">
              <div className="grid w-full max-w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:max-w-[360px]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openCalendar("from")}
                  className="h-10 min-w-0 w-full rounded-xl border-border bg-white px-2 text-[10px] font-semibold text-foreground shadow-none hover:bg-muted sm:px-3"
                  aria-expanded={calendarOpen && calendarTarget === "from"}
                  aria-haspopup="dialog"
                >
                  {range.from ? formatJalaliDate(range.from) : "تاریخ شروع"}
                </Button>

                <span className="text-[10px] font-medium text-muted-foreground">تا</span>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openCalendar("to")}
                  className="h-10 min-w-0 w-full rounded-xl border-border bg-white px-2 text-[10px] font-semibold text-foreground shadow-none hover:bg-muted sm:px-3"
                  aria-expanded={calendarOpen && calendarTarget === "to"}
                  aria-haspopup="dialog"
                >
                  {range.to ? formatJalaliDate(range.to) : "تاریخ پایان"}
                </Button>
              </div>

              {calendarOpen && (
                <>
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 md:hidden"
                    onClick={() => setCalendarOpen(false)}
                  >
                    <div
                      role="dialog"
                      aria-modal="true"
                      className="rounded-xl border border-border bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Calendar
                        mode="single"
                        selected={range[calendarTarget]}
                        onSelect={selectCalendarDate}
                        disabled={calendarDisabled}
                        startMonth={minSelectableDate}
                        endMonth={maxSelectableDate}
                      />
                    </div>
                  </div>

                  <div className="absolute right-0 top-12 z-50 hidden rounded-xl border border-border bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)] md:block">
                    <Calendar
                      mode="single"
                      selected={range[calendarTarget]}
                      onSelect={selectCalendarDate}
                      disabled={calendarDisabled}
                      startMonth={minSelectableDate}
                      endMonth={maxSelectableDate}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
            {error}
          </div>
        )}

        {(loadingAccounts || (loading && !data)) ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-xl sm:w-28" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
            <Skeleton className="h-[300px] w-full rounded-2xl sm:h-[340px]" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>
        ) : data ? (
          <div className="min-w-0">
            <div className="rounded-2xl border border-border bg-white p-3.5 sm:p-5">
              <div className="flex w-full justify-end overflow-x-auto">
                <div className="flex min-w-max rounded-xl border border-border bg-white p-1">
                  {(["views", "totalInteractions", "follows", "unfollows"] as Metric[]).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={metric === value ? "default" : "ghost"}
                      title={metricDescriptions[value]}
                      onClick={() => setMetric(value)}
                      className={[
                        "h-9 rounded-lg px-3 text-[10px] font-medium shadow-none sm:px-4",
                        metric === value
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      {metricLabels[value]}
                    </Button>
                  ))}
                </div>
              </div>

              {chartData.length ? (
                <div className="mt-5 h-[260px] w-full min-w-0 sm:h-[320px]">
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
                          formatNumber(typeof value === "number" ? value : null),
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
                <div className="mt-5 flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground sm:h-[320px]">
                  برای این بازه داده تاریخی ثبت نشده است.
                </div>
              )}
            </div>

            <div className="relative mt-4 overflow-hidden bg-white">
              <div className="pointer-events-none absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-border" />
              <div className="pointer-events-none absolute inset-x-5 top-1/3 h-px -translate-y-1/2 bg-border sm:inset-x-8" />
              <div className="pointer-events-none absolute inset-x-5 top-2/3 h-px -translate-y-1/2 bg-border sm:inset-x-8" />

              <div className="grid grid-cols-2 grid-rows-3">
                <RateMetric
                  label="نرخ تعامل"
                  value={rates?.interactionRate}
                  icon={BarChart3}
                  iconPosition="outer"
                />
                <RateMetric
                  label="نرخ رشد خالص"
                  value={rates?.netFollowerRate}
                  signed
                  icon={UserPlus}
                  iconPosition="inner"
                />

                <MetricCard
                  label="بازدید"
                  value={data.summary.views}
                  helper=""
                  icon={Eye}
                />
                <MetricCard
                  label="تعاملات"
                  value={data.summary.totalInteractions}
                  helper=""
                  icon={BarChart3}
                  iconPosition="inner"
                />

                <MetricCard
                  label="فالو"
                  value={data.summary.follows}
                  helper={data.summary.follows == null ? "داده از Meta در دسترس نیست" : ""}
                  icon={UserPlus}
                />
                <MetricCard
                  label="آنفالو"
                  value={data.summary.unfollows}
                  helper={data.summary.unfollows == null ? "داده از Meta در دسترس نیست" : ""}
                  icon={UserMinus}
                  iconPosition="inner"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-5 py-16 text-center text-sm text-muted-foreground">
            داده‌ای برای نمایش وجود ندارد.
          </div>
        )}
      </div>
    </section>
  );
}
