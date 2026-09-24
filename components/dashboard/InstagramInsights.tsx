"use client";

import {
  BarChart3,
  CalendarDays,
  Eye,
  RefreshCw,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    analyticsStartDate?: string;
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

function normalizeDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

type JalaliDate = {
  year: number;
  month: number;
  day: number;
};

const jalaliMonthNames = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function gregorianToJalali(date: Date): JalaliDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const gy2 = gm > 2 ? gy + 1 : gy;

  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd;

  for (let i = 0; i < gm - 1; i++) {
    days += gDaysInMonth[i];
  }

  const jalaliYearBase = -1595 + 33 * Math.floor(days / 12053);
  let remaining = days % 12053;
  let jalaliYear = jalaliYearBase + 4 * Math.floor(remaining / 1461);

  remaining %= 1461;

  if (remaining > 365) {
    jalaliYear += Math.floor((remaining - 1) / 365);
    remaining = (remaining - 1) % 365;
  }

  const jalaliMonth =
    remaining < 186
      ? 1 + Math.floor(remaining / 31)
      : 7 + Math.floor((remaining - 186) / 30);
  const jalaliDay =
    1 +
    (remaining < 186
      ? remaining % 31
      : (remaining - 186) % 30);

  return { year: jalaliYear, month: jalaliMonth, day: jalaliDay };
}

function jalaliToGregorian(jalali: JalaliDate) {
  const jy = jalali.year - 979;
  const jm = jalali.month - 1;
  const jd = jalali.day - 1;

  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4);

  for (let i = 0; i < jm; i++) {
    days += i < 6 ? 31 : 30;
  }

  days += jd;

  let gy = 1600 + 400 * Math.floor(days / 146097);
  days %= 146097;

  let leap = true;

  if (days >= 36525) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;

    if (days >= 365) {
      days++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days >= 366) {
    leap = false;
    days--;
    gy += Math.floor(days / 365);
    days %= 365;
  }

  let gm = 0;
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  while (gm < 12 && days >= monthDays[gm]) {
    days -= monthDays[gm];
    gm++;
  }

  return new Date(gy, gm, days + 1);
}

function jalaliDaysInMonth(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;

  const start = jalaliToGregorian({ year, month: 12, day: 1 });
  const next = jalaliToGregorian({ year: year + 1, month: 1, day: 1 });

  return Math.round((next.getTime() - start.getTime()) / 86400000);
}

function clampDate(value: Date, min: Date, max: Date) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function WheelColumn({
  values,
  selected,
  formatValue,
  onSelect,
}: {
  values: number[];
  selected: number;
  formatValue: (value: number) => string;
  onSelect: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const index = values.indexOf(selected);
    if (index < 0) return;

    const target = container.children[index + 1] as HTMLElement | undefined;
    target?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [values, selected]);

  function handleScroll() {
    const container = ref.current;
    if (!container || values.length === 0) return;

    const center = container.scrollTop + container.clientHeight / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    values.forEach((value, index) => {
      const item = container.children[index + 1] as HTMLElement | undefined;
      if (!item) return;

      const itemCenter = item.offsetTop + item.offsetHeight / 2;
      const distance = Math.abs(itemCenter - center);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (values[closestIndex] !== selected) {
      onSelect(values[closestIndex]);
    }
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="h-[174px] snap-y snap-mandatory overflow-y-auto overscroll-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="h-[66px]" aria-hidden="true" />
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={[
            "flex h-[42px] w-full snap-center items-center justify-center rounded-lg text-[15px] font-medium transition",
            value === selected
              ? "bg-slate-50 text-slate-950"
              : "text-slate-300",
          ].join(" ")}
        >
          {formatValue(value)}
        </button>
      ))}
      <div className="h-[66px]" aria-hidden="true" />
    </div>
  );
}

