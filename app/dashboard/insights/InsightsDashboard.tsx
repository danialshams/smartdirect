"use client";

import {
  Activity, BarChart3, CalendarDays, Eye, HeartHandshake,
  Lightbulb, TrendingDown, TrendingUp, UserMinus, UserPlus, Users, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dairaPalette } from "../../../lib/design-system/palette";
import { Calendar } from "@/components/dashboard/DashboardUI";

type Preset = 7 | 30 | 90;
type Metric = "reach" | "views" | "interactions";
type Snapshot = {
  id: string;
  snapshotDate: string;
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
  totalInteractions: number | null;
  followerCount: number | null;
};
type Summary = {
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
  totalInteractions: number | null;
  engagementRate: number | null;
  follows: number | null;
  unfollows: number | null;
  followerCount: number | null;
  followerGrowth: number | null;
};
type InsightsData = {
  success: boolean;
  account?: { analyticsStartDate?: string };
  summary: Summary;
  snapshots: Snapshot[];
  error?: string;
};
type DateSelection = { from: Date; to: Date };

const fullNumber = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 });
const percentNumber = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const formatNumber = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—"
  : Math.abs(value) >= 10000 ? compactNumber.format(value) : fullNumber.format(value);
const formatExact = (value: number) => fullNumber.format(value);
const formatPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : percentNumber.format(value) + "٪";
const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const shiftDay = (value: Date, offset: number) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate() + offset);
const dateOnly = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
function localIsoDate(value: string) {
  const part = value.slice(0, 10).split("-").map(Number);
  if (part.length !== 3 || part.some((x) => !Number.isFinite(x))) return null;
  return new Date(part[0], part[1] - 1, part[2]);
}
function persianDate(value: Date, short = true) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian",
    short ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" },
  ).format(value);
}
function snapshotDate(value: string) {
  return localIsoDate(value) ?? new Date(value);
}
function selectedValue(s: Snapshot, metric: Metric) {
  return metric === "reach" ? s.reach : metric === "views" ? s.views : s.totalInteractions;
}
function daysBetween(from: Date, to: Date) {
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
    Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000) + 1;
}

function InsightsGuide({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border, color: dairaPalette.guide.text }}>
      <Lightbulb size={18} className="mt-0.5 shrink-0" style={{ color: dairaPalette.guide.icon }} aria-hidden="true" />
      <p className="text-xs leading-6">{text}</p>
    </div>
  );
}

