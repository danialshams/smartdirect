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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  account: Account & {
  };
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
    <Card className="min-w-0 py-3.5 sm:py-4">
      <CardContent className="px-3.5 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <span className="text-right text-[9px] leading-4 text-muted-foreground">{helper}</span>
        </div>
        <p className="mt-3 truncate text-lg font-bold tracking-tight sm:text-xl">{value}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
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
    <Card className="min-w-0 border-0 bg-muted px-3.5 py-3 shadow-none">
      <CardContent className="p-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-base font-bold">{value}</p>
        <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
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

    // اول داده ذخیره‌شده را نمایش بده؛ بروزرسانی Meta نباید رندر صفحه را معطل کند.
    void load();

    void (async () => {
      try {
        await syncInsights();
        await load();
      } catch (requestError) {
        // اگر Sync با Meta خطا داد، داده تاریخی همچنان باید قابل نمایش باشد.
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
  }, [load]);
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
      followRate:
        totalViews > 0 && follows != null ? (follows / totalViews) * 100 : null,
      unfollowRate:
        totalViews > 0 && unfollows != null ? (unfollows / totalViews) * 100 : null,
      netFollowerRate:
        totalViews > 0 && follows != null && unfollows != null
          ? ((follows - unfollows) / totalViews) * 100
          : null,
    };
  }, [data]);

  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
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

            <div className="relative min-w-0">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
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
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted sm:w-28" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="h-[300px] animate-pulse rounded-2xl bg-muted sm:h-[340px]" />
            <div className="h-[180px] animate-pulse rounded-2xl bg-muted" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
              ))}
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
                    <LineChart data={chartData} margin={{ top: 12, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
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

            <div className="mt-4 rounded-2xl border border-border bg-white p-3.5 sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <RateCard label="نرخ تعامل" value={formatPercent(rates?.interactionRate)} helper="تعاملات نسبت به بازدید" />
                <RateCard label="نرخ فالو" value={formatPercent(rates?.followRate)} helper="فالو نسبت به بازدید" />
                <RateCard label="نرخ آنفالو" value={formatPercent(rates?.unfollowRate)} helper="آنفالو نسبت به بازدید" />
                <RateCard label="نرخ رشد خالص" value={formatPercent(rates?.netFollowerRate)} helper="فالو منهای آنفالو نسبت به بازدید" />
              </div>
            </div>

            <div className="mt-4">
              <h2 className="mb-3 text-sm font-bold text-foreground">مجموع بازه انتخابی</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="بازدید" value={formatNumber(data.summary.views)} helper="مجموع بازه انتخابی" icon={Eye} />
                <MetricCard label="تعاملات" value={formatNumber(data.summary.totalInteractions)} helper="مجموع بازه انتخابی" icon={BarChart3} />
                <MetricCard
                  label="فالو"
                  value={formatNumber(data.summary.follows)}
                  helper={data.summary.follows == null ? "داده از Meta در دسترس نیست" : "مجموع بازه انتخابی"}
                  icon={UserPlus}
                />
                <MetricCard
                  label="آنفالو"
                  value={formatNumber(data.summary.unfollows)}
                  helper={data.summary.unfollows == null ? "داده از Meta در دسترس نیست" : "مجموع بازه انتخابی"}
                  icon={UserMinus}
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
  )

}
