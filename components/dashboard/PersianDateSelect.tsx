"use client";

import { useMemo } from "react";

const monthNames = [
  "فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
  "مهر","آبان","آذر","دی","بهمن","اسفند",
];

const calendar = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric",
  timeZone: "Asia/Tehran",
});

function parts(date: Date) {
  const values = calendar.formatToParts(date);
  return {
    year: Number(values.find((p) => p.type === "year")?.value),
    month: Number(values.find((p) => p.type === "month")?.value),
    day: Number(values.find((p) => p.type === "day")?.value),
  };
}

function jalaliFromIso(value: string) {
  return parts(new Date(value + "T12:00:00"));
}

function isoFromJalali(year: number, month: number, day: number) {
  const start = new Date(Date.UTC(year + 621, 2, 1, 12));
  for (let i = 0; i < 370; i++) {
    const candidate = new Date(start.getTime() + i * 86400000);
    const p = parts(candidate);
    if (p.year === year && p.month === month && p.day === day) {
      const gy = candidate.getUTCFullYear();
      const gm = String(candidate.getUTCMonth() + 1).padStart(2, "0");
      const gd = String(candidate.getUTCDate()).padStart(2, "0");
      return gy + "-" + gm + "-" + gd;
    }
  }
  return "";
}

function maxDay(year: number, month: number) {
  for (let day = 31; day >= 1; day--) {
    if (isoFromJalali(year, month, day)) return day;
  }
  return 29;
}

export default function PersianDateSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const current = useMemo(() => jalaliFromIso(value), [value]);
  const days = maxDay(current.year, current.month);

  function update(part: "year" | "month" | "day", raw: string) {
    const next = { ...current, [part]: Number(raw) };
    const safeDay = Math.min(next.day, maxDay(next.year, next.month));
    const iso = isoFromJalali(next.year, next.month, safeDay);
    if (iso) onChange(iso);
  }

  const years = Array.from({ length: 7 }, (_, index) => current.year - 3 + index);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
      <span className="block text-[9px] text-slate-400">{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <select value={current.day} onChange={(e) => update("day", e.target.value)} className="bg-transparent text-[11px] font-medium text-slate-700 outline-none">
          {Array.from({ length: days }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{new Intl.NumberFormat("fa-IR").format(day)}</option>)}
        </select>
        <span className="text-slate-300">/</span>
        <select value={current.month} onChange={(e) => update("month", e.target.value)} className="max-w-[78px] bg-transparent text-[11px] font-medium text-slate-700 outline-none">
          {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
        <span className="text-slate-300">/</span>
        <select value={current.year} onChange={(e) => update("year", e.target.value)} className="bg-transparent text-[11px] font-medium text-slate-700 outline-none">
          {years.map((year) => <option key={year} value={year}>{new Intl.NumberFormat("fa-IR").format(year)}</option>)}
        </select>
      </div>
    </div>
  );
}
