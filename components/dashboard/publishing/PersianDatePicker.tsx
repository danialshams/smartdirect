"use client";

import { CalendarClock } from "lucide-react";
import { Button, Calendar, Popover, PopoverContent, PopoverTrigger } from "@/components/dashboard/DashboardUI";

export type JalaliDate = { year: number; month: number; day: number };

const jalaliMonths = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function toPersianDigits(value: number | string) {
  return String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const jYear = jy + 1595;
  let days = -355668 + 365 * jYear + Math.floor(jYear / 33) * 8 + Math.floor(((jYear % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const gd = days + 1;
  const monthDays = [31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let remaining = gd;
  let gm = 1;
  while (remaining > monthDays[gm - 1]) { remaining -= monthDays[gm - 1]; gm += 1; }
  return [gy, gm, remaining];
}

function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  let jy = gy - 621;
  const candidate = jalaliToGregorian(jy, 1, 1);
  const inputUtc = Date.UTC(gy, gm - 1, gd);
  if (inputUtc < Date.UTC(candidate[0], candidate[1] - 1, candidate[2])) jy -= 1;
  const start = jalaliToGregorian(jy, 1, 1);
  const diff = Math.floor((inputUtc - Date.UTC(start[0], start[1] - 1, start[2])) / 86400000);
  return diff < 186
    ? { year: jy, month: Math.floor(diff / 31) + 1, day: (diff % 31) + 1 }
    : { year: jy, month: Math.floor((diff - 186) / 30) + 7, day: ((diff - 186) % 30) + 1 };
}

export default function PersianDatePicker({ value, onChange }: { value: JalaliDate; onChange: (value: JalaliDate) => void }) {
  const selected = new Date(jalaliToGregorian(value.year, value.month, value.day).join("-"));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <CalendarClock size={18} />
          <span>{jalaliMonths[value.month - 1]} {toPersianDigits(value.day)}، {toPersianDigits(value.year)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date: Date | undefined) => {
            if (!date) return;
            onChange(gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate()));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