function AnimatedStatValue({ value }: { value: number | null | undefined }) {
  const [display, setDisplay] = useState<number | null>(value == null ? null : 0);
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setDisplay(null);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const step = (time: number) => {
      if (start === null) start = time;
      const p = Math.min(1, (time - start) / 650);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{formatNumber(display)}</>;
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={"daira-skeleton__bar " + className} />;
}
function InsightsSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری تحلیل پیج" className="space-y-4">
      <span className="sr-only">در حال دریافت آمار پیج...</span>
      <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <SkeletonBar className="h-4 w-36" />
          <SkeletonBar className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-9 w-20 rounded-lg" />)}
        </div>
        <SkeletonBar className="mt-3 h-11 w-full rounded-xl" />
      </section>
      <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <SkeletonBar className="mb-4 h-4 w-28" />
        <div className="mb-5 flex gap-2">
          {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-9 flex-1 rounded-lg" />)}
        </div>
        <SkeletonBar className="h-52 w-full rounded-xl sm:h-64" />
        <div className="mt-3 flex justify-between">
          <SkeletonBar className="h-3 w-12" /><SkeletonBar className="h-3 w-12" /><SkeletonBar className="h-3 w-12" />
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--daira-border)] bg-white p-4">
            <SkeletonBar className="h-3 w-20" /><SkeletonBar className="mt-3 h-8 w-24" /><SkeletonBar className="mt-3 h-3 w-28 max-w-full" />
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4">
        <SkeletonBar className="mb-4 h-4 w-24" />
        <div className="grid grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-3 border-b border-[var(--daira-border)] p-4">
              <SkeletonBar className="h-7 w-20" /><SkeletonBar className="h-3 w-16" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrendChart({ snapshots, metric }: { snapshots: Snapshot[]; metric: Metric }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const height = 224;
  const horizontalPadding = 14;
  const top = 18;
  const bottom = 18;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setWidth(Math.max(240, Math.round(element.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setActiveIndex(null), [metric, snapshots]);

  const points = useMemo(() => {
    const available = snapshots.filter((item) => selectedValue(item, metric) != null);
    if (!available.length) return [];
    const values = available.map((item) => selectedValue(item, metric) as number);
    const lowest = Math.min(0, ...values);
    const highest = Math.max(1, ...values);
    const range = Math.max(1, highest - lowest);
    return available.map((item, i) => ({
      x: available.length === 1 ? width / 2 : horizontalPadding + (i / (available.length - 1)) * (width - 2 * horizontalPadding),
      y: top + ((highest - (selectedValue(item, metric) as number)) / range) * (height - top - bottom),
      value: selectedValue(item, metric) as number,
      label: persianDate(snapshotDate(item.snapshotDate), false),
      date: item.snapshotDate,
    }));
  }, [snapshots, metric, width]);

  const line = useMemo(() => points.reduce((result, p, i) => {
    if (i === 0) return "M " + p.x + " " + p.y;
    const prior = points[i - 1];
    const mid = (prior.x + p.x) / 2;
    return result + " C " + mid + " " + prior.y + " " + mid + " " + p.y + " " + p.x + " " + p.y;
  }, ""), [points]);
  const area = points.length > 1
    ? line + " L " + points[points.length - 1].x + " " + height + " L " + points[0].x + " " + height + " Z"
    : "";
  const active = activeIndex == null ? null : points[activeIndex] ?? null;
  const dates = points.length ? [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]] : [];

  function choosePoint(clientX: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || !points.length) return;
    const x = clientX - bounds.left;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) nearest = i;
    }
    setActiveIndex((previous) => previous === nearest ? previous : nearest);
  }

  if (!snapshots.some((item) => selectedValue(item, metric) != null)) return (
    <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-4 text-center text-xs leading-6 text-[var(--daira-text)]">
      برای این شاخص در بازه انتخاب‌شده داده‌ای ثبت نشده است.
    </div>
  );

  return (
    <div ref={containerRef} dir="ltr" className="relative w-full min-w-0">
      <svg viewBox={"0 0 " + width + " " + height} width="100%" height={height}
        className="block w-full touch-pan-y"
        role="img" tabIndex={0} aria-label="نمودار روند روزانه؛ برای دیدن مقدار هر روز روی نمودار لمس کنید یا از کلیدهای جهت‌دار استفاده کنید"
        onPointerDown={(event) => choosePoint(event.clientX)}
        onPointerMove={(event) => choosePoint(event.clientX)}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") setActiveIndex(null); }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setActiveIndex((index) => Math.max(0, Math.min(points.length - 1,
            (index ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
        }}>
        <defs>
          <linearGradient id="insights-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2F61FD" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#2F61FD" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.22, 0.47, 0.72, 0.97].map((fraction) => (
          <line key={fraction} x1={horizontalPadding} x2={width - horizontalPadding}
            y1={height * fraction} y2={height * fraction}
            stroke="#E2E8F0" strokeDasharray="4 6" strokeWidth="1" />
        ))}
        {area && <path d={area} fill="url(#insights-line-fill)" />}
        <path d={line} fill="none" stroke="#2F61FD" strokeWidth="2.8" strokeLinecap="round" />
        {active && (
          <>
            <line x1={active.x} x2={active.x} y1={top} y2={height}
              stroke="#2F61FD" strokeDasharray="3 4" opacity="0.5" />
            <circle cx={active.x} cy={active.y} r={6} fill="#FFFFFF" stroke="#2F61FD" strokeWidth={3} />
          </>
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-[var(--daira-border)] bg-white px-2.5 py-1.5 text-center shadow-md"
          style={{ left: Math.min(width - 75, Math.max(75, active.x)), transform: "translateX(-50%)" }}>
          <div className="text-[10px] text-[var(--daira-text)]">{active.label}</div>
          <div className="text-sm font-bold text-[var(--daira-heading)]">{formatExact(active.value)}</div>
        </div>
      )}
      <div dir="ltr" className="mt-1 flex items-center justify-between text-[10px] text-[var(--daira-text)]">
        <span>{persianDate(snapshotDate(dates[0].date))}</span>
        {dates[1].date !== dates[0].date && dates[1].date !== dates[2].date && <span>{persianDate(snapshotDate(dates[1].date))}</span>}
        {dates[2].date !== dates[0].date && <span>{persianDate(snapshotDate(dates[2].date))}</span>}
      </div>

    </div>
  );
}

