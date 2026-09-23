"use client";

import {
  ArrowDown,
  ArrowUp,
  FileBarChart,
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

type Data = {
  success: boolean;
  account: Account;
  snapshots: Snapshot[];
};

type MetricKey =
  | "reach"
  | "views"
  | "accountsEngaged"
  | "totalInteractions"
  | "profileViews";

const metrics: Array<{ key: MetricKey; label: string }> = [
  { key: "reach", label: "دسترسی" },
  { key: "views", label: "بازدید" },
  { key: "accountsEngaged", label: "اکانت‌های درگیر" },
  { key: "totalInteractions", label: "تعاملات" },
  { key: "profileViews", label: "بازدید پروفایل" },
];

const nf = new Intl.NumberFormat("fa-IR");
const pf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

function number(value: number | null | undefined) {
  return value == null ? "—" : nf.format(Math.round(value));
}

function date(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function sum(items: Snapshot[], key: MetricKey) {
  return items.reduce((total, item) => total + (item[key] ?? 0), 0);
}

function change(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function inputDate(dateValue: Date) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function dayStart(value: string) {
  const dateValue = new Date(value + "T00:00:00");
  return dateValue.getTime();
}

function dayEnd(value: string) {
  const dateValue = new Date(value + "T23:59:59.999");
  return dateValue.getTime();
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-slate-400">—</span>;
  }

  const positive = value >= 0;

  return (
    <span
      className={
        positive
          ? "inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"
          : "inline-flex items-center gap-1 text-xs font-semibold text-red-600"
      }
    >
      {positive ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
      {pf.format(Math.abs(value))}٪
    </span>
  );
}

export default function AdvancedAnalyticsReports({ accountId: externalAccountId }: { accountId?: string }) {
  const today = useMemo(() => new Date(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState(externalAccountId || "");
  const [from, setFrom] = useState(
    inputDate(new Date(today.getTime() - 29 * 86400000)),
  );
  const [to, setTo] = useState(inputDate(today));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/instagram/accounts", {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "خطا در دریافت اکانت‌ها");
    }

    const list = Array.isArray(result.accounts)
      ? (result.accounts as Account[])
      : [];

    setAccounts(list);

    if (!accountId) {
      setAccountId(list.find((item) => item.isConnected)?.id || "");
    }
  }, [accountId]);

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/instagram/insights/history?days=90&accountId=" +
          encodeURIComponent(accountId),
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "خطا در دریافت داده‌های گزارش");
      }

      setData(result as Data);
    } catch (requestError) {
      setData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "خطا در دریافت داده‌های گزارش",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (externalAccountId) { setAccountId(externalAccountId); return; }
    void loadAccounts().catch((requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "خطا در دریافت اکانت‌ها",
      );
      setLoading(false);
    });
  }, [loadAccounts, externalAccountId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener("smartdirect:refresh", handler);
    return () => window.removeEventListener("smartdirect:refresh", handler);
  }, [load]);

  const report = useMemo(() => {
    if (!data || !from || !to || dayStart(from) > dayEnd(to)) {
      return null;
    }

    const currentStart = dayStart(from);
    const currentEnd = dayEnd(to);
    const duration = currentEnd - currentStart + 1;

    const current = data.snapshots.filter((item) => {
      const timestamp = new Date(item.snapshotDate).getTime();
      return timestamp >= currentStart && timestamp <= currentEnd;
    });

    const previousStart = currentStart - duration;
    const previousEnd = currentStart - 1;

    const previous = data.snapshots.filter((item) => {
      const timestamp = new Date(item.snapshotDate).getTime();
      return timestamp >= previousStart && timestamp <= previousEnd;
    });

    const currentMetrics = Object.fromEntries(
      metrics.map(({ key }) => [key, sum(current, key)]),
    ) as Record<MetricKey, number>;

    const previousMetrics = Object.fromEntries(
      metrics.map(({ key }) => [key, sum(previous, key)]),
    ) as Record<MetricKey, number>;

    return {
      current,
      previous,
      currentMetrics,
      previousMetrics,
    };
  }, [data, from, to]);

  function exportCsv() {
    if (!report || !data) return;

    const rows = [
      ["SmartDirect Instagram Report"],
      ["Account", "@" + data.account.username],
      ["From", from],
      ["To", to],
      [],
      ["Metric", "Current", "Previous", "Change"],
      ...metrics.map(({ key, label }) => [
        label,
        report.currentMetrics[key],
        report.previousMetrics[key],
        change(report.currentMetrics[key], report.previousMetrics[key]) ?? "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => '"' + String(cell).replace(/"/g, '""') + '"')
          .join(","),
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "smartdirect-report-" + from + "-" + to + ".csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">گزارش‌ها</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
              گزارش عملکرد پیج
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              بازه موردنظر را انتخاب کنید و نتیجه را با دوره قبل مقایسه کنید.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">

            <label className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <span className="block text-[9px] text-slate-400">از</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-0.5 w-full bg-transparent text-[11px] font-medium text-slate-700 outline-none"
              />
            </label>

            <label className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <span className="block text-[9px] text-slate-400">تا</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
                className="mt-0.5 w-full bg-transparent text-[11px] font-medium text-slate-700 outline-none"
              />
            </label>


          </div>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 sm:mx-6">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="p-5 sm:p-6">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-4 h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : report ? (
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {metrics.map(({ key, label }) => {
              const current = report.currentMetrics[key];
              const previous = report.previousMetrics[key];

              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {number(current)}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      دوره قبل: {number(previous)}
                    </span>
                    <ChangeBadge value={change(current, previous)} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                <FileBarChart size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  جزئیات بازه
                </h3>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {report.current.length} روز داده در بازه انتخابی
                </p>
              </div>
            </div>

            {report.current.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">
                برای این بازه داده‌ای ثبت نشده است.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-right text-xs">
                  <thead className="bg-slate-50 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">تاریخ</th>
                      {metrics.slice(0, 4).map((metric) => (
                        <th key={metric.key} className="px-4 py-3 font-medium">
                          {metric.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium">فالوور</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...report.current].reverse().map((snapshot) => (
                      <tr key={snapshot.id} className="text-slate-700">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {date(snapshot.snapshotDate)}
                        </td>
                        {metrics.slice(0, 4).map((metric) => (
                          <td key={metric.key} className="px-4 py-3">
                            {number(snapshot[metric.key])}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          {number(snapshot.followerCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-5 py-16 text-center text-sm text-slate-400">
          برای ساخت گزارش، یک پیج و بازه زمانی انتخاب کنید.
        </div>
      )}
    </section>
  );
}