function JalaliDatePickerSheet({
  value,
  minDate,
  maxDate,
  title,
  onConfirm,
  onClose,
}: {
  value: Date;
  minDate: Date;
  maxDate: Date;
  title: string;
  onConfirm: (date: Date) => void;
  onClose: () => void;
}) {
  const safeValue = clampDate(
    normalizeDateOnly(value),
    normalizeDateOnly(minDate),
    normalizeDateOnly(maxDate),
  );
  const initialJalali = gregorianToJalali(safeValue);

  const [selected, setSelected] = useState<JalaliDate>(initialJalali);

  const minJalali = gregorianToJalali(normalizeDateOnly(minDate));
  const maxJalali = gregorianToJalali(normalizeDateOnly(maxDate));

  const years = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, maxJalali.year - minJalali.year + 1) },
        (_, index) => minJalali.year + index,
      ),
    [minJalali.year, maxJalali.year],
  );

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => {
        const first = jalaliToGregorian({
          year: selected.year,
          month,
          day: 1,
        });
        const last = jalaliToGregorian({
          year: selected.year,
          month,
          day: jalaliDaysInMonth(selected.year, month),
        });

        return last >= minDate && first <= maxDate;
      }),
    [selected.year, minDate, maxDate],
  );

  const days = useMemo(
    () =>
      Array.from(
        { length: jalaliDaysInMonth(selected.year, selected.month) },
        (_, index) => index + 1,
      ).filter((day) => {
        const date = jalaliToGregorian({
          year: selected.year,
          month: selected.month,
          day,
        });

        return date >= minDate && date <= maxDate;
      }),
    [selected.year, selected.month, minDate, maxDate],
  );

  useEffect(() => {
    const nextMonth = months.includes(selected.month)
      ? selected.month
      : months[0] ?? 1;
    const nextDay = days.includes(selected.day)
      ? selected.day
      : days[days.length - 1] ?? 1;

    if (nextMonth !== selected.month || nextDay !== selected.day) {
      setSelected({
        year: selected.year,
        month: nextMonth,
        day: nextDay,
      });
    }
  }, [months, days, selected]);

  function updateYear(year: number) {
    const month = Math.min(
      Math.max(selected.month, year === minJalali.year ? minJalali.month : 1),
      year === maxJalali.year ? maxJalali.month : 12,
    );
    const day = Math.min(
      selected.day,
      jalaliDaysInMonth(year, month),
    );

    setSelected({ year, month, day });
  }

  function updateMonth(month: number) {
    setSelected({
      ...selected,
      month,
      day: Math.min(
        selected.day,
        jalaliDaysInMonth(selected.year, month),
      ),
    });
  }

  function confirm() {
    onConfirm(
      clampDate(
        normalizeDateOnly(jalaliToGregorian(selected)),
        normalizeDateOnly(minDate),
        normalizeDateOnly(maxDate),
      ),
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/25 px-0 pb-0 backdrop-blur-xl sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        className="w-full max-w-[440px] overflow-hidden rounded-t-[32px] border border-white/70 bg-white/65 shadow-[0_-24px_80px_rgba(15,23,42,0.24)] backdrop-blur-3xl supports-[backdrop-filter]:bg-white/55 sm:rounded-[30px] sm:shadow-[0_24px_90px_rgba(15,23,42,0.22)]"
      >
        <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-slate-400/45 sm:hidden" />

        <div className="relative border-b border-white/45 px-5 pb-4 pt-4 sm:pt-5">
          <button
            type="button"
            onClick={confirm}
            className="absolute right-5 top-4 text-[13px] font-semibold text-blue-500 transition active:opacity-60"
          >
            تأیید
          </button>
          <div className="px-14 text-center">
            <p className="text-[15px] font-semibold text-slate-950">{title}</p>
            <p className="mt-1 text-[10px] text-slate-400">
              روز، ماه و سال را با کشیدن بالا یا پایین انتخاب کنید.
            </p>
          </div>
        </div>

        <div className="relative px-4 py-3 sm:px-5">
          <div className="pointer-events-none absolute inset-x-4 top-[79px] h-[42px] rounded-[14px] border-y border-white/50 bg-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(15,23,42,0.04)] sm:inset-x-5" />

          <div className="relative grid grid-cols-3 gap-1">
            <WheelColumn
              values={years}
              selected={selected.year}
              formatValue={(year) => numberFormatter.format(year)}
              onSelect={updateYear}
            />
            <WheelColumn
              values={months}
              selected={selected.month}
              formatValue={(month) => jalaliMonthNames[month - 1]}
              onSelect={updateMonth}
            />
            <WheelColumn
              values={days}
              selected={selected.day}
              formatValue={(day) => numberFormatter.format(day)}
              onSelect={(day) =>
                setSelected({
                  ...selected,
                  day,
                })
              }
            />
          </div>

          <div className="pointer-events-none absolute inset-x-4 top-3 h-14 bg-gradient-to-b from-white/80 via-white/35 to-transparent sm:inset-x-5" />
          <div className="pointer-events-none absolute inset-x-4 bottom-3 h-14 bg-gradient-to-t from-white/80 via-white/35 to-transparent sm:inset-x-5" />
        </div>

        <div className="border-t border-white/45 px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 sm:pb-4">
          <div className="mb-1 text-center text-[11px] font-medium text-slate-500">
            {formatDate(jalaliToGregorian(selected))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mx-auto block text-[11px] font-medium text-slate-400 transition active:opacity-60"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

function JalaliDateRangePicker({
  range,
  minDate,
  onChange,
}: {
  range: { from?: Date; to?: Date };
  minDate: Date;
  onChange: (range: { from: Date; to: Date }) => void;
}) {
  const today = useMemo(() => normalizeDateOnly(new Date()), []);
  const minimum = useMemo(() => normalizeDateOnly(minDate), [minDate]);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to" | null>(null);

  const from = range.from
    ? clampDate(normalizeDateOnly(range.from), minimum, today)
    : minimum;
  const to = range.to
    ? clampDate(normalizeDateOnly(range.to), from, today)
    : today;

  function confirmFrom(date: Date) {
    const safeFrom = clampDate(date, minimum, today);
    const safeTo = to < safeFrom ? safeFrom : to;
    onChange({ from: safeFrom, to: safeTo });
    setPickerTarget("to");
  }

  function confirmTo(date: Date) {
    const safeTo = clampDate(date, from, today);
    onChange({ from, to: safeTo });
    setPickerTarget(null);
  }

  return (
    <>
      <div className="flex max-w-full items-center gap-1.5 sm:hidden">
        <button
          type="button"
          onClick={() => setPickerTarget("from")}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[14px] border border-white/70 bg-white/70 px-3 text-[10px] font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl transition active:scale-[0.98]"
          aria-label="انتخاب تاریخ شروع"
        >
          <CalendarDays size={15} className="shrink-0 text-slate-400" />
          <span className="min-w-0 truncate">{formatDate(from)}</span>
        </button>

        <span className="shrink-0 text-[10px] font-medium text-slate-400">تا</span>

        <button
          type="button"
          onClick={() => setPickerTarget("to")}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[14px] border border-white/70 bg-white/70 px-3 text-[10px] font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl transition active:scale-[0.98]"
          aria-label="انتخاب تاریخ پایان"
        >
          <CalendarDays size={15} className="shrink-0 text-slate-400" />
          <span className="min-w-0 truncate">{formatDate(to)}</span>
        </button>
      </div>

      <div className="hidden sm:inline-flex">
        <button
          type="button"
          onClick={() => setPickerTarget("from")}
          className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300"
          aria-label="انتخاب بازه زمانی"
        >
          <CalendarDays size={15} className="shrink-0 text-slate-400" />
          <span className="max-w-[170px] truncate">
            {formatDate(from)} — {formatDate(to)}
          </span>
        </button>
      </div>

      {pickerTarget === "from" && (
        <JalaliDatePickerSheet
          value={from}
          minDate={minimum}
          maxDate={today}
          title="انتخاب تاریخ شروع"
          onConfirm={confirmFrom}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {pickerTarget === "to" && (
        <JalaliDatePickerSheet
          value={to}
          minDate={from}
          maxDate={today}
          title="انتخاب تاریخ پایان"
          onConfirm={confirmTo}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </>
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
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: addDays(today, -29),
    to: today,
  });
  const [metric, setMetric] = useState<Metric>("views");
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

            <JalaliDateRangePicker
              range={range}
              minDate={
                data?.account.analyticsStartDate
                  ? new Date(data.account.analyticsStartDate)
                  : addDays(new Date(), -729)
              }
              onChange={(next) => {
                if (!next?.from || !next.to) return;
                setRange(next);
                setPreset("custom");
              }}
            />
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

          <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              label="بازدید"
              value={formatNumber(data.summary.views)}
              helper="مجموع بازه انتخابی"
              icon={Eye}
            />
            <MetricCard
              label="تعاملات"
              value={formatNumber(data.summary.totalInteractions)}
              helper="مجموع بازه انتخابی"
              icon={BarChart3}
            />
            <MetricCard
              label="فالو"
              value={formatNumber(data.summary.follows)}
              helper={data.summary.follows == null ? "داده از Meta در دسترس نیست" : "در بازه انتخابی"}
              icon={UserPlus}
            />
            <MetricCard
              label="آنفالو"
              value={formatNumber(data.summary.unfollows)}
              helper={data.summary.unfollows == null ? "داده از Meta در دسترس نیست" : "در بازه انتخابی"}
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
                        "views",
                        "totalInteractions",
                        "follows",
                        "unfollows",
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
                label="نرخ تعامل"
                value={formatPercent(rates?.interactionRate)}
                helper="تعاملات نسبت به بازدید"
              />
              <RateCard
                label="نرخ فالو"
                value={formatPercent(rates?.followRate)}
                helper="فالو نسبت به بازدید"
              />
              <RateCard
                label="نرخ آنفالو"
                value={formatPercent(rates?.unfollowRate)}
                helper="آنفالو نسبت به بازدید"
              />
              <RateCard
                label="نرخ رشد خالص"
                value={formatPercent(rates?.netFollowerRate)}
                helper="فالو منهای آنفالو، نسبت به بازدید"
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
