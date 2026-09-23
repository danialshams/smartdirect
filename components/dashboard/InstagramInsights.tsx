"use client";

import {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Range = 7 | 30 | 90;
type Metric = "reach" | "accountsEngaged";

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
  summary: {
    reach: number;
    views: number;
    accountsEngaged: number;
    totalInteractions: number;
    follows: number;
    unfollows: number;
    profileLinksTaps: number;
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
  return value == null || !Number.isFinite(value)
    ? "—"
    : pf.format(value) + "٪";
}

function date(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function metricValue(snapshot: Snapshot, metric: Metric) {
  if (metric === "reach") return snapshot.reach ?? 0;
  return snapshot.accountsEngaged ?? 0;
}

function LineChart({
  snapshots,
  metric,
}: {
  snapshots: Snapshot[];
  metric: Metric;
}) {
  const width = 900;
  const height = 260;
  const paddingX = 20;
  const paddingY = 24;

  const points = useMemo(() => {
    if (!snapshots.length) return [];

    const values = snapshots.map((item) => metricValue(item, metric));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);

    return snapshots.map((item, index) => ({
      x:
        snapshots.length === 1
          ? width / 2
          : paddingX +
            (index / (snapshots.length - 1)) * (width - paddingX * 2),
      y:
        height -
        paddingY -
        ((metricValue(item, metric) - min) / range) *
          (height - paddingY * 2),
      value: metricValue(item, metric),
      date: item.snapshotDate,
    }));
  }, [metric, snapshots]);

  if (!points.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
        هنوز داده تاریخی برای این بازه ثبت نشده است.
      </div>
    );
  }

  const line = points
    .map(
      (point, index) =>
        (index ? "L " : "M ") +
        point.x.toFixed(2) +
        " " +
        point.y.toFixed(2),
    )
    .join(" ");

  const area =
    line +
    " L " +
    points.at(-1)!.x.toFixed(2) +
    " " +
    (height - paddingY) +
    " L " +
    points[0].x.toFixed(2) +
    " " +
    (height - paddingY) +
    " Z";

  const labels = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={"0 0 " + width + " " + height}
        className="h-[260px] min-w-[620px] w-full"
        role="img"
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={paddingX}
            x2={width - paddingX}
            y1={height * ratio}
            y2={height * ratio}
            stroke="currentColor"
            className="text-slate-100"
          />
        ))}

        <path d={area} fill="currentColor" className="text-blue-50" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          className="text-[#2563eb]"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="currentColor"
            className="text-[#2563eb]"
          />
        ))}

        {labels.map((index) => (
          <text
            key={points[index].date}
            x={points[index].x}
            y={height - 4}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            className="fill-slate-400 text-[11px]"
          >
            {date(points[index].date)}
          </text>
        ))}
      </svg>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="text-[10px] text-slate-400">{helper}</span>
      </div>
      <p className="mt-4 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function InstagramInsights({ accountId: externalAccountId }: { accountId?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState(externalAccountId || "");
  const [range, setRange] = useState<Range>(7);
  const [metric, setMetric] = useState<Metric>("reach");
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
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/instagram/insights/history?days=" +
          range +
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
  }, [accountId, range]);

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

  const summary = data?.summary;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">تحلیل پیج</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
            عملکرد Instagram
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            دسترسی، اکانت‌های درگیر، رشد فالوورها و عملکرد لینک پروفایل.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">

          <div className="flex h-10 rounded-lg border border-slate-200 bg-white p-1">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRange(days as Range)}
                className={[
                  "min-w-12 rounded-md px-2 text-[11px] font-semibold transition",
                  range === days
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                {days} روز
              </button>
            ))}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
          <div className="mt-3 h-[260px] animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : summary ? (
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard label="دسترسی" value={number(summary.reach)} helper={"در " + range + " روز"} icon={Eye} />
            <MetricCard label="اکانت‌های درگیر" value={number(summary.accountsEngaged)} helper={percent(summary.engagementRate) + " از دسترسی"} icon={Users} />
            <MetricCard label="فالو جدید" value={number(summary.follows)} helper={"در " + range + " روز"} icon={Users} />
            <MetricCard label="آنفالو" value={number(summary.unfollows)} helper={"در " + range + " روز"} icon={Users} />
            <MetricCard label="کلیک لینک پروفایل" value={number(summary.profileLinksTaps)} helper={"در " + range + " روز"} icon={BarChart3} />
          </div>          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="نرخ اکانت‌های درگیر" value={percent(summary.engagementRate)} />
            <MiniStat label="رشد خالص فالوور" value={number(summary.followerGrowth)} />
            <MiniStat label="فالوور فعلی" value={number(summary.followerCount)} />
          </div>port {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Range = 7 | 30 | 90;
type Metric = "reach" | "accountsEngaged";

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
  summary: {
    reach: number;
    views: number;
    accountsEngaged: number;
    totalInteractions: number;
    follows: number;
    unfollows: number;
    profileLinksTaps: number;
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
  return value == null || !Number.isFinite(value)
    ? "—"
    : pf.format(value) + "٪";
}

function date(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function metricValue(snapshot: Snapshot, metric: Metric) {
  if (metric === "reach") return snapshot.reach ?? 0;
  return snapshot.accountsEngaged ?? 0;
}

function LineChart({
  snapshots,
  metric,
}: {
  snapshots: Snapshot[];
  metric: Metric;
}) {
  const width = 900;
  const height = 260;
  const paddingX = 20;
  const paddingY = 24;

  const points = useMemo(() => {
    if (!snapshots.length) return [];

    const values = snapshots.map((item) => metricValue(item, metric));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);

    return snapshots.map((item, index) => ({
      x:
        snapshots.length === 1
          ? width / 2
          : paddingX +
            (index / (snapshots.length - 1)) * (width - paddingX * 2),
      y:
        height -
        paddingY -
        ((metricValue(item, metric) - min) / range) *
          (height - paddingY * 2),
      value: metricValue(item, metric),
      date: item.snapshotDate,
    }));
  }, [metric, snapshots]);

  if (!points.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
        هنوز داده تاریخی برای این بازه ثبت نشده است.
      </div>
    );
  }

  const line = points
    .map(
      (point, index) =>
        (index ? "L " : "M ") +
        point.x.toFixed(2) +
        " " +
        point.y.toFixed(2),
    )
    .join(" ");

  const area =
    line +
    " L " +
    points.at(-1)!.x.toFixed(2) +
    " " +
    (height - paddingY) +
    " L " +
    points[0].x.toFixed(2) +
    " " +
    (height - paddingY) +
    " Z";

  const labels = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={"0 0 " + width + " " + height}
        className="h-[260px] min-w-[620px] w-full"
        role="img"
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={paddingX}
            x2={width - paddingX}
            y1={height * ratio}
            y2={height * ratio}
            stroke="currentColor"
            className="text-slate-100"
          />
        ))}

        <path d={area} fill="currentColor" className="text-blue-50" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          className="text-[#2563eb]"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="currentColor"
            className="text-[#2563eb]"
          />
        ))}

        {labels.map((index) => (
          <text
            key={points[index].date}
            x={points[index].x}
            y={height - 4}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            className="fill-slate-400 text-[11px]"
          >
            {date(points[index].date)}
          </text>
        ))}
      </svg>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="text-[10px] text-slate-400">{helper}</span>
      </div>
      <p className="mt-4 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function InstagramInsights({ accountId: externalAccountId }: { accountId?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState(externalAccountId || "");
  const [range, setRange] = useState<Range>(7);
  const [metric, setMetric] = useState<Metric>("reach");
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
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/instagram/insights/history?days=" +
          range +
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
  }, [accountId, range]);

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

  const summary = data?.summary;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">تحلیل پیج</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
            عملکرد Instagram
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            دسترسی، اکانت‌های درگیر، رشد فالوورها و عملکرد لینک پروفایل.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">

          <div className="flex h-10 rounded-lg border border-slate-200 bg-white p-1">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRange(days as Range)}
                className={[
                  "min-w-12 rounded-md px-2 text-[11px] font-semibold transition",
                  range === days
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                {days} روز
              </button>
            ))}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
          <div className="mt-3 h-[260px] animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : summary ? (
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard label="دسترسی" value={number(summary.reach)} helper={"در " + range + " روز"} icon={Eye} />
            <MetricCard label="اکانت‌های درگیر" value={number(summary.accountsEngaged)} helper={percent(summary.engagementRate) + " از دسترسی"} icon={Users} />
            <MetricCard label="فالو جدید" value={number(summary.follows)} helper={"در " + range + " روز"} icon={Users} />
            <MetricCard label="آنفالو" value={number(summary.unfollows)} helper={"در " + range + " روز"} icon={Users} />
            <MetricCard label="کلیک لینک پروفایل" value={number(summary.profileLinksTaps)} helper={"در " + range + " روز"} icon={BarChart3} />
          </div>