function Panel({ title, icon: Icon, children, help }: { title: string; icon: ElementType; children: ReactNode; help: string }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className="shrink-0 text-[var(--daira-primary)]" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-sm font-extrabold text-[var(--daira-heading)]">{title}</h2>
      </div>
      <InsightsGuide text={help} />
      {children}
    </section>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | null | undefined; icon: ElementType }) {
  return (
    <div className="group flex min-h-[146px] min-w-0 flex-col items-center justify-center gap-2 px-2 py-4 text-center transition-colors duration-200 hover:bg-[var(--daira-surface-hover)] sm:min-h-[160px]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[var(--daira-primary)] transition-transform duration-200 group-hover:-translate-y-0.5">
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="max-w-full break-words text-[22px] font-extrabold tabular-nums text-[var(--daira-heading)] sm:text-[26px]" dir="auto">
        <AnimatedStatValue value={value} />
      </div>
      <div className="text-[11px] font-semibold leading-5 text-[var(--daira-text)]">{label}</div>
    </div>
  );
}

export default function InsightsDashboard() {
  const [accountId, setAccountId] = useState("");
  const [preset, setPreset] = useState<Preset>(30);
  const [metric, setMetric] = useState<Metric>("reach");
  const [appliedRange, setAppliedRange] = useState<DateSelection | null>(null);
  const [draftFrom, setDraftFrom] = useState<Date | undefined>();
  const [draftTo, setDraftTo] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState<"from" | "to" | null>(null);
  const [today] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const requestNumber = useRef(0);
  const lastSync = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const json = await response.json();
        if (!response.ok || !json.success)
          throw new Error(json.error || "دریافت پیج فعال ناموفق بود.");
        const accounts = (Array.isArray(json.accounts) ? json.accounts : []) as Array<{id:string;isConnected:boolean}>;
        const current = accounts.find((account) => account.isConnected);
        if (!cancelled) {
          if (current) setAccountId(current.id);
          else { setError("هیچ پیج اینستاگرامی متصل نیست."); setLoading(false); }
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "دریافت پیج فعال ناموفق بود.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);


  const fetchInsights = useCallback(async (
    id: string, days: Preset, custom: DateSelection | null, signal: AbortSignal, currentRequest: number,
  ) => {
    setLoading(true);
    setError("");
    setWarning("");
    try {
      let syncWarning = "";
      if (!lastSync.current || lastSync.current.id !== id || Date.now() - lastSync.current.at > 5 * 60 * 1000) {
        // Sync only a bounded recent window. Date filter changes must not fan
        // out into expensive duplicate Meta requests.
        lastSync.current = { id, at: Date.now() };
        try {
          const syncFrom = shiftDay(today, -6);
          const sync = new URLSearchParams({ accountId: id, from: dateOnly(syncFrom), to: dateOnly(today) });
          const syncResponse = await fetch("/api/instagram/insights?" + sync, { cache: "no-store", credentials: "include", signal });
          const result = await syncResponse.json() as { error?: string; sync?: { syncedDays?: number; errors?: Array<{ error: string }> } };
          if (!syncResponse.ok) syncWarning = result.error || "بروزرسانی داده‌ها از اینستاگرام ناموفق بود.";
          else if ((result.sync?.syncedDays ?? 0) === 0 && (result.sync?.errors?.length ?? 0) > 0)
            syncWarning = "آمار تازه دریافت نشد؛ داده‌های ذخیره‌شده نمایش داده می‌شوند.";
        } catch (e) {
          if (signal.aborted) return;
          syncWarning = "بروزرسانی داده‌ها ناموفق بود؛ آمار ذخیره‌شده نمایش داده می‌شود.";
        }
      }

      const params = new URLSearchParams({ accountId: id });
      if (custom) {
        params.set("from", dateOnly(custom.from));
        params.set("to", dateOnly(custom.to));
      } else params.set("days", String(days));
      const response = await fetch("/api/instagram/insights/history?" + params, {
        cache: "no-store", credentials: "include", signal,
      });
      const result = await response.json() as InsightsData;
      if (!response.ok || !result.success) throw new Error(result.error || "دریافت آمار ناموفق بود.");
      if (!signal.aborted && requestNumber.current === currentRequest) {
        setData(result);
        setWarning(syncWarning);
      }
    } catch (requestError) {
      if (!signal.aborted && requestNumber.current === currentRequest) {
        setData(null);
        setError(requestError instanceof Error ? requestError.message : "خطا در دریافت آمار.");
      }
    } finally {
      if (!signal.aborted && requestNumber.current === currentRequest) setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    const request = ++requestNumber.current;
    void fetchInsights(accountId, preset, appliedRange, controller.signal, request);
    return () => controller.abort();
  }, [accountId, preset, appliedRange, fetchInsights]);

  const fallbackStart = shiftDay(today, -729);
  const accountStart = data?.account?.analyticsStartDate ? localIsoDate(data.account.analyticsStartDate) : null;
  const minDate = accountStart && accountStart > fallbackStart ? accountStart : fallbackStart;
  const fromValid = Boolean(draftFrom && draftFrom >= minDate && draftFrom <= today);
  const toValid = Boolean(draftTo && draftTo >= minDate && draftTo <= today);
  const validRange = Boolean(fromValid && toValid && draftFrom && draftTo &&
    draftFrom <= draftTo && daysBetween(draftFrom, draftTo) <= 730);
  const snapshots = data?.snapshots ?? [];
  const summary = data?.summary;
  const follows = summary?.follows;
  const unfollows = summary?.unfollows;
  const netFollowers = follows != null && unfollows != null
    ? follows - unfollows : summary?.followerGrowth ?? null;
  const tabs: { id: Metric; title: string; icon: ElementType }[] = [
    { id: "reach", title: "دسترسی", icon: Users },
    { id: "views", title: "بازدید", icon: Eye },
    { id: "interactions", title: "تعاملات", icon: HeartHandshake },
  ];

  function openCalendar(field: "from" | "to") {
    if (!draftFrom && !draftTo) {
      const initial = appliedRange ?? { from: shiftDay(today, -(preset - 1)), to: today };
      setDraftFrom(initial.from < minDate ? minDate : initial.from);
      setDraftTo(initial.to);
    }
    setCalendarOpen(field);
  }

  function pickDate(value: Date | undefined) {
    if (!value) return;
    const chosen = startOfDay(value);
    if (calendarOpen === "from") {
      setDraftFrom(chosen);
      if (draftTo && draftTo < chosen) setDraftTo(undefined);
    }
    if (calendarOpen === "to") setDraftTo(chosen);
    setCalendarOpen(null);
  }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl space-y-4 overflow-x-clip px-1 pb-12 pt-2 sm:px-2 sm:py-4">
      <section aria-labelledby="insights-heading" className="flex items-start gap-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--daira-surface-hover)] text-[var(--daira-primary)]">
          <BarChart3 size={23} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="insights-heading" className="text-lg font-extrabold text-[var(--daira-heading)]">تحلیل پیج</h1>
          <p className="mt-1 text-xs leading-6 text-[var(--daira-text)]">
            بررسی روند و عملکرد پیج در بازه زمانی دلخواه
          </p>
        </div>
      </section>

      <section aria-label="انتخاب بازه گزارش" className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[var(--daira-heading)]">
          <CalendarDays size={17} className="text-[var(--daira-primary)]" /> بازه گزارش
        </div>
        <InsightsGuide text="آمار را برای ۷، ۳۰ یا ۹۰ روز اخیر ببین؛ برای بازه دلخواه تاریخ شروع و پایان را جداگانه انتخاب کن." />
        <div className="grid grid-cols-3 gap-2">
          {([7, 30, 90] as const).map((days) => (
            <button type="button" key={days} aria-pressed={!appliedRange && preset === days}
              onClick={() => { setPreset(days); setAppliedRange(null); setDraftFrom(undefined); setDraftTo(undefined); setCalendarOpen(null); }}
              className={"min-h-11 rounded-xl border px-2 text-xs font-bold transition " +
                (!appliedRange && preset === days
                  ? "border-blue-300 bg-blue-50 text-[var(--daira-primary)]"
                  : "border-[var(--daira-border)] bg-white text-[var(--daira-text)] hover:bg-[var(--daira-surface-hover)]")}>
              {new Intl.NumberFormat("fa-IR").format(days)} روز
            </button>
          ))}
        </div>
        <div className="mt-4 text-sm font-bold text-[var(--daira-heading)]">بازه دلخواه</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["from", "to"] as const).map((field) => (
            <button type="button" key={field} onClick={() => openCalendar(field)}
              aria-haspopup="dialog" aria-label={field === "from" ? "انتخاب تاریخ شروع" : "انتخاب تاریخ پایان"}
              className={"flex min-h-[77px] min-w-0 flex-col gap-2 rounded-xl border p-3 text-right transition hover:border-blue-300 " +
                (appliedRange ? "border-blue-300 bg-blue-50" : "border-[var(--daira-border)] bg-[var(--daira-surface-hover)]")}>
              <span className="text-[11px] text-[var(--daira-text)]">{field === "from" ? "از تاریخ" : "تا تاریخ"}</span>
              <span className="flex w-full min-w-0 items-center gap-1.5 text-xs font-bold text-[var(--daira-heading)]">
                <span className="min-w-0 flex-1">{(field === "from" ? draftFrom : draftTo)
                  ? persianDate((field === "from" ? draftFrom : draftTo)!, false) : "انتخاب تاریخ"}</span>
                <CalendarDays size={15} className="shrink-0 text-[var(--daira-primary)]" />
              </span>
            </button>
          ))}
        </div>
        <button type="button" disabled={!validRange || Boolean(appliedRange && draftFrom &&
          draftTo && dateOnly(appliedRange.from) === dateOnly(draftFrom) && dateOnly(appliedRange.to) === dateOnly(draftTo))}
          onClick={() => {
            if (!draftFrom || !draftTo || !validRange) return;
            setAppliedRange({ from: draftFrom, to: draftTo });
          }}
          className="mt-3 min-h-11 w-full rounded-xl bg-[var(--daira-primary)] px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          اعمال بازه
        </button>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
          {error}
        </div>
      )}
      {warning && !loading && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
          {warning}
        </div>
      )}

      {loading ? <InsightsSkeleton /> : data ? (
        <>
          <Panel title="روند عملکرد" icon={Activity}
            help="دسترسی یعنی تعداد حساب‌هایی که محتوا را دیده‌اند؛ بازدید یعنی تعداد نمایش‌ها؛ تعاملات شامل واکنش‌های مخاطبان است. نمودار تغییرات روزانه را نشان می‌دهد.">
            <div className="mb-4 grid grid-cols-3 gap-2" role="group" aria-label="انتخاب شاخص نمودار">
              {tabs.map(({ id, title, icon: Icon }) => (
                <button type="button" key={id} aria-pressed={metric === id} onClick={() => setMetric(id)}
                  className={"flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-1 text-[11px] font-bold transition " +
                    (metric === id ? "border-blue-300 bg-blue-50 text-[var(--daira-primary)]"
                      : "border-[var(--daira-border)] bg-white text-[var(--daira-text)] hover:bg-[var(--daira-surface-hover)]")}>
                  <Icon size={15} aria-hidden="true" />{title}
                </button>
              ))}
            </div>
            <TrendChart snapshots={snapshots} metric={metric} />
          </Panel>

          <Panel title="نرخ‌های عملکرد" icon={TrendingUp}
            help="نرخ تعامل از نسبت تعاملات به جمع دسترسی روزانه به‌دست می‌آید. رشد خالص فالوور نیز تفاوت فالو و آنفالو یا تغییر تعداد دنبال‌کنندگان ثبت‌شده است.">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3 sm:p-4">
                <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-[var(--daira-text)]">
                  <span>نرخ تعامل</span>

                </div>
                <div className="mt-2 text-xl font-extrabold text-[var(--daira-heading)] sm:text-2xl">{formatPercent(summary?.engagementRate)}</div>

              </div>
              <div className="min-w-0 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3 sm:p-4">
                <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-[var(--daira-text)]">
                  <span>رشد خالص فالوور</span>

                </div>
                <div className={"mt-2 flex flex-wrap items-center gap-1 text-xl font-extrabold sm:text-2xl " +
                  (netFollowers == null ? "text-[var(--daira-heading)]" : netFollowers < 0 ? "text-red-600" : "text-emerald-600")}>
                  {netFollowers != null && netFollowers > 0 && <TrendingUp size={19} aria-hidden="true" />}
                  {netFollowers != null && netFollowers < 0 && <TrendingDown size={19} aria-hidden="true" />}
                  {netFollowers != null && netFollowers > 0 ? "+" : ""}
                  {formatNumber(netFollowers)}
                </div>

              </div>
            </div>
          </Panel>

          <Panel title="آمار کلی" icon={BarChart3}
            help="این بخش مجموع آمار روزانه را نشان می‌دهد؛ دسترسی جمع روزهاست، نه افراد یکتای کل بازه. دنبال‌کنندگان آخرین مقدار ثبت‌شده است. بعضی آمار مانند فالو و آنفالو برای پیج‌های زیر ۱۰۰ فالوور ممکن است در دسترس نباشند.">
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--daira-border)] sm:grid-cols-3">
              {([
                { label: "بازدید", value: summary?.views, icon: Eye },
                { label: "تعاملات", value: summary?.totalInteractions, icon: HeartHandshake },
                { label: "فالو", value: summary?.follows, icon: UserPlus },
                { label: "آنفالو", value: summary?.unfollows, icon: UserMinus },
                { label: "دنبال‌کنندگان", value: summary?.followerCount, icon: Users },
                { label: "جمع دسترسی روزانه", value: summary?.reach, icon: Activity },
              ] as const).map((stat, index) => (
                <div key={stat.label}
                  className={"min-w-0 border-[var(--daira-border)] " +
                    (index < 4 ? "border-b " : "") +
                    (index % 2 === 0 ? "border-l " : "") +
                    (index < 3 ? "sm:border-b " : "sm:border-b-0 ") +
                    (index % 3 !== 2 ? "sm:border-l " : "sm:border-l-0 ")}>
                  <Stat label={stat.label} value={stat.value} icon={stat.icon} />
                </div>
              ))}
            </div>
          </Panel>
          {snapshots.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--daira-border)] bg-white px-4 py-4 text-center text-xs leading-6 text-[var(--daira-text)]">
              برای این بازه هنوز داده‌ای ثبت نشده است. با ثبت آمار روزهای جدید، روند اینجا نمایش داده می‌شود.
            </p>
          )}
        </>
      ) : !error ? (
        <div className="rounded-xl border border-dashed border-[var(--daira-border)] bg-white p-6 text-center text-xs text-[var(--daira-text)]">
          اطلاعات قابل‌نمایشی در دسترس نیست.
        </div>
      ) : null}

      {calendarOpen && typeof document !== "undefined" && createPortal(
        <div data-insights-calendar-popup className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/40 px-3 py-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setCalendarOpen(null); }}>
          <section dir="rtl" role="dialog" aria-modal="true"
            aria-label={calendarOpen === "from" ? "انتخاب تاریخ شروع" : "انتخاب تاریخ پایان"}
            className="flex max-h-[min(90dvh,670px)] w-fit max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--daira-border)] px-4 py-3">
              <div className="text-sm font-extrabold text-[var(--daira-heading)]">
                {calendarOpen === "from" ? "انتخاب تاریخ شروع" : "انتخاب تاریخ پایان"}
              </div>
              <button type="button" aria-label="بستن تقویم" onClick={() => setCalendarOpen(null)}
                className="grid h-10 w-10 place-items-center rounded-xl text-[var(--daira-text)] hover:bg-[var(--daira-surface-hover)]">
                <X size={19} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <Calendar key={calendarOpen} mode="single" numberOfMonths={1}
                selected={calendarOpen === "from" ? draftFrom : draftTo}
                onSelect={pickDate}
                defaultMonth={(calendarOpen === "from" ? draftFrom : draftTo) ?? today}
                startMonth={calendarOpen === "to" ? (draftFrom ?? minDate) : minDate}
                endMonth={today}
                disabled={{
                  before: calendarOpen === "to" ? (draftFrom ?? minDate) : minDate,
                  after: today,
                }} />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </main>
  );
}
