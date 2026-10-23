"use client";

import { useEffect, useState } from "react";
import { HardDrive, AlertTriangle } from "lucide-react";

type Usage = {
  usedBytes: number;
  maxBytes: number;
  fileCount: number;
  maxObjects: number;
  missingSizeRecords: number;
};
const formatSize = (value: number) => {
  if (value >= 1024 ** 3) return (value / (1024 ** 3)).toLocaleString("fa-IR", { maximumFractionDigits: 2 }) + " گیگابایت";
  return (value / (1024 ** 2)).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + " مگابایت";
};

export default function StorageUsagePanel() {
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/storage/usage", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((r: Usage & {success:boolean}) => { if (r.success) setData(r); else setError(true); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  const pct = data ? Math.min(100, Math.round(100 * data.usedBytes / Math.max(1, data.maxBytes))) : 0;
  return (
    <section className="rounded-2xl border border-[#E2EAF5] bg-white p-4 sm:p-5" aria-label="فضای ذخیره‌سازی">
      <div className="mb-3 flex items-center gap-2 text-[#18233C]">
        <HardDrive size={19} className="text-[#2F61FD]" />
        <strong className="text-sm">فضای ذخیره‌سازی رسانه‌ها</strong>
      </div>
      {!data ? <p className="text-xs text-[#64748B]">{error ? "دریافت اطلاعات فضای ذخیره‌سازی ناموفق بود." : "در حال بررسی مصرف..."}</p> : (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-2 text-sm">
            <b>{formatSize(data.usedBytes)}</b>
            <span className="text-xs text-[#64748B]">از {formatSize(data.maxBytes)}</span>
          </div>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="درصد فضای مصرف‌شده" className="h-2.5 overflow-hidden rounded-full bg-[#E9EFF9]">
            <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-[#DC2626]" : pct >= 80 ? "bg-[#D97706]" : "bg-[#2F61FD]"}`} style={{width:`${pct}%`}} />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#64748B]">
            <span>{pct.toLocaleString("fa-IR")}٪ مصرف‌شده</span>
            <span>{data.fileCount.toLocaleString("fa-IR")} فایل از {data.maxObjects.toLocaleString("fa-IR")}</span>
          </div>
          {pct >= 80 && <p className="mt-3 flex items-center gap-1.5 text-xs text-[#A45C12]"><AlertTriangle size={15}/>فضای شما نزدیک به سقف مجاز است؛ فایل‌های بلااستفاده را حذف کنید.</p>}
          {data.missingSizeRecords > 0 && <p className="mt-2 text-xs text-[#64748B]">حجم {data.missingSizeRecords.toLocaleString("fa-IR")} فایل قدیمی هنوز ثبت نشده؛ مصرف واقعی ممکن است بیشتر باشد.</p>}
          <p className="mt-3 text-xs leading-6 text-[#64748B]">این محدودیت عمومی برای محافظت از فضای سرور است و به اشتراک مربوط نیست. فایل‌های فعال خودکار حذف نمی‌شوند.</p>
        </>
      )}
    </section>
  );
}
