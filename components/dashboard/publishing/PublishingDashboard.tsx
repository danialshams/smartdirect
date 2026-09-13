"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

type PublishType = "POST" | "CAROUSEL" | "REEL";
type MediaType = "IMAGE" | "VIDEO";

type LocalMedia = {
  file: File;
  type: MediaType;
  previewUrl: string;
  sortOrder: number;
};

type UploadedMedia = {
  type: MediaType;
  storageKey: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
};

type Job = {
  id: string;
  type: PublishType;
  status: string;
  caption: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  media: UploadedMedia[];
  instagramAccount?: { igUsername: string | null };
};

type InstagramAccount = {
  id: string;
  igUsername: string | null;
  igUserId: string;
};

const typeLabels: Record<PublishType, string> = {
  POST: "پست",
  CAROUSEL: "Carousel",
  REEL: "Reel",
};

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  UPLOADING: "در حال آماده‌سازی",
  PROCESSING: "در حال پردازش",
  PUBLISHING: "در حال انتشار",
  PUBLISHED: "منتشر شده",
  FAILED: "ناموفق",
  SCHEDULED: "زمان‌بندی شده",
  CANCELLED: "لغو شده",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fa-IR");
}

export default function PublishingDashboard() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [type, setType] = useState<PublishType>("POST");
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  async function loadAccounts() {
    const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
    if (!response.ok) throw new Error("دریافت اکانت‌های Instagram ناموفق بود.");

    const result = await response.json();
    const list = result.data ?? result.accounts ?? [];
    setAccounts(list);
    setSelectedAccount((current) => current || list[0]?.id || "");
  }

  async function loadJobs() {
    const response = await fetch("/api/instagram/publishing", { cache: "no-store" });
    if (!response.ok) throw new Error("دریافت Publishing Jobs ناموفق بود.");

    const result = await response.json();
    setJobs(result.data ?? []);
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadAccounts(), loadJobs()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "خطا در دریافت اطلاعات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function clearMedia() {
    media.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setMedia([]);
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    clearMedia();

    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const accepted = type === "REEL"
      ? files.filter((file) => file.type.startsWith("video/"))
      : files.filter((file) => file.type.startsWith("image/"));

    const maxFiles = type === "CAROUSEL" ? 10 : 1;
    const selected = accepted.slice(0, maxFiles);

    setMedia(
      selected.map((file, index) => ({
        file,
        type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        previewUrl: URL.createObjectURL(file),
        sortOrder: index,
      })),
    );
  }

  async function uploadMedia(): Promise<UploadedMedia[]> {
    const uploaded: UploadedMedia[] = [];

    for (const item of media) {
      const formData = new FormData();
      formData.append("file", item.file);

      const response = await fetch("/api/instagram/publishing/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || `آپلود ${item.file.name} ناموفق بود.`);
      }

      uploaded.push({
        ...result.data,
        sortOrder: item.sortOrder,
      });
    }

    return uploaded;
  }

  async function createJob(publishNow: boolean) {
    if (!selectedAccount) {
      setError("ابتدا یک اکانت Instagram انتخاب کنید.");
      return;
    }

    if (!media.length) {
      setError("حداقل یک فایل انتخاب کنید.");
      return;
    }

    if (type === "CAROUSEL" && media.length < 2) {
      setError("Carousel باید حداقل دو تصویر داشته باشد.");
      return;
    }

    if (!publishNow && !scheduledAt) {
      setError("برای زمان‌بندی، تاریخ و ساعت را انتخاب کنید.");
      return;
    }

    try {
      setPublishing(true);
      setError("");

      const uploadedMedia = await uploadMedia();

      const response = await fetch("/api/instagram/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: selectedAccount,
          type,
          caption: caption.trim() || null,
          scheduledAt: publishNow ? null : new Date(scheduledAt).toISOString(),
          idempotencyKey: crypto.randomUUID(),
          media: uploadedMedia,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ساخت Publishing Job ناموفق بود.");

      const job: Job = result.data;

      if (publishNow) {
        const publishResponse = await fetch(`/api/instagram/publishing/${job.id}/publish`, {
          method: "POST",
        });
        const publishResult = await publishResponse.json();

        if (!publishResponse.ok) {
          throw new Error(publishResult.message || "انتشار ناموفق بود.");
        }
      }

      setCaption("");
      setScheduledAt("");
      clearMedia();
      await loadJobs();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "خطا در Publishing.");
    } finally {
      setPublishing(false);
    }
  }

  async function retryJob(id: string) {
    try {
      setError("");
      const response = await fetch(`/api/instagram/publishing/${id}/retry`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Retry ناموفق بود.");
      await loadJobs();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry ناموفق بود.");
    }
  }

  async function cancelJob(id: string) {
    try {
      setError("");
      const response = await fetch(`/api/instagram/publishing/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "لغو ناموفق بود.");
      await loadJobs();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "لغو ناموفق بود.");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">انتشار محتوا</h1>
            <p className="mt-1 text-sm text-slate-500">انتشار واقعی پست، Carousel و Reel در Instagram</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw size={16} /> بروزرسانی
          </button>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">محتوای جدید</h2>
            <p className="mt-1 text-xs text-slate-400">فایل ابتدا در Storage عمومی آپلود و سپس به Meta ارسال می‌شود.</p>

            <div className="my-6 grid grid-cols-3 gap-2">
              {([
                ["POST", "پست", ImagePlus],
                ["CAROUSEL", "Carousel", ImagePlus],
                ["REEL", "Reel", Video],
              ] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" onClick={() => { clearMedia(); setType(value); }} className={["flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm transition", type === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"].join(" ")}>
                  <Icon size={20} />{label}
                </button>
              ))}
            </div>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">اکانت Instagram</span>
              <select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400">
                <option value="">انتخاب اکانت</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>@{account.igUsername}</option>)}
              </select>
            </label>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">فایل</span>
              <input type="file" accept={type === "REEL" ? "video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp"} multiple={type === "CAROUSEL"} onChange={handleFiles} className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm" />
            </label>

            {media.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {media.map((item) => (
                  <div key={`${item.file.name}-${item.sortOrder}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {item.type === "IMAGE" ? <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full object-cover" /> : <video src={item.previewUrl} controls className="aspect-square w-full object-cover" />}
                    <div className="truncate px-2 py-2 text-xs text-slate-500">{item.file.name}</div>
                  </div>
                ))}
              </div>
            )}

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Caption</span>
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} rows={5} placeholder="متن کپشن..." className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
              <span className="mt-1 block text-left text-xs text-slate-400">{caption.length}/2200</span>
            </label>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">زمان‌بندی</span>
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={publishing || loading} onClick={() => void createJob(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                {publishing ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} انتشار الآن
              </button>
              <button type="button" disabled={publishing || loading} onClick={() => void createJob(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                <CalendarClock size={17} /> زمان‌بندی انتشار
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-950">تاریخچه انتشار</h2>
                <p className="mt-1 text-xs text-slate-400">آخرین ۱۰۰ Job</p>
              </div>
              <Clock3 size={18} className="text-slate-400" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="animate-spin" /></div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">هنوز محتوایی ثبت نشده است.</div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          {job.status === "PUBLISHED" ? <CheckCircle2 size={16} className="text-emerald-600" /> : job.status === "FAILED" ? <XCircle size={16} className="text-red-600" /> : <Clock3 size={16} className="text-slate-400" />}
                          {typeLabels[job.type]}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{statusLabels[job.status] || job.status}</div>
                        {job.instagramAccount?.igUsername && <div className="mt-1 text-xs text-slate-400">@{job.instagramAccount.igUsername}</div>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {job.status === "FAILED" && <button type="button" onClick={() => void retryJob(job.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="تلاش مجدد"><RefreshCw size={15} /></button>}
                        {(job.status === "SCHEDULED" || job.status === "DRAFT") && <button type="button" onClick={() => void cancelJob(job.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="لغو"><Trash2 size={15} /></button>}
                      </div>
                    </div>
                    {job.caption && <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{job.caption}</p>}
                    <div className="mt-3 text-xs text-slate-400">
                      {job.publishedAt ? `انتشار: ${formatDate(job.publishedAt)}` : job.scheduledAt ? `زمان‌بندی: ${formatDate(job.scheduledAt)}` : `ایجاد: ${formatDate(null)}`}
                    </div>
                    {job.errorMessage && <div className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">{job.errorMessage}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
