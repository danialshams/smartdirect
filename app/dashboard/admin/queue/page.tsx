"use client";

import { useCallback, useEffect, useState } from "react";

type FailedJob = {
  id: string;
  jobId: string;
  requeuedJobId: string | null;
  type: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  status: string;
  failedAt: string;
};

type ResponseData = {
  success: boolean;
  data: FailedJob[];
  health: {
    failed: number;
    active: number;
    ready: number;
    stalledTtlSeconds: number;
  };
};

export default function AdminQueuePage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/queue/failed", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message ?? "خطا در دریافت Failed Jobs");
      }
      setData(json);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت اطلاعات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    try {
      const response = await fetch(`/api/admin/queue/failed/${id}/retry`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message ?? "Retry ناموفق بود");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry ناموفق بود");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-white p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Queue Recovery</h1>
          <p className="mt-1 text-sm text-slate-500">Failed Jobs و وضعیت Recovery</p>
        </div>

        {error ? (
          <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric title="Failed" value={data.health.failed} />
            <Metric title="Active" value={data.health.active} />
            <Metric title="Ready" value={data.health.ready} />
            <Metric title="Stalled TTL" value={`${data.health.stalledTtlSeconds}s`} />
          </div>
        ) : null}

        <section className="overflow-hidden border border-slate-200">
          <div className="border-b border-slate-200 p-4 font-medium">
            Failed Jobs
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">در حال دریافت...</div>
          ) : !data?.data.length ? (
            <div className="p-6 text-sm text-slate-500">Failed Job فعالی وجود ندارد.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {data.data.map((job) => (
                <div key={job.id} className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">{job.type}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">{job.jobId}</div>
                    </div>
                    <button
                      type="button"
                      disabled={retrying === job.id}
                      onClick={() => void retry(job.id)}
                      className="border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {retrying === job.id ? "در حال Retry..." : "Manual Retry"}
                    </button>
                  </div>
                  <div className="text-sm text-red-700">{job.lastError}</div>
                  <div className="text-xs text-slate-500">
                    Attempt {job.attempts} / {job.maxAttempts} · {new Date(job.failedAt).toLocaleString("fa-IR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
