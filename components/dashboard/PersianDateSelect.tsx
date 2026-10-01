"use client";

import { useMemo } from "react";
import { Box, FormControl, MenuItem, Select, Typography } from "@mui/material";

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
    <Box dir="rtl" sx={{ border: "1px solid #E2E8F0", bgcolor: "#FFFFFF", borderRadius: 2, px: 1.25, py: 0.75, minWidth: 190 }}>
      <Typography sx={{ display: "block", color: "#94A3B8", fontSize: 9 }}>{label}</Typography>
      <Box sx={{ mt: 0.25, display: "flex", alignItems: "center", gap: 0.25 }}>
        <DatePartSelect value={current.day} onChange={(v) => update("day", v)} minWidth={42}>
          {Array.from({ length: days }, (_, i) => i + 1).map((day) => <MenuItem key={day} value={day} sx={{ fontSize: 12 }}>{new Intl.NumberFormat("fa-IR").format(day)}</MenuItem>)}
        </DatePartSelect>
        <Typography sx={{ color: "#CBD5E1", fontSize: 11 }}>/</Typography>
        <DatePartSelect value={current.month} onChange={(v) => update("month", v)} minWidth={82}>
          {monthNames.map((name, index) => <MenuItem key={name} value={index + 1} sx={{ fontSize: 12 }}>{name}</MenuItem>)}
        </DatePartSelect>
        <Typography sx={{ color: "#CBD5E1", fontSize: 11 }}>/</Typography>
        <DatePartSelect value={current.year} onChange={(v) => update("year", v)} minWidth={58}>
          {years.map((year) => <MenuItem key={year} value={year} sx={{ fontSize: 12 }}>{new Intl.NumberFormat("fa-IR").format(year)}</MenuItem>)}
        </DatePartSelect>
      </Box>
    </Box>
  );
}


function DatePartSelect({ value, onChange, minWidth, children }: { value: number; onChange: (value: string) => void; minWidth: number; children: React.ReactNode }) {
  return (
    <FormControl size="small" sx={{ minWidth }}>
      <Select
        value={String(value)}
        onChange={(event) => onChange(String(event.target.value))}
        sx={{
          "& .MuiSelect-select": { py: 0.35, px: 0.75, fontSize: 11, fontWeight: 600, color: "#475569", fontFamily: '"Vazirmatn", Arial, sans-serif' },
          "& .MuiOutlinedInput-notchedOutline": { border: 0 },
          "&:hover .MuiOutlinedInput-notchedOutline": { border: 0 },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: 0 },
          "& .MuiSelect-icon": { display: "none" },
        }}
        MenuProps={{ dir: "rtl" }}
      >
        {children}
      </Select>
    </FormControl>
  );
}
